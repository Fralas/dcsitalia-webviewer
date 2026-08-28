import { useEffect, useRef, useState } from 'react';
import { LIDC_STORYLINE_WHITEBOARD_CONNECTIONS, LIDC_STORYLINE_WHITEBOARD_ITEMS } from '../config/lidcStorylineWhiteboardItems';
import { t } from '../utils/locale';
import LidcStorylineWhiteboardString from './LidcStorylineWhiteboardString';
import './LidcStorylineWhiteboard.css';

function renderParagraphs(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  return text.split('\n\n').map((paragraph) => (
    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
  ));
}

function DossierSection({ base, sectionId }) {
  const title = t(`${base}.sections.${sectionId}`);

  switch (sectionId) {
    case 'profile':
    case 'personality':
    case 'secret':
    case 'weakness':
      return (
        <section>
          <h3>{title}</h3>
          {renderParagraphs(t(`${base}.${sectionId}`))}
        </section>
      );

    case 'appearance': {
      const appearanceItems = t(`${base}.appearanceItems`);
      return (
        <section>
          <h3>{title}</h3>
          <ul>
            {Array.isArray(appearanceItems) && appearanceItems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      );
    }

    case 'network': {
      const networkSteps = t(`${base}.networkSteps`);
      return (
        <section>
          <h3>{title}</h3>
          <ol className="lidc-whiteboard-dossier-flow">
            {Array.isArray(networkSteps) && networkSteps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          {renderParagraphs(t(`${base}.networkNote`))}
        </section>
      );
    }

    case 'resources': {
      const resourceItems = t(`${base}.resourceItems`);
      return (
        <section>
          <h3>{title}</h3>
          <p>{t(`${base}.resourcesIntro`)}</p>
          <ul>
            {Array.isArray(resourceItems) && resourceItems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      );
    }

    case 'relationship': {
      const relationshipSteps = t(`${base}.relationshipSteps`);
      return (
        <section>
          <h3>{title}</h3>
          <ol className="lidc-whiteboard-dossier-flow">
            {Array.isArray(relationshipSteps) && relationshipSteps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          {renderParagraphs(t(`${base}.relationshipNote`))}
        </section>
      );
    }

    case 'suppliedMaterial': {
      const suppliedMaterialItems = t(`${base}.suppliedMaterialItems`);
      return (
        <section>
          <h3>{title}</h3>
          <p>{t(`${base}.suppliedMaterialIntro`)}</p>
          <ul>
            {Array.isArray(suppliedMaterialItems) && suppliedMaterialItems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {renderParagraphs(t(`${base}.suppliedMaterialNote`))}
        </section>
      );
    }

    case 'transmissions': {
      const transmissionItems = t(`${base}.transmissionItems`);
      return (
        <section>
          <h3>{title}</h3>
          <p>{t(`${base}.transmissionsIntro`)}</p>
          <ul>
            {Array.isArray(transmissionItems) && transmissionItems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {renderParagraphs(t(`${base}.transmissionsNote`))}
        </section>
      );
    }

    case 'relationships': {
      const relationshipItems = t(`${base}.relationshipItems`);
      return (
        <section>
          <h3>{title}</h3>
          <ul className="lidc-whiteboard-dossier-relationships">
            {Array.isArray(relationshipItems) && relationshipItems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      );
    }

    case 'treeLink': {
      const treeLinkSteps = t(`${base}.treeLinkSteps`);
      return (
        <section>
          <h3>{title}</h3>
          <ol className="lidc-whiteboard-dossier-flow lidc-whiteboard-dossier-flow--chain">
            {Array.isArray(treeLinkSteps) && treeLinkSteps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          {renderParagraphs(t(`${base}.treeLinkNote`))}
        </section>
      );
    }

    default:
      return null;
  }
}

function CharacterDossier({ itemId }) {
  const base = `lidc.storyline.whiteboardItems.${itemId}`;
  const metaFields = ['name', 'nickname', 'age', 'nationality', 'origin', 'faction', 'role', 'category', 'association'];
  const item = LIDC_STORYLINE_WHITEBOARD_ITEMS.find((entry) => entry.id === itemId);
  const sections = item?.dossierSections ?? ['profile', 'personality', 'appearance'];

  return (
    <div className="lidc-whiteboard-dossier">
      <header className="lidc-whiteboard-dossier-head">
        <div className="lidc-whiteboard-focus-photo">
          <img src={item?.image} alt="" draggable={false} />
        </div>
        <div>
          <h2>{t(`${base}.title`)}</h2>
          <dl className="lidc-whiteboard-dossier-meta">
            {metaFields.map((field) => (
              <div key={field}>
                <dt>{t(`${base}.meta.${field}.label`)}</dt>
                <dd>{t(`${base}.meta.${field}.value`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {sections.map((sectionId) => (
        <DossierSection key={sectionId} base={base} sectionId={sectionId} />
      ))}
    </div>
  );
}

export default function LidcStorylineWhiteboard({ onClose }) {
  const [activeItemId, setActiveItemId] = useState(null);
  const [showExitHint, setShowExitHint] = useState(true);
  const contentRef = useRef(null);
  const pinRefs = useRef({});

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

          <div className="lidc-whiteboard-content" ref={contentRef}>
            {LIDC_STORYLINE_WHITEBOARD_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                ref={(element) => {
                  pinRefs.current[item.id] = element;
                }}
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

            {LIDC_STORYLINE_WHITEBOARD_CONNECTIONS.map((connection) => (
              <LidcStorylineWhiteboardString
                key={connection.id}
                connection={connection}
                pinRefs={pinRefs}
                containerRef={contentRef}
                interactive={!activeItem}
              />
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
        <article className={`lidc-whiteboard-focus-card ${activeItem.type === 'character' ? 'is-character' : ''}`} aria-live="polite">
          {activeItem.type === 'character' ? (
            <CharacterDossier itemId={activeItem.id} />
          ) : (
            <>
              <div className="lidc-whiteboard-focus-photo">
                <img src={activeItem.image} alt="" draggable={false} />
              </div>
              <h2>{t(activeItem.detailTitleKey)}</h2>
              <p>{t(`${activeItem.detailTitleKey.replace('.title', '.body')}`)}</p>
            </>
          )}
        </article>
      )}

      {showExitHint && !activeItem && (
        <p className="lidc-whiteboard-exit-hint">{t('lidc.storyline.whiteboardExitHint')}</p>
      )}
    </div>
  );
}
