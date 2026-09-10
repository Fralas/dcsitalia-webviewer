/** Standard square output for squadron logos uploaded during creation. */
export const SQUADRON_LOGO_SIZE = 256;
export const SQUADRON_LOGO_BACKGROUND = '#2a2a2a';
export const SQUADRON_LOGO_JPEG_QUALITY = 0.9;
export const SQUADRON_LOGO_ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg';

function resolveLogoFormat(file) {
  const mime = String(file?.type || '').toLowerCase();
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg';

  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpeg';

  return null;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    image.src = objectUrl;
  });
}

/**
 * Resize and letterbox uploaded squadron logos to a common square size.
 * PNG stays PNG (transparent letterbox); JPEG stays JPEG.
 * @param {File} file
 * @returns {Promise<string>} normalized data URL
 */
export async function normalizeSquadronLogo(file) {
  const format = resolveLogoFormat(file);
  if (!format) {
    throw new Error('Invalid image file');
  }

  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = SQUADRON_LOGO_SIZE;
  canvas.height = SQUADRON_LOGO_SIZE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is not supported');
  }

  if (format === 'png') {
    context.clearRect(0, 0, SQUADRON_LOGO_SIZE, SQUADRON_LOGO_SIZE);
  } else {
    context.fillStyle = SQUADRON_LOGO_BACKGROUND;
    context.fillRect(0, 0, SQUADRON_LOGO_SIZE, SQUADRON_LOGO_SIZE);
  }

  const scale = Math.min(
    SQUADRON_LOGO_SIZE / image.width,
    SQUADRON_LOGO_SIZE / image.height,
  );
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (SQUADRON_LOGO_SIZE - drawWidth) / 2;
  const offsetY = (SQUADRON_LOGO_SIZE - drawHeight) / 2;

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  if (format === 'png') {
    return canvas.toDataURL('image/png');
  }

  return canvas.toDataURL('image/jpeg', SQUADRON_LOGO_JPEG_QUALITY);
}
