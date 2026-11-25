/**
 * Region votes on Discord (services/hidcCampaign.js owns the votes).
 *
 * When a round opens, the bot posts a card in the vote channel with a select menu (region to attack)
 * and a "Il mio voto" button. Picking a region opens a private (ephemeral) second menu with the BLUE
 * regions it can be attacked from; the ballot then goes through the same castBallot as the site.
 * Ballots are keyed by Discord id, so a pilot has ONE ballot whether they vote here or on the site:
 * voting again (anywhere) changes it, and both sides show the current one.
 * The card is edited as ballots come in and when the round closes (menu removed).
 *
 * Interactions arrive through the gateway (discordGateway.js). custom_id: hv:t:<voteId>,
 * hv:f:<voteId>:<target>, hv:me:<voteId>. Interactions for a vote id this instance does not know
 * are ignored, so a second site (e.g. dev) sharing the bot never answers for the other one.
 */
import { respondToInteraction } from './discordGateway.js';
import { layout } from './discordNotifications.js';

const API = 'https://discord.com/api/v10';
const COLOR = 0xf5b301; // campaign info tone, same as the notifications
const EPHEMERAL = 64;
const REFRESH_DELAY_MS = 3000;

export function regionName(regionId) {
  const match = String(regionId || '').match(/^REGION_0*(\d+)$/i);
  return match ? `Regione ${match[1]}` : String(regionId || '?').replace(/_+/g, ' ');
}

