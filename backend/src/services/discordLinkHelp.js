/**
 * "Collega il tuo account DCS" panel on Discord (DCSServerBot link, players.discord_id).
 *
 * The bot keeps ONE message with a button in DISCORD_LINK_CHANNEL_ID. A click opens a private
 * (ephemeral) guided procedure: run DCSServerBot's /linkme (clickable command mention), type the code
 * in the DCS chat, then "Verifica collegamento", which reads players.discord_id live (read-only).
 *
 * Nothing here calls DCSServerBot code: only a Discord command mention and the players table the site
 * already reads for the statistics, so DCSServerBot updates do not break it.
 *
 * Interactions arrive through the gateway (discordGateway.js). custom_id:
 *   lk:start          button on the panel (answered only when the message is this instance's panel)
 *   lk:check:<panel>  button in the private procedure (<panel> = panel message id of this instance)
 * so a second site (e.g. dev) sharing the bot never answers for the other one.
 */
import { respondToInteraction } from './discordGateway.js';

const API = 'https://discord.com/api/v10';
const COLOR = 0xf5b301; // same tone as the campaign notifications
const OK_COLOR = 0x3ba55d;
const KO_COLOR = 0xed4245;
const EPHEMERAL = 64;
const LOOKUP_TIMEOUT_MS = 2000; // an interaction must be answered within 3 s
const CHECK_COOLDOWN_MS = 3000;
const FOOTER = { text: 'DCS Italia' };

