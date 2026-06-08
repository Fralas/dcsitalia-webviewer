import { useEffect, useRef } from 'react';
import { ChevronDown, PlaneLanding, PlaneTakeoff, Plus } from 'lucide-react';
import { STRIP_DIRECTION } from './atcStripModel';
import { t } from '../../utils/locale';

export default function AtcNewStripMenu({ open, onToggle, onCreate, disabled }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        onToggle?.(false);
      }
    };

    const onKey = (event) => {
      if (event.key === 'Escape') onToggle?.(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onToggle]);

  const pick = (direction) => {
    onCreate?.(direction);
    onToggle?.(false);
  };

  return (
    <div className="atc-new-strip" ref={rootRef}>
      <button
        type="button"
        className="atc-toolbar__btn atc-toolbar__btn--primary atc-new-strip__trigger"
        disabled={disabled}
        onClick={() => onToggle?.(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Plus className="w-4 h-4" />
        {t('atc.newStrip')}
        <ChevronDown className={`w-3.5 h-3.5 atc-new-strip__chevron ${open ? 'atc-new-strip__chevron--open' : ''}`} />
      </button>

      {open && (
        <div className="atc-new-strip__menu" role="menu">
          <button
            type="button"
            className="atc-new-strip__option"
            role="menuitem"
            onClick={() => pick(STRIP_DIRECTION.ARR)}
          >
            <PlaneLanding className="w-4 h-4" />
            <span>{t('atc.newStripArrival')}</span>
          </button>
          <button
            type="button"
            className="atc-new-strip__option"
            role="menuitem"
            onClick={() => pick(STRIP_DIRECTION.DEP)}
          >
            <PlaneTakeoff className="w-4 h-4" />
            <span>{t('atc.newStripDeparture')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
