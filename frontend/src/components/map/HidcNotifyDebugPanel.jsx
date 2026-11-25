import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, ChevronDown, ChevronUp, Layers, Loader2, RefreshCw, Send } from 'lucide-react';
import { getNotifyDebug, pollNotifyDebug, sendAllNotifyTests, sendNotifyTest, sendVoteNotifyTest } from '../../services/api';
import './HidcRegionVotePanel.css';
import './HidcFrontDebugPanel.css';
import './HidcNotifyDebugPanel.css';

/**
 * Discord notification debug tool, hidden: shown only with ?hidcDebug=1 (same flag as the other debug panels)
 * and only to staff allowed by the backend (DISCORD_NOTIFY_TEST_IDS). Sends test messages straight to the
 * notifications channel and shows the state of DCORE's Export_Notifications.json.
 *
 * @param {object} props
 * @param {number} props.offset  left offset in px (other debug panels docked bottom-left)
 */

function timeLabel(value, unit = 'ms') {
  const ms = unit === 's' ? Number(value) * 1000 : Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function HidcNotifyDebugPanel({ offset = 20 }) {
  const [status, setStatus] = useState(null);
  // Every type + the multi-zone summary + the test vote card (if voting on Discord is on).
  const allCount = (status?.types?.length || 0) + 1 + (status?.voteTestEnabled ? 1 : 0);
  const [hidden, setHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState('');
  const [type, setType] = useState('convoy_departed');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    try {
      setStatus(await getNotifyDebug());
    } catch (error) {
      // 401/403: not a tester, the panel stays out of the way.
      if (error?.status === 401 || error?.status === 403) setHidden(true);
      else setFeedback({ ok: false, text: error?.message || 'Stato non disponibile' });
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const sample = useMemo(() => status?.types?.find((item) => item.type === type) || null, [status, type]);

  if (hidden) return null;

  const send = async () => {
    setBusy('send');
    setFeedback(null);
    try {
      const result = await sendNotifyTest({ type, title: title.trim(), message: message.trim() });
      setFeedback({ ok: true, text: 'Inviata sul canale Discord' });
      if (result?.status_info) setStatus(result.status_info);
    } catch (error) {
      setFeedback({ ok: false, text: error?.message || 'Invio non riuscito' });
      load();
    } finally {
      setBusy('');
    }
  };

  const sendVote = async () => {
    setBusy('vote');
    setFeedback(null);
    try {
      const result = await sendVoteNotifyTest();
      setFeedback({ ok: true, text: 'Votazione di prova inviata: puoi votare dal menu su Discord (non conta per la campagna)' });
      if (result?.status_info) setStatus(result.status_info);
    } catch (error) {
      setFeedback({ ok: false, text: error?.message || 'Invio non riuscito' });
    } finally {
      setBusy('');
    }
  };

  const sendAll = async () => {
    const total = allCount;
    if (!window.confirm(`Mandare ${total} notifiche di test sul canale Discord?`)) return;
    setBusy('all');
    setFeedback({ ok: true, text: `Invio di ${total} notifiche in corso (circa ${Math.ceil(total * 1.3)} s)…` });
    try {
      const result = await sendAllNotifyTests();
      setFeedback({ ok: true, text: `Inviate ${result.sent}/${result.total} notifiche` });
      if (result?.status_info) setStatus(result.status_info);
    } catch (error) {
      setFeedback({ ok: false, text: error?.message || 'Invio non riuscito' });
      load();
    } finally {
      setBusy('');
    }
  };

  const poll = async () => {
    setBusy('poll');
    setFeedback(null);
    try {
      setStatus(await pollNotifyDebug());
      setFeedback({ ok: true, text: 'File DCORE riletto' });
    } catch (error) {
      setFeedback({ ok: false, text: error?.message || 'Lettura non riuscita' });
    } finally {
      setBusy('');
    }
  };

  const delivery = status?.lastDelivery || null;
  const problems = [];
  if (status && !status.channelId) problems.push('DISCORD_NOTIFY_CHANNEL_ID mancante');
  if (status && !status.hasBotToken) problems.push('DISCORD_BOT_TOKEN mancante');
  if (status && !status.file) problems.push('percorso Export_Notifications.json non risolto');
  else if (status && !status.fileExists) problems.push('file DCORE non ancora creato (missione non avviata?)');
  if (status?.fileError) problems.push(`file illeggibile: ${status.fileError}`);

  return (
    <section
      className="hidc-vote hidc-front-debug hidc-notify-debug"
      style={{ left: `${offset}px` }}
      aria-label="Debug notifiche Discord"
    >
      <div className="hidc-vote__head hidc-front-debug__head">
        <span className="hidc-vote__head-copy">
          <span className="hidc-vote__kicker"><BellRing className="h-3 w-3" /> Debug notifiche</span>
          <span className="hidc-vote__title">
            {status ? (status.enabled ? 'Attive' : 'Disattivate') : 'Caricamento…'}
            {status?.channelId && <span className="hidc-vote__title-from"> · canale {status.channelId}</span>}
          </span>
        </span>
        <button
          type="button"
          className="hidc-vote__btn"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Espandi' : 'Riduci'}
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="hidc-vote__body hidc-notify-debug__body">
          {problems.length > 0 && (
            <ul className="hidc-notify-debug__problems">
              {problems.map((text) => <li key={text}>{text}</li>)}
            </ul>
          )}

          <label className="hidc-vote__field">
            <span>Tipo</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              {(status?.types || []).map((item) => (
                <option key={item.type} value={item.type}>{item.type}</option>
              ))}
            </select>
          </label>
          <label className="hidc-vote__field">
            <span>Titolo (vuoto = esempio)</span>
            <input
              className="hidc-notify-debug__input"
              value={title}
              maxLength={200}
              placeholder={sample?.title || ''}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="hidc-vote__field">
            <span>Messaggio (vuoto = esempio)</span>
            <textarea
              className="hidc-notify-debug__input hidc-notify-debug__textarea"
              value={message}
              maxLength={1500}
              rows={2}
              placeholder={sample?.message || ''}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <div className="hidc-vote__actions">
            <button
              type="button"
              className="hidc-vote__btn hidc-vote__btn--primary"
              onClick={send}
              disabled={Boolean(busy) || !status?.channelId || !status?.hasBotToken}
              title="Manda subito un messaggio [TEST] sul canale"
            >
              {busy === 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Invia test
            </button>
            <button
              type="button"
              className="hidc-vote__btn"
              onClick={poll}
              disabled={Boolean(busy) || !status?.enabled}
              title="Rilegge subito Export_Notifications.json e invia gli eventi nuovi"
            >
              {busy === 'poll' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Rileggi DCORE
            </button>
          </div>

          <button
            type="button"
            className="hidc-vote__btn"
            onClick={sendAll}
            disabled={Boolean(busy) || !status?.channelId || !status?.hasBotToken}
            title="Manda una notifica di test per ogni tipo, il riepilogo di più zone e la votazione di prova"
          >
            {busy === 'all' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
            Invia tutte le notifiche ({allCount})
          </button>

          <button
            type="button"
            className="hidc-vote__btn"
            onClick={sendVote}
            disabled={Boolean(busy) || !status?.voteTestEnabled}
            title={status?.voteTestEnabled
              ? 'Manda la card della votazione con i menu funzionanti: i voti restano di prova e non toccano la campagna'
              : 'Votazioni su Discord disattivate (HIDC_VOTE_DISCORD=false o canale/token mancanti)'}
          >
            {busy === 'vote' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
            Invia votazione di prova
          </button>

          {feedback && (
            <p className={`hidc-vote__msg${feedback.ok ? ' is-ok' : ' is-warn'}`}>{feedback.text}</p>
          )}

          {delivery && (
            <p className="hidc-vote__msg">
              Ultimo invio ({delivery.source === 'test' ? 'test' : 'DCORE'}) {timeLabel(delivery.at)}:{' '}
              <span className={delivery.result === 'ok' ? 'hidc-notify-debug__ok' : 'hidc-notify-debug__ko'}>
                {delivery.result === 'ok' ? 'OK' : `errore HTTP ${delivery.status || '—'}`}
              </span>
              {delivery.detail ? ` · ${delivery.detail}` : ''}
            </p>
          )}

          <div className="hidc-notify-debug__recent">
            <div className="hidc-vote__row">
              <span className="hidc-vote__label">Ultimi eventi DCORE</span>
              <span className="hidc-vote__time">file {timeLabel(status?.fileUpdatedAt, 's')}</span>
            </div>
            {(status?.recent || []).length === 0 && <p className="hidc-vote__msg">Nessun evento nel file.</p>}
            {(status?.recent || []).map((ev) => (
              <div key={ev.id} className="hidc-notify-debug__event" title={ev.message}>
                <span className={`hidc-notify-debug__dot${ev.posted ? ' is-posted' : ''}`} />
                <span className="hidc-notify-debug__event-title">{ev.title}</span>
                <span className="hidc-vote__time">{timeLabel(ev.at, 's')}</span>
              </div>
            ))}
          </div>

          <p className="hidc-vote__last hidc-front-debug__stats">
            Inviati {status?.postedCount ?? 0} · poll {status?.pollSec ?? '—'}s · max età {status?.maxAgeMin ?? '—'} min
          </p>
        </div>
      )}
    </section>
  );
}
