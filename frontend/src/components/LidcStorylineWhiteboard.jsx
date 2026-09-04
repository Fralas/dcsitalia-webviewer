import { useEffect, useRef, useState } from 'react';
import { LIDC_STORYLINE_WHITEBOARD_CONNECTIONS, LIDC_STORYLINE_WHITEBOARD_ITEMS } from '../config/lidcStorylineWhiteboardItems';
import { t } from '../utils/locale';
import { mergeWhiteboardItems } from '../utils/lidcStorylineWhiteboardLayout';
import LidcStorylineWhiteboardString from './LidcStorylineWhiteboardString';
import { LidcStorylineHudNotice } from './LidcStorylineHud';
import './LidcStorylineWhiteboard.css';

const DEFAULT_VIEW_SCALE = 0.62;
const MIN_VIEW_SCALE = 0.38;
const MAX_VIEW_SCALE = 1.08;
const ZOOM_SENSITIVITY = 0.0012;

const SECTION_ROMAN = {
  profile: 'I',
  personality: 'II',
  appearance: 'III',
  network: 'IV',
  relationships: 'V',
  weakness: 'VI',
  treeLink: 'VII',
  secret: 'VIII',
  resources: 'IX',
  relationship: 'X',
  suppliedMaterial: 'XI',
  transmissions: 'XII',
};

const FILE_CODES = {
  samiullahBarakzai: '201-KDR-0142',
  faisalNoor: '201-KDR-0198',
  omarHakimi: '201-KDR-0211',
  rahmatullahHotak: '201-KDR-0287',
  hamidullahSafi: '201-KDR-0319',
  faridAhmadKhan: '201-KDR-0334',
  zahirPopalzai: '201-HLM-0441',
  nazarMohammadAlizai: '201-KDR-0516',
  izatullahNoorzai: '201-KDR-0590',
  bashirAchakzai: '201-KDR-0663',
  latifIshaqzai: '201-HLM-0738',
  hajiKhairullahBarech: '201-HLM-0812',
  abdulRahman: '201-HLM-0887',
  viktorSokolov: '201-RUS-0903',
};

function clampViewScale(scale) {
  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, scale));
}

function renderParagraphs(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  return text.split('\n\n').map((paragraph) => (
    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
  ));
}

