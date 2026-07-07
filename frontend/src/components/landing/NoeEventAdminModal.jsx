import { useMemo, useState } from 'react';
import { X, Trash2, Save, Plus, Loader2 } from 'lucide-react';
import { CAMPAIGNS, DEFAULT_CAMPAIGN_ID, getCampaignById } from '../../config/campaigns';
import * as api from '../../services/api';

const LABELS = {
  en: {
    heading: 'Manage NOE Events',
    campaign: 'Campaign',
    missionDate: 'Mission date',
    registrationEnds: 'Registration ends',
    tacticalDay: 'Tactical day',
    operationName: 'Operation name',
    existing: 'Existing events',
    newEvent: 'New event',
    create: 'Create event',
    update: 'Update event',
    close: 'Close',
    none: 'No events yet',
    required: 'Mission date and operation name are required.',
  },
  it: {
    heading: 'Gestione Eventi NOE',
    campaign: 'Campagna',
    missionDate: 'Data missione',
    registrationEnds: 'Chiusura iscrizioni',
    tacticalDay: 'Tactical day',
    operationName: 'Nome operazione',
    existing: 'Eventi esistenti',
    newEvent: 'Nuovo evento',
    create: 'Crea evento',
    update: 'Aggiorna evento',
    close: 'Chiudi',
    none: 'Nessun evento',
    required: 'Data missione e nome operazione sono obbligatori.',
  },
};

const EMPTY_FORM = {
  campaignId: DEFAULT_CAMPAIGN_ID,
  missionDate: '',
  registrationEndsDate: '',
  tacticalDayDate: '',
  operationName: '',
};

export default function NoeEventAdminModal({ events = [], language = 'en', onClose, onSaved }) {
  const L = LABELS[language] || LABELS.en;
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => String(a.missionDate).localeCompare(String(b.missionDate))),
    [events],
  );

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const startEdit = (event) => {
    setEditingId(event.id);
    setForm({
      campaignId: event.campaignId || DEFAULT_CAMPAIGN_ID,
      missionDate: event.missionDate || '',
      registrationEndsDate: event.registrationEndsDate || '',
      tacticalDayDate: event.tacticalDayDate || '',
      operationName: event.operationName || '',
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.missionDate || !form.operationName.trim()) {
      setError(L.required);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editingId) {
        await api.updateNoeEvent(editingId, form);
      } else {
        await api.createNoeEvent(form);
      }
      await onSaved?.();
      resetForm();
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (eventId) => {
    setBusy(true);
    setError('');
    try {
      await api.deleteNoeEvent(eventId);
      if (editingId === eventId) resetForm();
      await onSaved?.();
    } catch (err) {
      setError(err?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="noe-modal" role="dialog" aria-modal="true" aria-label={L.heading}>
      <div className="noe-modal__backdrop" onClick={onClose} />
      <div className="noe-modal__panel">
        <div className="noe-modal__header">
          <h2>{L.heading}</h2>
          <button type="button" className="noe-modal__close" onClick={onClose} aria-label={L.close}>
            <X size={18} />
          </button>
        </div>

        <div className="noe-modal__content">
          <form className="noe-modal__form" onSubmit={handleSubmit}>
            <label className="noe-modal__field">
              <span>{L.campaign}</span>
              <select
                value={form.campaignId}
                onChange={(e) => setField('campaignId', e.target.value)}
              >
                {CAMPAIGNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className="noe-modal__field">
              <span>{L.missionDate}</span>
              <input
                type="date"
                value={form.missionDate}
                onChange={(e) => setField('missionDate', e.target.value)}
                required
              />
            </label>

            <label className="noe-modal__field">
              <span>{L.registrationEnds}</span>
              <input
                type="date"
                value={form.registrationEndsDate}
                onChange={(e) => setField('registrationEndsDate', e.target.value)}
              />
            </label>

            <label className="noe-modal__field">
              <span>{L.tacticalDay}</span>
              <input
                type="date"
                value={form.tacticalDayDate}
                onChange={(e) => setField('tacticalDayDate', e.target.value)}
              />
            </label>

            <label className="noe-modal__field">
              <span>{L.operationName}</span>
              <input
                type="text"
                value={form.operationName}
                maxLength={120}
                onChange={(e) => setField('operationName', e.target.value)}
                required
              />
            </label>

            {error && <div className="noe-modal__error">{error}</div>}

            <div className="noe-modal__actions">
              {editingId && (
                <button type="button" className="noe-modal__btn" onClick={resetForm} disabled={busy}>
                  <Plus size={15} /> {L.newEvent}
                </button>
              )}
              <button type="submit" className="noe-modal__btn noe-modal__btn--primary" disabled={busy}>
                {busy ? <Loader2 size={15} className="noe-modal__spin" /> : <Save size={15} />}
                {editingId ? L.update : L.create}
              </button>
            </div>
          </form>

          <div className="noe-modal__list">
            <h3>{L.existing}</h3>
            {sortedEvents.length === 0 && <p className="noe-modal__empty">{L.none}</p>}
            {sortedEvents.map((event) => {
              const campaign = getCampaignById(event.campaignId);
              return (
                <div
                  key={event.id}
                  className={`noe-modal__item${editingId === event.id ? ' is-editing' : ''}`}
                >
                  <button type="button" className="noe-modal__item-main" onClick={() => startEdit(event)}>
                    <span className="noe-modal__item-op">{event.operationName || '—'}</span>
                    <span className="noe-modal__item-meta">
                      {(campaign?.label || event.campaignId)} · {event.missionDate}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="noe-modal__item-del"
                    onClick={() => handleDelete(event.id)}
                    disabled={busy}
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
