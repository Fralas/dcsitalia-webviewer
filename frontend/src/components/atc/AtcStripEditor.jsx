import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { OWNER_ROLE, STRIP_DIRECTION, createEmptyForm } from './atcStripModel';
import AtcStripCard from './AtcStripCard';
import { t } from '../../utils/locale';

export default function AtcStripEditor({ open, strip, claimedRole, onClose, onSave }) {
  const defaultDirection = useMemo(() => (
    claimedRole === OWNER_ROLE.TOWER ? STRIP_DIRECTION.ARR : STRIP_DIRECTION.DEP
  ), [claimedRole]);

  const [form, setForm] = useState(() => createEmptyForm(defaultDirection));

  useEffect(() => {
    if (!open) return;
    if (strip) {
      setForm({
        ...createEmptyForm(strip.direction),
        ...strip,
      });
    } else {
      setForm(createEmptyForm(defaultDirection));
    }
  }, [open, strip, defaultDirection]);

  if (!open) return null;

  const isArrival = form.direction === STRIP_DIRECTION.ARR;
  const isEditing = Boolean(strip?.id);
  const previewStrip = { ...form, model: isArrival ? 'A' : 'B', id: strip?.id || 'preview' };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave?.(form);
  };

  return (
    <div className="atc-editor-overlay" onClick={onClose}>
      <div className="atc-editor atc-editor--wide" onClick={(e) => e.stopPropagation()}>
        <div className="atc-editor__header">
          <h2>{isEditing ? t('atc.editor.editTitle') : t('atc.editor.newTitle')}</h2>
          <button type="button" className="atc-editor__close" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="atc-editor__preview">
          <span className="atc-editor__preview-label">{t('atc.editor.preview')}</span>
          <div className="atc-editor__preview-card">
            <AtcStripCard strip={previewStrip} readOnly />
          </div>
        </div>

        <form className="atc-editor__form" onSubmit={handleSubmit}>
          <label className="atc-editor__field">
            <span>{t('atc.fields.direction')}</span>
            <select
              value={form.direction}
              onChange={(e) => update('direction', e.target.value)}
              disabled={isEditing}
            >
              <option value={STRIP_DIRECTION.DEP}>{t('atc.direction.dep')}</option>
              <option value={STRIP_DIRECTION.ARR}>{t('atc.direction.arr')}</option>
            </select>
          </label>

          <label className="atc-editor__field">
            <span>{t('atc.fields.callsign')}</span>
            <input value={form.callsign} onChange={(e) => update('callsign', e.target.value.toUpperCase())} required />
          </label>

          <label className="atc-editor__field">
            <span>{t('atc.fields.flightRule')}</span>
            <select value={form.flightRule} onChange={(e) => update('flightRule', e.target.value)}>
              <option value="I">IFR (I)</option>
              <option value="V">VFR (V)</option>
              <option value="Vs">SVFR (Vs)</option>
            </select>
          </label>

          <label className="atc-editor__field">
            <span>{t('atc.fields.aircraftType')}</span>
            <input value={form.aircraftType} onChange={(e) => update('aircraftType', e.target.value.toUpperCase())} />
          </label>

          {isArrival ? (
            <>
              <label className="atc-editor__field">
                <span>{t('atc.fields.eta')}</span>
                <input value={form.eta} onChange={(e) => update('eta', e.target.value)} placeholder="1420" maxLength={4} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.origin')}</span>
                <input value={form.origin} onChange={(e) => update('origin', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.destination')}</span>
                <input value={form.destination} onChange={(e) => update('destination', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.wakeCategory')}</span>
                <select value={form.wakeCategory || 'M'} onChange={(e) => update('wakeCategory', e.target.value)}>
                  <option value="L">L</option>
                  <option value="M">M</option>
                  <option value="H">H</option>
                </select>
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.tas')}</span>
                <input value={form.tas} onChange={(e) => update('tas', e.target.value)} placeholder="280" />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.ata')}</span>
                <input value={form.ata} onChange={(e) => update('ata', e.target.value)} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.pilotEstimate')}</span>
                <input value={form.pilotEstimate} onChange={(e) => update('pilotEstimate', e.target.value)} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.previousFix')}</span>
                <input value={form.previousFix} onChange={(e) => update('previousFix', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.ato')}</span>
                <input value={form.ato} onChange={(e) => update('ato', e.target.value)} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.stand')}</span>
                <input value={form.stand} onChange={(e) => update('stand', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field atc-editor__field--check">
                <input type="checkbox" checked={Boolean(form.standAcknowledged)} onChange={(e) => update('standAcknowledged', e.target.checked)} />
                <span>{t('atc.fields.standAck')}</span>
              </label>
              <label className="atc-editor__field atc-editor__field--full">
                <span>{t('atc.fields.remarks')}</span>
                <input value={form.remarks} onChange={(e) => update('remarks', e.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="atc-editor__field">
                <span>{t('atc.fields.eobt')}</span>
                <input value={form.eobt} onChange={(e) => update('eobt', e.target.value)} placeholder="1430" maxLength={4} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.destination')}</span>
                <input value={form.destination} onChange={(e) => update('destination', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.runway')}</span>
                <input value={form.runway} onChange={(e) => update('runway', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.sid')}</span>
                <input value={form.sid} onChange={(e) => update('sid', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.levelPlanned')}</span>
                <input value={form.levelPlanned} onChange={(e) => update('levelPlanned', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.level')}</span>
                <input value={form.level} onChange={(e) => update('level', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.ssr')}</span>
                <input value={form.ssr} onChange={(e) => update('ssr', e.target.value)} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.startup')}</span>
                <input value={form.startup} onChange={(e) => update('startup', e.target.value.toUpperCase())} placeholder="PD" />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.clearanceTimes')}</span>
                <input value={form.clearanceTimes} onChange={(e) => update('clearanceTimes', e.target.value)} />
              </label>
              <label className="atc-editor__field">
                <span>{t('atc.fields.route')}</span>
                <input value={form.route} onChange={(e) => update('route', e.target.value.toUpperCase())} />
              </label>
              <label className="atc-editor__field atc-editor__field--full">
                <span>{t('atc.fields.clearance')}</span>
                <input value={form.clearanceText} onChange={(e) => update('clearanceText', e.target.value)} />
              </label>
              <label className="atc-editor__field atc-editor__field--full">
                <span>{t('atc.fields.instructions')}</span>
                <input value={form.instructions} onChange={(e) => update('instructions', e.target.value)} />
              </label>
            </>
          )}

          <div className="atc-editor__actions">
            <button type="button" className="atc-editor__btn atc-editor__btn--ghost" onClick={onClose}>
              {t('atc.editor.cancel')}
            </button>
            <button type="submit" className="atc-editor__btn atc-editor__btn--primary">
              {t('atc.editor.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
