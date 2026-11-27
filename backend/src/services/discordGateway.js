/**
 * Minimal Discord gateway client (bot token, no privileged intents), used only to receive
 * INTERACTION_CREATE events (buttons / select menus on the bot's own messages). No public URL or
 * Developer Portal setup needed. Uses Node's built-in WebSocket (Node >= 22).
 *
 * Handles heartbeat (with zombie detection), resume after a drop, re-identify on an invalid session
 * and stops on fatal close codes (bad token, ...).
 *
 * NB: if the application has an "Interactions Endpoint URL" set in the Developer Portal, Discord
 * sends interactions there instead of the gateway: leave that field empty.
 */

const API = 'https://discord.com/api/v10';
const FATAL_CLOSE = new Set([4004, 4010, 4011, 4012, 4013, 4014]);
const NO_RESUME_CLOSE = new Set([4007, 4009]);

/**
 * @param {object} opts
 * @param {string} opts.token  bot token
 * @param {(type: string, data: object) => void} opts.onDispatch  gateway events (READY, INTERACTION_CREATE, ...)
 * @param {object} [opts.logger]
 */
export function createDiscordGateway({ token, onDispatch, logger = console }) {
  let ws = null;
  let seq = null;
  let sessionId = null;
  let resumeUrl = null;
  let heartbeatTimer = null;
  let firstBeatTimer = null;
  let reconnectTimer = null;
  let acked = true;
  let stopped = true;
  let backoffMs = 1000;
  let user = null;

  function clearTimers() {
    clearTimeout(firstBeatTimer);
    clearInterval(heartbeatTimer);
    firstBeatTimer = null;
    heartbeatTimer = null;
  }

  function send(op, d) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ op, d }));
  }

  function heartbeat() {
    if (!acked) {
      // No ACK since the last beat: the connection is dead, reconnect and resume.
      logger.warn?.('Discord gateway: heartbeat not acknowledged, reconnecting');
      ws?.close(4000, 'zombie');
      return;
    }
    acked = false;
    send(1, seq);
  }

  async function gatewayUrl() {
    const response = await fetch(`${API}/gateway/bot`, { headers: { Authorization: `Bot ${token}` } });
    if (!response.ok) {
      const error = new Error(`gateway/bot HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    return data.url;
  }

  function scheduleReconnect(resume) {
    if (stopped) return;
    clearTimeout(reconnectTimer);
    const delay = backoffMs;
    backoffMs = Math.min(60000, backoffMs * 2);
    reconnectTimer = setTimeout(() => { connect(resume); }, delay);
  }

  async function connect(resume) {
    if (stopped) return;
    let base;
    try {
      base = resume && resumeUrl ? resumeUrl : await gatewayUrl();
    } catch (error) {
      if (error.status === 401) {
        logger.error?.('Discord gateway: invalid DISCORD_BOT_TOKEN, Discord buttons (votes, link panel) disabled');
        stopped = true;
        return;
      }
      logger.warn?.(`Discord gateway: ${error.message}`);
      scheduleReconnect(false);
      return;
    }

    const socket = new WebSocket(`${base}/?v=10&encoding=json`);
    ws = socket;

    socket.onmessage = (event) => {
      let packet;
      try {
        packet = JSON.parse(typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8'));
      } catch {
        return;
      }
      if (packet.s !== null && packet.s !== undefined) seq = packet.s;
      switch (packet.op) {
        case 10: { // HELLO
          clearTimers();
          acked = true;
          const interval = Number(packet.d?.heartbeat_interval) || 41250;
          firstBeatTimer = setTimeout(() => {
            heartbeat();
            heartbeatTimer = setInterval(heartbeat, interval);
          }, Math.floor(interval * Math.random()));
          if (resume && sessionId) {
            send(6, { token, session_id: sessionId, seq });
          } else {
            send(2, {
              token,
              intents: 0,
              properties: { os: process.platform, browser: 'dcsitalia-webviewer', device: 'dcsitalia-webviewer' },
            });
          }
          break;
        }
        case 11: // HEARTBEAT ACK
          acked = true;
          break;
        case 1: // server asks for a heartbeat now
          send(1, seq);
          break;
        case 7: // RECONNECT: resume on a new connection
          socket.close(4000, 'reconnect');
          break;
        case 9: // INVALID SESSION (d = resumable)
          if (!packet.d) {
            sessionId = null;
            seq = null;
          }
          setTimeout(() => socket.close(4000, 'invalid session'), 1000 + Math.random() * 4000);
          break;
        case 0: // DISPATCH
          if (packet.t === 'READY') {
            sessionId = packet.d?.session_id || null;
            resumeUrl = packet.d?.resume_gateway_url || null;
            user = packet.d?.user || null;
            backoffMs = 1000;
            logger.info?.(`Discord gateway: connected as ${user?.username || 'bot'}`);
          } else if (packet.t === 'RESUMED') {
            backoffMs = 1000;
          }
          try {
            onDispatch?.(packet.t, packet.d);
          } catch (error) {
            logger.error?.(`Discord gateway: ${packet.t} handler failed: ${error.message}`);
          }
          break;
        default:
          break;
      }
    };

    socket.onerror = () => {
      // 'close' always follows: reconnection is handled there.
    };

    socket.onclose = (event) => {
      if (ws === socket) ws = null;
      clearTimers();
      if (stopped) return;
      if (FATAL_CLOSE.has(event.code)) {
        logger.error?.(`Discord gateway closed (${event.code} ${event.reason || ''}): not reconnecting`);
        stopped = true;
        return;
      }
      const canResume = Boolean(sessionId) && !NO_RESUME_CLOSE.has(event.code);
      if (!canResume) {
        sessionId = null;
        seq = null;
      }
      scheduleReconnect(canResume);
    };
  }

  function start() {
    if (!token) return false;
    if (typeof WebSocket !== 'function') {
      logger.error?.('Discord gateway: WebSocket not available (Node >= 22 required)');
      return false;
    }
    if (!stopped) return true;
    stopped = false;
    connect(false);
    return true;
  }

  function stop() {
    stopped = true;
    clearTimers();
    clearTimeout(reconnectTimer);
    try {
      ws?.close(1000, 'shutdown');
    } catch {
      // already closed
    }
    ws = null;
  }

  return {
    start,
    stop,
    isConnected: () => Boolean(ws && ws.readyState === 1 && sessionId),
    getUser: () => user,
  };
}

/** Answers an interaction (within 3 s of receiving it). type 4 = new message, 7 = update the clicked message. */
export async function respondToInteraction(interaction, type, data) {
  const response = await fetch(
    `${API}/interactions/${encodeURIComponent(interaction.id)}/${encodeURIComponent(interaction.token)}/callback`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data: { allowed_mentions: { parse: [] }, ...data } }),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`interaction callback HTTP ${response.status} ${text.slice(0, 200)}`);
  }
  return true;
}

export default createDiscordGateway;