function escapeMarkdown(value) {
  return String(value ?? '').replace(/([\\*_~`|[\]<>])/g, '\\$1').replace(/@(everyone|here)/g, '@\u200b$1');
}

const bold = (value) => `**${escapeMarkdown(value)}**`;
const plural = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @param {object} deps
 * @param {() => object} deps.readVotes
 * @param {(state: object) => void} deps.writeVotes
 * @param {(user: object, voteId: string, target: string, from: string, source: string) => object} deps.castBallot
 * @param {(user: object) => void} deps.checkVoter  throws (with a message) if the user cannot vote
 * @param {(vote: object) => { targets: object, froms: object, total: number }} deps.tally
 * @param {object} deps.rules  VOTE_RULES
 * @param {string} deps.channelId
 * @param {string} deps.botToken
 * @param {string} [deps.siteUrl]
 * @param {object} [deps.logger]
 */
export function createHidcVoteDiscord(deps) {
  const { channelId, botToken } = deps;
  const log = deps.logger || console;
  const siteUrl = /^https:\/\//i.test(String(deps.siteUrl || '')) ? String(deps.siteUrl).trim() : '';
  const enabled = Boolean(channelId && botToken);
  const refreshTimers = new Map();

  async function api(method, path, body) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify({ allowed_mentions: { parse: [] }, ...body }) : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Discord ${method} ${path.split('/').slice(0, 3).join('/')} HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    return response.status === 204 ? null : response.json();
  }

  function findVote(state, voteId) {
    if (state.current?.id === voteId) return state.current;
    return state.history.find((vote) => vote?.id === voteId) || null;
  }

  // Test votes (debug panel): same card and menus, ballots kept in memory only, never touching the
  // campaign. Lost on a site restart (clicks on an old test card then get no answer).
  const testVotes = new Map();
  const TEST_TTL_MS = 2 * 60 * 60 * 1000;
  const SAMPLE_OPTIONS = [
    { target: 'REGION_5', froms: ['REGION_3', 'REGION_4'] },
    { target: 'REGION_6', froms: ['REGION_4'] },
  ];

  /** Real vote from the campaign store, or a test vote of this instance. */
  function getVote(voteId) {
    return testVotes.get(voteId) || findVote(deps.readVotes(), voteId);
  }

  // ---------------------------------------------------------------- card

  function headline(vote) {
    if (vote.test) return '**Votazione di prova:** i voti non contano per la campagna.';
    const open = vote.status === 'open';
    if (vote.conquered) {
      return `La ${bold(regionName(vote.conquered))} è stata conquistata!${open ? ' Scegliete il prossimo obiettivo.' : ''}`;
    }
    if (vote.startedBy?.name) {
      const now = vote.activeTarget ? ` (${open ? 'ora' : 'era'} ${bold(regionName(vote.activeTarget))})` : '';
      return open
        ? `${bold(vote.startedBy.name)} propone di cambiare la regione attiva${now}.`
        : `Votazione proposta da ${bold(vote.startedBy.name)} per cambiare la regione attiva${now}.`;
    }
    return open ? 'Scegliete il prossimo obiettivo delle forze BLUE.' : 'Votazione per il prossimo obiettivo delle forze BLUE.';
  }

  function optionLines(vote, counts) {
    return [...(vote.options || [])]
      .map((option) => ({ option, votes: counts.targets[option.target]?.votes || 0 }))
      .sort((a, b) => b.votes - a.votes || String(a.option.target).localeCompare(String(b.option.target)))
      .map(({ option, votes }) => {
        const froms = option.froms
          .map((from) => {
            const n = counts.froms[`${option.target}|${from}`]?.votes || 0;
            return n > 0 ? `${regionName(from)} (${n})` : regionName(from);
          })
          .join(' · ');
        return `- ${bold(regionName(option.target))} · ${plural(votes, 'voto', 'voti')} · da ${escapeMarkdown(froms)}`;
      });
  }

  const STATUS_TEXT = {
    passed: 'Votazione chiusa: in attesa del server DCS.',
    applied: 'Votazione chiusa.',
    failed: 'Votazione chiusa: non applicata in DCS.',
    cancelled: 'Votazione annullata.',
    rejected: 'Votazione non valida.',
  };

  function renderCard(vote) {
    const counts = deps.tally(vote);
    const open = vote.status === 'open';
    const min = deps.rules.minVotes;
    const sections = [];
    if (open) {
      sections.push({
        heading: 'Come votare',
        items: [
          '- Scegli la regione da attaccare dal menu qui sotto, poi la regione BLUE da cui partire.',
          vote.test
            ? '- Il voto è uno solo: scegliendo di nuovo lo cambi.'
            : '- Puoi votare anche sul sito: il voto è uno solo e puoi cambiarlo fino alla chiusura.',
        ],
      });
    }
    sections.push({ heading: 'Regioni attaccabili', items: optionLines(vote, counts) });
    if (open) {
      sections.push({
        heading: 'Stato',
        items: [
          `- Voti: ${bold(`${counts.total}/${min}`)} minimi`,
          `- Chiude <t:${Math.floor(vote.endsAt / 1000)}:R>`,
        ],
      });
    } else {
      const passed = vote.target && vote.from && (vote.status === 'passed' || vote.status === 'applied');
      // The result already says it all; the backend message only explains failures / cancellations.
      const reason = !passed && vote.resultMessage ? `- ${escapeMarkdown(vote.resultMessage)}` : '';
      sections.push({
        heading: 'Esito',
        items: [
          `- ${STATUS_TEXT[vote.status] || 'Votazione chiusa.'}`,
          passed ? `- Obiettivo: ${bold(regionName(vote.target))}` : '',
          passed ? `- Attacco da: ${bold(regionName(vote.from))}` : '',
          reason,
        ],
      });
    }

    // No embed title: the "### " header in the description carries the title.
    const embed = {
      color: COLOR,
      description: clip(layout(open ? 'Votazione prossima regione' : 'Votazione chiusa', headline(vote), sections), 4000),
      footer: {
        text: `DCS Italia${vote.test ? ` · TEST${vote.test.by ? ` di ${vote.test.by}` : ''}` : ''} · ${plural(counts.total, 'voto', 'voti')}`,
      },
      timestamp: new Date(vote.createdAt || Date.now()).toISOString(),
    };

    const components = [];
    if (open) {
      const options = (vote.options || []).slice(0, 25).map((option) => ({
        label: regionName(option.target),
        value: option.target,
        description: clip(`Attacco da: ${option.froms.map(regionName).join(', ')}`, 100),
      }));
      if (options.length > 0) {
        components.push({
          type: 1,
          components: [{ type: 3, custom_id: `hv:t:${vote.id}`, placeholder: 'Scegli la regione da attaccare', min_values: 1, max_values: 1, options }],
        });
      }
      const buttons = [{ type: 2, style: 2, label: 'Il mio voto', custom_id: `hv:me:${vote.id}` }];
      if (siteUrl && !vote.test) buttons.push({ type: 2, style: 5, label: 'Vota sul sito', url: siteUrl });
      components.push({ type: 1, components: buttons });
    }
    return { embeds: [embed], components };
  }

  // ---------------------------------------------------------------- publish / refresh

  /** Posts the card of a new round and remembers its message id on the vote. */
  async function publish(voteId) {
    if (!enabled) return false;
    const vote = findVote(deps.readVotes(), voteId);
    if (!vote) return false;
    try {
      const message = await api('POST', `/channels/${encodeURIComponent(channelId)}/messages`, renderCard(vote));
      const state = deps.readVotes();
      const stored = findVote(state, voteId);
      if (stored) {
        stored.discord = { channelId, messageId: message.id };
        deps.writeVotes(state);
        // Ballots or a close may have happened while posting.
        if (stored.status !== 'open' || deps.tally(stored).total > 0) refresh(voteId);
      }
      return true;
    } catch (error) {
      log.warn?.(`HIDC vote Discord card failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Posts a test vote card (debug panel). Options: those of the open vote if any, else a sample.
   * Ballots stay in memory; the same eligibility rules as a real vote apply.
   */
  async function publishTest({ by, options } = {}) {
    if (!enabled) return { ok: false, status: 0, detail: 'Votazioni su Discord disattivate (canale o token mancanti, o HIDC_VOTE_DISCORD=false)' };
    const now = Date.now();
    for (const [id, old] of testVotes) if (now - old.createdAt > TEST_TTL_MS) testVotes.delete(id);
    const valid = Array.isArray(options) && options.length > 0 && options.every((o) => o?.target && Array.isArray(o.froms) && o.froms.length > 0);
    const vote = {
      id: `test_${now.toString(36)}`,
      test: { by: by ? String(by) : '' },
      status: 'open',
      options: (valid ? options : SAMPLE_OPTIONS).map((o) => ({ target: o.target, froms: [...o.froms] })),
      createdAt: now,
      endsAt: now + TEST_TTL_MS,
      ballots: {},
    };
    try {
      const message = await api('POST', `/channels/${encodeURIComponent(channelId)}/messages`, renderCard(vote));
      vote.discord = { channelId, messageId: message.id };
      testVotes.set(vote.id, vote);
      return { ok: true, status: 200, detail: '', voteId: vote.id };
    } catch (error) {
      const status = Number(String(error.message).match(/HTTP (\d+)/)?.[1]) || 0;
      return { ok: false, status, detail: error.message };
    }
  }

  /** Edits the card (debounced): call after every ballot and status change. */
  function refresh(voteId) {
    if (!enabled || !voteId) return;
    clearTimeout(refreshTimers.get(voteId));
    refreshTimers.set(voteId, setTimeout(async () => {
      refreshTimers.delete(voteId);
      const vote = getVote(voteId);
      if (!vote?.discord?.messageId) return;
      try {
        await api('PATCH', `/channels/${encodeURIComponent(vote.discord.channelId)}/messages/${encodeURIComponent(vote.discord.messageId)}`, renderCard(vote));
      } catch (error) {
        log.warn?.(`HIDC vote Discord card update failed: ${error.message}`);
      }
    }, REFRESH_DELAY_MS));
  }

  /** Plain announcement card (vote closed, extended, ...). */
  async function announce(title, description) {
    if (!enabled) return false;
    try {
      await api('POST', `/channels/${encodeURIComponent(channelId)}/messages`, {
        embeds: [{ color: COLOR, description: clip(layout(title, description), 4000), footer: { text: 'DCS Italia' } }],
      });
      return true;
    } catch (error) {
      log.warn?.(`HIDC vote Discord announce failed: ${error.message}`);
      return false;
    }
  }

  // ---------------------------------------------------------------- interactions

  function ballotText(ballot) {
    return `${bold(regionName(ballot.target))}, attacco da ${bold(regionName(ballot.from))}`;
  }

  function sourceText(ballot) {
    if (ballot?.source === 'discord') return ' (votato su Discord)';
    if (ballot?.source === 'site') return ' (votato sul sito)';
    return '';
  }

  function errorText(error) {
    const message = String(error?.message || 'Operazione non riuscita.');
    if (/collega/i.test(message)) {
      return `${message} Il collegamento si fa con /linkme di DCSServerBot qui su Discord.`;
    }
    return message;
  }

  const reply = (interaction, content, components = []) =>
    respondToInteraction(interaction, 4, { content, flags: EPHEMERAL, components });
  const update = (interaction, content, components = []) =>
    respondToInteraction(interaction, 7, { content, components });

  function cast(user, vote, target, from) {
    const before = vote.ballots?.[user.id] || null;
    const changed = before && (before.target !== target || before.from !== from);
    if (before && !changed) {
      // Same choice: not written again, so the ballot keeps its time (tie-break).
      deps.checkVoter(user);
      return `Avevi già votato ${ballotText({ target, from })}${sourceText(before)}: il voto resta quello.`;
    }
    if (vote.test) {
      // Test vote: same checks, ballot kept in memory only (campaign untouched).
      deps.checkVoter(user);
      const option = (vote.options || []).find((entry) => entry.target === target);
      if (!option || !option.froms.includes(from)) throw new Error('Scelta non valida per questa votazione.');
      vote.ballots[user.id] = { target, from, at: Date.now(), name: user.globalName || user.username || user.id, source: 'discord' };
      refresh(vote.id);
    } else {
      deps.castBallot(user, vote.id, target, from, 'discord');
    }
    return [
      changed ? `**Voto cambiato:** ${ballotText({ target, from })}.` : `**Voto registrato:** ${ballotText({ target, from })}.`,
      changed ? `Prima era ${ballotText(before)}${sourceText(before)}.` : '',
      vote.test ? 'Votazione di prova: il voto non conta per la campagna.' : 'Puoi cambiarlo fino alla chiusura, qui o sul sito.',
    ].filter(Boolean).join('\n');
  }

  /**
   * Gateway INTERACTION_CREATE. Returns false when the interaction is not ours (unknown custom_id or
   * vote id): then nothing is answered.
   */
  async function handleInteraction(interaction) {
    if (!enabled || interaction?.type !== 3) return false;
    const customId = String(interaction.data?.custom_id || '');
    const match = customId.match(/^hv:(t|f|me):([^:]+)(?::(.+))?$/);
    if (!match) return false;
    const [, action, voteId, extra] = match;
    const vote = getVote(voteId);
    if (!vote) return false; // another site instance owns this vote

    const raw = interaction.member?.user || interaction.user || {};
    const user = { id: String(raw.id || ''), username: raw.username || '', globalName: raw.global_name || raw.username || '' };
    if (!user.id) return false;
    const mine = vote.ballots?.[user.id] || null;
    const open = vote.status === 'open';

    try {
      if (action === 'me') {
        const text = mine
          ? `Il tuo voto: ${ballotText(mine)}${sourceText(mine)}.${open ? `\nPuoi cambiarlo dal menu${vote.test ? '' : ' o sul sito'} fino alla chiusura.` : ''}`
          : (open ? 'Non hai ancora votato: scegli la regione dal menu.' : 'Non hai votato in questa votazione.');
        await reply(interaction, text);
        return true;
      }

      if (!open) {
        await (action === 'f' ? update : reply)(interaction, 'Questa votazione è chiusa.');
        return true;
      }

      if (action === 't') {
        const target = String(interaction.data?.values?.[0] || '');
        const option = (vote.options || []).find((entry) => entry.target === target);
        if (!option) {
          await reply(interaction, 'Regione non valida per questa votazione.');
          return true;
        }
        if (option.froms.length === 1) {
          await reply(interaction, cast(user, vote, target, option.froms[0]));
          return true;
        }
        // Eligibility before showing the second menu.
        deps.checkVoter(user);
        const already = mine ? `Hai già votato ${ballotText(mine)}${sourceText(mine)}: scegliendo di nuovo cambi il voto.\n\n` : '';
        await reply(interaction, `${already}Attacco alla ${bold(regionName(target))}: da quale regione BLUE si parte?`, [{
          type: 1,
          components: [{
            type: 3,
            custom_id: clip(`hv:f:${vote.id}:${target}`, 100),
            placeholder: 'Scegli la regione di partenza',
            min_values: 1,
            max_values: 1,
            options: option.froms.slice(0, 25).map((from) => ({
              label: regionName(from),
              value: from,
              default: Boolean(mine && mine.target === target && mine.from === from),
            })),
          }],
        }]);
        return true;
      }

      if (action === 'f') {
        const target = String(extra || '');
        const from = String(interaction.data?.values?.[0] || '');
        await update(interaction, cast(user, vote, target, from));
        return true;
      }
    } catch (error) {
      const text = `**Voto non registrato.** ${errorText(error)}`;
      try {
        await (action === 'f' ? update : reply)(interaction, text);
      } catch (replyError) {
        log.warn?.(`HIDC vote Discord reply failed: ${replyError.message}`);
      }
      return true;
    }
    return false;
  }

  return { enabled, publish, publishTest, refresh, announce, handleInteraction, renderCard };
}

export default createHidcVoteDiscord;