function DossierSection({ base, sectionId }) {
  const title = t(`${base}.sections.${sectionId}`);
  const roman = SECTION_ROMAN[sectionId] || '—';
  let body = null;

  switch (sectionId) {
    case 'profile':
    case 'personality':
    case 'secret':
    case 'weakness':
      body = renderParagraphs(t(`${base}.${sectionId}`));
      break;

    case 'appearance': {
      const appearanceItems = t(`${base}.appearanceItems`);
      body = (
        <ul className="lidc-cia-obs">
          {Array.isArray(appearanceItems) && appearanceItems.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      );
      break;
    }

    case 'network': {
      const networkSteps = t(`${base}.networkSteps`);
      body = (
        <>
          <ol className="lidc-cia-flow">
            {Array.isArray(networkSteps) && networkSteps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          {renderParagraphs(t(`${base}.networkNote`))}
        </>
      );
      break;
    }

    case 'resources': {
      const resourceItems = t(`${base}.resourceItems`);
      body = (
        <>
          <p className="lidc-cia-lede">{t(`${base}.resourcesIntro`)}</p>
          <ul className="lidc-cia-obs">
            {Array.isArray(resourceItems) && resourceItems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      );
      break;
    }

    case 'relationship': {
      const relationshipSteps = t(`${base}.relationshipSteps`);
      body = (
        <>
          <ol className="lidc-cia-flow">
            {Array.isArray(relationshipSteps) && relationshipSteps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          {renderParagraphs(t(`${base}.relationshipNote`))}
        </>
      );
      break;
    }

    case 'suppliedMaterial': {
      const suppliedMaterialItems = t(`${base}.suppliedMaterialItems`);
      body = (
        <>
          <p className="lidc-cia-lede">{t(`${base}.suppliedMaterialIntro`)}</p>
          <ul className="lidc-cia-obs">
            {Array.isArray(suppliedMaterialItems) && suppliedMaterialItems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {renderParagraphs(t(`${base}.suppliedMaterialNote`))}
        </>
      );
      break;
    }

    case 'transmissions': {
      const transmissionItems = t(`${base}.transmissionItems`);
      body = (
        <>
          <p className="lidc-cia-lede">{t(`${base}.transmissionsIntro`)}</p>
          <ul className="lidc-cia-obs">
            {Array.isArray(transmissionItems) && transmissionItems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {renderParagraphs(t(`${base}.transmissionsNote`))}
        </>
      );
      break;
    }

    case 'relationships': {
      const relationshipItems = t(`${base}.relationshipItems`);
      body = (
        <ul className="lidc-cia-relations">
          {Array.isArray(relationshipItems) && relationshipItems.map((line) => {
            const [name, rest] = String(line).split(' — ');
            return (
              <li key={line}>
                <strong>{name}</strong>
                {rest ? <span> — {rest}</span> : null}
              </li>
            );
          })}
        </ul>
      );
      break;
    }

    case 'treeLink': {
      const treeLinkSteps = t(`${base}.treeLinkSteps`);
      body = (
        <>
          <ol className="lidc-cia-flow lidc-cia-flow--chain">
            {Array.isArray(treeLinkSteps) && treeLinkSteps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          {renderParagraphs(t(`${base}.treeLinkNote`))}
        </>
      );
      break;
    }

    default:
      return null;
  }

  return (
    <section className={`lidc-cia-section lidc-cia-section--${sectionId}`}>
      <header className="lidc-cia-section-head">
        <span className="lidc-cia-section-index">{roman}</span>
        <h3>{title}</h3>
      </header>
      <div className="lidc-cia-section-body">{body}</div>
    </section>
  );
}

function CharacterDossier({ itemId }) {
  const base = `lidc.storyline.whiteboardItems.${itemId}`;
  const metaFields = ['name', 'nickname', 'age', 'nationality', 'origin', 'faction', 'role', 'category', 'association'];
  const item = LIDC_STORYLINE_WHITEBOARD_ITEMS.find((entry) => entry.id === itemId);
  const sections = item?.dossierSections ?? ['profile', 'personality', 'appearance'];
  const fileCode = FILE_CODES[itemId] || '201-AFG-0000';

  return (
    <div className="lidc-cia-folder">
      <div className="lidc-cia-tab" aria-hidden="true">
        <span className="lidc-cia-tab-stamp">{t('lidc.storyline.dossier.tab')}</span>
      </div>
      <div className="lidc-cia-sheaf" aria-hidden="true" />
      <div className="lidc-cia-cover">
        <div className="lidc-cia-page">
          <div className="lidc-cia-banner">{t('lidc.storyline.dossier.banner')}</div>

          <header className="lidc-cia-letterhead">
            <p className="lidc-cia-agency">{t('lidc.storyline.dossier.agency')}</p>
            <p className="lidc-cia-directorate">{t('lidc.storyline.dossier.directorate')}</p>
            <div className="lidc-cia-letterhead-row">
              <span>{t('lidc.storyline.dossier.fileType')}</span>
              <span>{t('lidc.storyline.dossier.fileNo')} {fileCode}</span>
              <span>{t('lidc.storyline.dossier.copy')}</span>
            </div>
          </header>

          <div className="lidc-cia-subject">
            <figure className="lidc-cia-photo">
              <img src={item?.image} alt="" draggable={false} />
              <figcaption>{t('lidc.storyline.dossier.photoCaption')}</figcaption>
            </figure>

            <div className="lidc-cia-identity">
              <p className="lidc-cia-subject-kicker">{t('lidc.storyline.dossier.subject')}</p>
              <h2>{t(`${base}.title`)}</h2>
              <dl className="lidc-cia-meta">
                {metaFields.map((field) => (
                  <div key={field} className="lidc-cia-meta-row">
                    <dt>{t(`${base}.meta.${field}.label`)}</dt>
                    <dd>{t(`${base}.meta.${field}.value`)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {sections.map((sectionId) => (
            <DossierSection key={sectionId} base={base} sectionId={sectionId} />
          ))}

          <footer className="lidc-cia-footer">
            <p>{t('lidc.storyline.dossier.handle')}</p>
            <p>{t('lidc.storyline.dossier.control')}</p>
            <p>{t('lidc.storyline.dossier.originated')} · {fileCode}</p>
          </footer>

          <div className="lidc-cia-banner lidc-cia-banner--foot">{t('lidc.storyline.dossier.banner')}</div>
        </div>
      </div>
    </div>
  );
}

export default function LidcStorylineWhiteboard({
  onClose,
  layoutEdit = false,
  pinLayout = null,
  selectedPinId = null,
  onSelectPin,
  onPinLayoutLiveChange,
  onPinLayoutCommit,
}) {
  const [activeItemId, setActiveItemId] = useState(null);
  const [showExitHint, setShowExitHint] = useState(true);
  const [viewScale, setViewScale] = useState(DEFAULT_VIEW_SCALE);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggingPinId, setDraggingPinId] = useState(null);
  const contentRef = useRef(null);
  const surfaceRef = useRef(null);
  const pinRefs = useRef({});
  const panSessionRef = useRef(null);
  const dragSessionRef = useRef(null);
  const viewStateRef = useRef({ scale: DEFAULT_VIEW_SCALE, pan: { x: 0, y: 0 } });

  const items = mergeWhiteboardItems(pinLayout);
  const activeItem = items.find((item) => item.id === activeItemId) ?? null;

  useEffect(() => {
    viewStateRef.current = { scale: viewScale, pan };
  }, [viewScale, pan]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || activeItem) return undefined;

    const onWheel = (event) => {
      event.preventDefault();

      const rect = surface.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const pointerX = event.clientX - rect.left - centerX;
      const pointerY = event.clientY - rect.top - centerY;
      const { scale, pan: currentPan } = viewStateRef.current;
      const worldX = (pointerX - currentPan.x) / scale;
      const worldY = (pointerY - currentPan.y) / scale;
      const nextScale = clampViewScale(scale * Math.exp(-event.deltaY * ZOOM_SENSITIVITY));

      setViewScale(nextScale);
      setPan({
        x: pointerX - worldX * nextScale,
        y: pointerY - worldY * nextScale,
      });
    };

    surface.addEventListener('wheel', onWheel, { passive: false });
    return () => surface.removeEventListener('wheel', onWheel);
  }, [activeItem]);

  useEffect(() => {
    if (!layoutEdit) setActiveItemId(null);
  }, [layoutEdit]);

  const onSurfacePointerDown = (event) => {
    if (activeItem) return;
    if (event.button !== 0 && event.button !== 1) return;
    if (event.target.closest('.lidc-whiteboard-pin')) return;

    event.preventDefault();
    surfaceRef.current?.setPointerCapture(event.pointerId);
    panSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPanX: pan.x,
      originPanY: pan.y,
    };
    setIsPanning(true);
  };

  const clientToBoardPercent = (clientX, clientY) => {
    const content = contentRef.current;
    if (!content) return null;
    const rect = content.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const onPinPointerDown = (event, item) => {
    if (!layoutEdit || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    onSelectPin?.(item.id);
    event.currentTarget.setPointerCapture(event.pointerId);

    const pointer = clientToBoardPercent(event.clientX, event.clientY);
    dragSessionRef.current = {
      pointerId: event.pointerId,
      id: item.id,
      offsetX: pointer ? pointer.x - item.x : 0,
      offsetY: pointer ? pointer.y - item.y : 0,
    };
    setDraggingPinId(item.id);
  };

  const onSurfacePointerMove = (event) => {
    const drag = dragSessionRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      const pointer = clientToBoardPercent(event.clientX, event.clientY);
      if (!pointer) return;
      onPinLayoutLiveChange?.(drag.id, {
        x: Math.min(92, Math.max(-2, pointer.x - drag.offsetX)),
        y: Math.min(92, Math.max(-2, pointer.y - drag.offsetY)),
      });
      return;
    }

    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    setPan({
      x: session.originPanX + (event.clientX - session.startX),
      y: session.originPanY + (event.clientY - session.startY),
    });
  };

  const endPanSession = (event) => {
    const drag = dragSessionRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      const item = items.find((entry) => entry.id === drag.id);
      dragSessionRef.current = null;
      setDraggingPinId(null);
      if (item) onPinLayoutCommit?.(item.id, { x: item.x, y: item.y });
      return;
    }

    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    panSessionRef.current = null;
    setIsPanning(false);
    surfaceRef.current?.releasePointerCapture(event.pointerId);
  };

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
    <div className={`lidc-whiteboard-stage ${layoutEdit ? 'is-layout-edit' : ''}`} role="dialog" aria-modal="true" aria-label={t('lidc.storyline.whiteboardTitle')}>
      <div className="lidc-whiteboard-frame">
        <div
          className={`lidc-whiteboard-surface ${isPanning ? 'is-panning' : ''}`}
          ref={surfaceRef}
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={endPanSession}
          onPointerCancel={endPanSession}
          onContextMenu={(event) => {
            if (event.button === 1) event.preventDefault();
          }}
        >
          <div className="lidc-whiteboard-grime" aria-hidden="true" />
          <div className="lidc-whiteboard-scuffs" aria-hidden="true" />
          <div className="lidc-whiteboard-vignette" aria-hidden="true" />
          <div className="lidc-whiteboard-chalk-dust" aria-hidden="true" />

          <div
            className="lidc-whiteboard-content"
            ref={contentRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${viewScale})`,
            }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                ref={(element) => {
                  pinRefs.current[item.id] = element;
                }}
                className={`lidc-whiteboard-pin ${item.type === 'map' ? 'is-map' : ''} ${activeItemId === item.id ? 'is-active' : ''} ${layoutEdit ? 'is-layout' : ''} ${selectedPinId === item.id ? 'is-layout-selected' : ''} ${draggingPinId === item.id ? 'is-dragging' : ''}`}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.width}%`,
                  '--pin-rotation': `${item.rotation}deg`,
                  transform: `rotate(${item.rotation}deg)`,
                }}
                onPointerDown={(event) => onPinPointerDown(event, item)}
                onPointerMove={onSurfacePointerMove}
                onPointerUp={endPanSession}
                onPointerCancel={endPanSession}
                onClick={() => {
                  if (layoutEdit) {
                    onSelectPin?.(item.id);
                    return;
                  }
                  setActiveItemId((current) => (current === item.id ? null : item.id));
                }}
                aria-label={t(item.labelKey)}
              >
                <span className="lidc-whiteboard-tape lidc-whiteboard-tape--left" aria-hidden="true" />
                {item.type === 'map' && (
                  <span className="lidc-whiteboard-tape lidc-whiteboard-tape--center" aria-hidden="true" />
                )}
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
                interactive={!activeItem && !layoutEdit}
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
        <article
          className={`lidc-whiteboard-focus-card ${activeItem.type === 'character' ? 'is-character' : ''} ${activeItem.type === 'map' ? 'is-map' : ''}`}
          aria-live="polite"
          onClick={(event) => event.stopPropagation()}
        >
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

      {layoutEdit && (
        <LidcStorylineHudNotice
          primaryLabel={t('lidc.storyline.debug.pinLayoutTitle')}
          secondary={t('lidc.storyline.debug.pinLayoutHint')}
        />
      )}
    </div>
  );
}