function escapeMarkdown(value) {
  return String(value ?? '').replace(/([\\*_~`|[\]<>])/g, '\\$1').replace(/@(everyone|here)/g, '@\u200b$1');
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * @param {object} deps
 * @param {string} deps.channelId          DISCORD_LINK_CHANNEL_ID (empty = feature off)
 * @param {string} deps.botToken           DISCORD_BOT_TOKEN
 * @param {string} [deps.linkmeCommandId]  DISCORD_LINKME_COMMAND_ID, id of DCSServerBot's /linkme
 * @param {string} [deps.guideUrl]         https page with the guide (optional link button)
 * @param {(discordId: string) => Promise<Array<{ucid: string, name: string}>>} deps.findLinkedPlayers
 * @param {() => object|undefined} deps.loadState
 * @param {(state: object) => void} deps.saveState
 * @param {object} [deps.logger]
 */
export function createDiscordLinkHelp(deps) {
  const channelId = String(deps.channelId || '').trim();
  const botToken = String(deps.botToken || '').trim();
  const commandId = /^\d{5,25}$/.test(String(deps.linkmeCommandId || '').trim()) ? String(deps.linkmeCommandId).trim() : '';
  const guideUrl = /^https:\/\//i.test(String(deps.guideUrl || '').trim()) ? String(deps.guideUrl).trim() : '';
  const log = deps.logger || console;
  const enabled = Boolean(channelId && botToken && typeof deps.findLinkedPlayers === 'function');
  const lastCheckAt = new Map();

  const linkme = commandId ? `</linkme:${commandId}>` : '`/linkme`';

  async function api(method, path, body) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify({ allowed_mentions: { parse: [] }, ...body }) : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new Error(`Discord ${method} ${path.split('/').slice(0, 3).join('/')} HTTP ${response.status} ${text.slice(0, 200)}`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }

  function readState() {
    const state = deps.loadState?.();
    return state && typeof state === 'object' ? state : {};
  }

  function guideButton() {
    return guideUrl ? [{ type: 2, style: 5, label: 'Guida sul sito', url: guideUrl }] : [];
  }

  // ---------------------------------------------------------------- panel

  function renderPanel() {
    return {
      embeds: [{
        color: COLOR,
        title: '🔗 Collega il tuo account DCS',
        description: [
          'Collega il tuo account Discord al tuo pilota DCS: così il sito mostra le tue statistiche e il tuo livello e puoi partecipare alle votazioni della campagna.',
          '',
          'Premi il pulsante qui sotto: il bot ti guida passo passo in un messaggio che vedi **solo tu**.',
        ].join('\n'),
        footer: FOOTER,
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 1, label: 'Collega il mio account DCS', emoji: { name: '🔗' }, custom_id: 'lk:start' },
          ...guideButton(),
        ],
      }],
    };
  }

  /**
   * Makes sure the panel message exists in the channel: edits the stored one (keeps text and buttons
   * up to date), posts a new one if it is missing or the channel changed. recreate=true always posts
   * a new message (and deletes the old one, best effort).
   */
  async function publishPanel({ recreate = false } = {}) {
    if (!enabled) return { ok: false, error: 'Pannello link Discord disattivato (DISCORD_LINK_CHANNEL_ID / DISCORD_BOT_TOKEN)' };
    const state = readState();
    const sameChannel = state.channelId === channelId && state.messageId;
    try {
      if (sameChannel && !recreate) {
        try {
          await api('PATCH', `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(state.messageId)}`, renderPanel());
          return { ok: true, action: 'updated', channelId, messageId: state.messageId };
        } catch (error) {
          if (error.status !== 404) throw error; // deleted by hand: post a new one below
        }
      } else if (sameChannel && recreate) {
        await api('DELETE', `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(state.messageId)}`).catch(() => {});
      }
      const message = await api('POST', `/channels/${encodeURIComponent(channelId)}/messages`, renderPanel());
      deps.saveState?.({ channelId, messageId: String(message.id), postedAt: Date.now() });
      log.info?.(`Discord link panel posted in channel ${channelId} (message ${message.id})`);
      return { ok: true, action: 'posted', channelId, messageId: String(message.id) };
    } catch (error) {
      log.warn?.(`Discord link panel publish failed: ${error.message}`);
      return { ok: false, error: error.message };
    }
  }

  // ---------------------------------------------------------------- procedure

  function linkedEmbed(players, justChecked) {
    const names = players.map((p) => `**${escapeMarkdown(p.name || p.ucid)}**`);
    const lines = [
      players.length === 1
        ? `Il tuo account Discord è collegato al pilota ${names[0]}.`
        : `Il tuo account Discord è collegato a ${players.length} account DCS: ${names.join(', ')}.`,
      '',
      justChecked
        ? 'Tutto fatto! Le statistiche sul sito si aggiornano entro qualche minuto.'
        : `Per collegare un altro account DCS ripeti ${linkme} e scrivi il nuovo codice nella chat di DCS.`,
    ];
    return { color: OK_COLOR, title: '✅ Account collegato', description: lines.join('\n'), footer: FOOTER };
  }

  function stepsEmbed(notice) {
    const lines = [
      notice || '',
      notice ? '' : null,
      `**1.** Qui su Discord usa il comando ${linkme}${commandId ? ' (clicca sul link e premi Invio)' : ''}: DCSServerBot ti risponde con un codice e il comando da usare.`,
      '**2.** Entra nel server DCS e scrivi quel comando nella **chat di gioco** (ad esempio `-linkme 1234`), mentre sei connesso.',
      '**3.** Torna qui e premi **Verifica collegamento**.',
    ].filter((line) => line !== null);
    return { color: notice ? KO_COLOR : COLOR, title: '🔗 Collega il tuo account DCS', description: lines.join('\n'), footer: FOOTER };
  }

  function checkRow(panelId) {
    return [{
      type: 1,
      components: [
        { type: 2, style: 3, label: 'Verifica collegamento', emoji: { name: '✅' }, custom_id: `lk:check:${panelId}` },
        ...guideButton(),
      ],
    }];
  }

  async function lookup(userId) {
    try {
      return { players: await withTimeout(deps.findLinkedPlayers(userId), LOOKUP_TIMEOUT_MS), error: null };
    } catch (error) {
      log.warn?.(`Discord link panel: lookup failed for ${userId}: ${error.message}`);
      return { players: null, error };
    }
  }

  /**
   * Gateway INTERACTION_CREATE. Returns false when the interaction is not ours: then nothing is answered.
   */
  async function handleInteraction(interaction) {
    if (!enabled || interaction?.type !== 3) return false;
    const customId = String(interaction.data?.custom_id || '');
    const match = customId.match(/^lk:(start|check)(?::(\d+))?$/);
    if (!match) return false;
    const [, action, panelRef] = match;

    const panelId = String(readState().messageId || '');
    if (!panelId) return false;
    if (action === 'start' && String(interaction.message?.id || '') !== panelId) return false; // other instance's panel
    if (action === 'check' && panelRef !== panelId) return false;

    const userId = String(interaction.member?.user?.id || interaction.user?.id || '');
    if (!userId) return false;

    if (action === 'start') {
      const { players } = await lookup(userId);
      const embed = players && players.length > 0 ? linkedEmbed(players, false) : stepsEmbed('');
      const components = players && players.length > 0 ? [] : checkRow(panelId);
      await respondToInteraction(interaction, 4, { flags: EPHEMERAL, embeds: [embed], components });
      return true;
    }

    // check: edit the private message in place (type 7), so clicks do not pile up messages.
    const last = lastCheckAt.get(userId) || 0;
    if (Date.now() - last < CHECK_COOLDOWN_MS) {
      await respondToInteraction(interaction, 7, {
        embeds: [stepsEmbed('⏳ Aspetta qualche secondo prima di verificare di nuovo.')],
        components: checkRow(panelId),
      });
      return true;
    }
    lastCheckAt.set(userId, Date.now());

    const { players, error } = await lookup(userId);
    if (error) {
      await respondToInteraction(interaction, 7, {
        embeds: [stepsEmbed('⚠️ Non riesco a verificare in questo momento. Riprova tra qualche minuto.')],
        components: checkRow(panelId),
      });
    } else if (players.length > 0) {
      await respondToInteraction(interaction, 7, { embeds: [linkedEmbed(players, true)], components: [] });
    } else {
      await respondToInteraction(interaction, 7, {
        embeds: [stepsEmbed('❌ **Il collegamento non risulta ancora.** Controlla di aver scritto il comando nella chat di DCS mentre eri connesso al server. Se il codice è scaduto, ripeti il passo 1.')],
        components: checkRow(panelId),
      });
    }
    return true;
  }

  return {
    enabled,
    publishPanel,
    handleInteraction,
    getStatus: () => ({ enabled, channelId, commandIdSet: Boolean(commandId), guideUrl, panel: readState() }),
  };
}

export default createDiscordLinkHelp;
