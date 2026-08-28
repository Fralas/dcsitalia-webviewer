import { useEffect, useState } from 'react';
import { LIDC_STORYLINE_WHITEBOARD_ITEMS } from '../config/lidcStorylineWhiteboardItems';
import { t } from '../utils/locale';
import './LidcStorylineWhiteboard.css';

export default function LidcStorylineWhiteboard({ onClose }) {
  const [activeItemId, setActiveItemId] = useState(null);
  const [showExitHint, setShowExitHint] = useState(true);

  const activeItem = LIDC_STORYLINE_WHITEBOARD_ITEMS.find((item) => item.id === activeItemId) ?? null;

  useEffect(() => {
    const hintTimer = window.setTimeout(() => setShowExitHint(false), 3200);

    const onKeyDown = (event) => {
      if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (activeItemId) {
          setActiveItemId(null);
          return;
        }
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(hintTimer);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [activeItemId, onClose]);

  return (
    <div className="lidc-whiteboard-stage" role="dialog" aria-modal="true" aria-label={t('lidc.storyline.whiteboardTitle')}>
      <div className="lidc-whiteboard-frame">
        <div className="lidc-whiteboard-surface">
          <div className="lidc-whiteboard-grime" aria-hidden="true" />
          <div className="lidc-whiteboard-scuffs" aria-hidden="true" />
          <div className="lidc-whiteboard-vignette" aria-hidden="true" />
          <div className="lidc-whiteboard-chalk-dust" aria-hidden="true" />

          <div className="lidc-whiteboard-content">
          {LIDC_STORYLINE_WHITEBOARD_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`lidc-whiteboard-pin ${activeItemId === item.id ? 'is-active' : ''}`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: `${item.width}%`,
                '--pin-rotation': `${item.rotation}deg`,
                transform: `rotate(${item.rotation}deg)`,
              }}
              onClick={() => setActiveItemId((current) => (current === item.id ? null : item.id))}
              aria-label={t(item.labelKey)}
            >
              <span className="lidc-whiteboard-tape lidc-whiteboard-tape--left" aria-hidden="true" />
              <span className="lidc-whiteboard-tape lidc-whiteboard-tape--right" aria-hidden="true" />
              <span className="lidc-whiteboard-photo">
                <img src={item.image} alt="" draggable={false} />
              </span>
              <span className="lidc-whiteboard-caption">{t(item.labelKey)}</span>
            </button>
          ))}
          </div>
        </div>
      </div>

      {activeItem && (
        <div
          className="lidc-whiteboard-focus-backdrop"
          onClick={() => setActiveItemId(null)}
          aria-hidden="true"
        />
      )}

      {activeItem && (
        <article className="lidc-whiteboard-focus-card" aria-live="polite">
          <div className="lidc-whiteboard-focus-photo">
            <img src={activeItem.image} alt="" draggable={false} />
          </div>
          <h2>{t(activeItem.detailTitleKey)}</h2>
          <p>{t(activeItem.detailBodyKey)}</p>
        </article>
      )}

      {showExitHint && !activeItem && (
        <p className="lidc-whiteboard-exit-hint">{t('lidc.storyline.whiteboardExitHint')}</p>
      )}
    </div>
  );
}
