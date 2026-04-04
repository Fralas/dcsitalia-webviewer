function splitForGoogle(text, maxLen = 1400) {
  const input = String(text || '');
  if (!input) return [''];
  const chunks = [];
  let current = '';
  const parts = input.split('\n');

  parts.forEach((part, index) => {
    const value = index < parts.length - 1 ? `${part}\n` : part;
    if ((current + value).length > maxLen && current) {
      chunks.push(current);
      current = value;
      return;
    }
    current += value;
  });

  if (current) chunks.push(current);
  return chunks;
}

async function translateViaGoogle(text, sourceLang, targetLang) {
  const chunks = splitForGoogle(text);
  const translatedChunks = [];

  for (const chunk of chunks) {
    if (!chunk) {
      translatedChunks.push('');
      continue;
    }
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(chunk)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translation provider failed (${response.status})`);
    }
    const data = await response.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map((segment) => String(segment?.[0] || '')).join('')
      : '';
    translatedChunks.push(translated);
  }

  return translatedChunks.join('');
}

async function translateText(text, sourceLang, targetLang) {
  const value = String(text || '').trim();
  if (!value) return '';

  try {
    return await translateViaGoogle(value, sourceLang, targetLang);
  } catch (error) {
    console.warn('Automatic translation failed:', error.message);
    return '';
  }
}

export async function translateDraft(draft, options = {}) {
  const sourceLang = String(options.sourceLang || 'it');
  const targetLang = String(options.targetLang || 'en');
  const overwrite = options.overwrite === true;

  const title = String(draft?.title || '');
  const titleEn = String(draft?.titleEn || '');
  const rows = Array.isArray(draft?.rows) ? draft.rows : [];

  const next = {
    ...draft,
    titleEn,
    rows: rows.map((row) => ({ ...row })),
  };

  if (title && (overwrite || !titleEn.trim())) {
    const translatedTitle = await translateText(title, sourceLang, targetLang);
    if (translatedTitle) next.titleEn = translatedTitle;
  }

  for (let i = 0; i < next.rows.length; i += 1) {
    const row = next.rows[i];
    const text = String(row?.text || '');
    const textEn = String(row?.textEn || '');
    if (!text || (!overwrite && textEn.trim())) continue;
    const translatedRow = await translateText(text, sourceLang, targetLang);
    if (translatedRow) {
      next.rows[i] = {
        ...row,
        textEn: translatedRow,
      };
    }
  }

  return next;
}

