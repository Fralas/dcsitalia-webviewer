import { useEffect } from 'react';
import { X, Maximize2 } from 'lucide-react';
import AtcStripCard from './AtcStripCard';
import { t } from '../../utils/locale';

export default function AtcStripFocusOverlay({
  strip,
  selected = true,
  nextAction,
  editable,
  entryMode = 'keyboard',
  operatorRole,
  onClose,
  onFieldChange,
  onFieldCommit,
  onInlineEditFocus,
  onInlineEditBlur,
  onAction,
  onCoordinate,
  onCancelHandoff,
}) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!strip) return null;

  const title = strip.callsign
    ? `${strip.callsign} — ${strip.direction === 'arr' ? t('atc.direction.arr') : t('atc.direction.dep')}`
    : t('atc.focus.title');

  return (
    <div className="atc-focus-overlay" onClick={onClose}>
      <div className="atc-focus" onClick={(e) => e.stopPropagation()}>
        <header className="atc-focus__header">
          <div className="atc-focus__title">
            <Maximize2 className="w-4 h-4" />
            <h2>{title}</h2>
          </div>
          <button type="button" className="atc-toolbar__btn atc-toolbar__btn--icon" onClick={onClose} aria-label={t('atc.focus.close')}>
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="atc-focus__body">
          <AtcStripCard
            strip={strip}
            variant="expanded"
            selected={selected}
            nextAction={nextAction}
            editable={editable}
            readOnly={!editable}
            entryMode={entryMode}
            operatorRole={operatorRole}
            interactive={false}
            onFieldChange={onFieldChange}
            onFieldCommit={onFieldCommit}
            onFieldFocus={onInlineEditFocus}
            onFieldBlur={onInlineEditBlur}
            onAction={onAction}
            onCoordinate={onCoordinate}
            onCancelHandoff={onCancelHandoff}
            showActionBar
          />
        </div>

        <p className="atc-focus__hint">{t('atc.focus.hint')}</p>
      </div>
    </div>
  );
}
