import { Copy, Download, Link2, RotateCcw, Save, Unlink, X } from 'lucide-react';
import { DEBUG_TARGETS } from '../utils/lidcStorylineTransform';
import { t } from '../utils/locale';

function NumberField({ label, value, step = 0.01, onChange }) {
  return (
    <label className="lidc-storyline-debug-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ScaleFields({ values, scaleLinked, onScaleLinkedChange, onChange }) {
  return (
    <div className="lidc-storyline-debug-subsection">
      <div className="lidc-storyline-debug-subsection-head">
        <span>{t('lidc.storyline.debug.scale')}</span>
        <button
          type="button"
          className={`lidc-storyline-debug-link ${scaleLinked ? 'is-active' : ''}`}
          onClick={() => onScaleLinkedChange(!scaleLinked)}
          aria-label={scaleLinked ? t('lidc.storyline.debug.scaleUnlink') : t('lidc.storyline.debug.scaleLink')}
          title={scaleLinked ? t('lidc.storyline.debug.scaleUnlink') : t('lidc.storyline.debug.scaleLink')}
          aria-pressed={scaleLinked}
        >
          {scaleLinked ? <Link2 size={14} /> : <Unlink size={14} />}
        </button>
      </div>
      <VectorFields
        labels={['Sx', 'Sy', 'Sz']}
        values={values}
        step={0.01}
        onChange={onChange}
      />
    </div>
  );
}
function VectorFields({ labels, values, step = 0.01, onChange }) {
  return (
    <div className="lidc-storyline-debug-vector">
      {labels.map((label, index) => (
        <NumberField
          key={label}
          label={label}
          step={step}
          value={values[index]}
          onChange={(nextValue) => {
            onChange(values, index, nextValue);
          }}
        />
      ))}
    </div>
  );
}

export default function LidcStorylineDebugPanel({
  transform,
  transformMode,
  debugTarget,
  scaleLinked,
  cameraPosition,
  saveStatus,
  onDebugTargetChange,
  onScaleLinkedChange,
  onTransformModeChange,
  onTargetPositionChange,
  onTargetRotationChange,
  onTargetScaleAxisChange,
  onPlayerChange,
  onSave,
  onDownload,
  onReset,
  onCopy,
  onSnapPlayerToRoom,
  onClose,
}) {
  const { room, whiteboard, player } = transform;
  const activeTransform = debugTarget === DEBUG_TARGETS.WHITEBOARD ? whiteboard : room;
  const targetLabel = debugTarget === DEBUG_TARGETS.WHITEBOARD
    ? t('lidc.storyline.debug.whiteboardTransform')
    : t('lidc.storyline.debug.roomTransform');

  return (
    <aside className="lidc-storyline-debug-panel">
      <header className="lidc-storyline-debug-head">
        <div className="lidc-storyline-debug-head-copy">
          <h2>{t('lidc.storyline.debug.title')}</h2>
          <p>{t('lidc.storyline.debug.subtitle')}</p>
        </div>
        <button
          type="button"
          className="lidc-storyline-debug-close"
          onClick={onClose}
          aria-label={t('lidc.storyline.debug.closePanel')}
          title={t('lidc.storyline.debug.closePanel')}
        >
          <X size={16} />
        </button>
      </header>

      <div className="lidc-storyline-debug-targets">
        {[DEBUG_TARGETS.ROOM, DEBUG_TARGETS.WHITEBOARD].map((target) => (
          <button
            key={target}
            type="button"
            className={`lidc-storyline-debug-target ${debugTarget === target ? 'is-active' : ''}`}
            onClick={() => onDebugTargetChange(target)}
          >
            {t(`lidc.storyline.debug.targets.${target}`)}
          </button>
        ))}
      </div>

      <div className="lidc-storyline-debug-modes">
        {['translate', 'rotate', 'scale'].map((mode) => (
          <button
            key={mode}
            type="button"
            className={`lidc-storyline-debug-mode ${transformMode === mode ? 'is-active' : ''}`}
            onClick={() => onTransformModeChange(mode)}
          >
            {t(`lidc.storyline.debug.modes.${mode}`)}
          </button>
        ))}
      </div>

      <section className="lidc-storyline-debug-section">
        <h3>{targetLabel}</h3>
        <VectorFields
          labels={['X', 'Y', 'Z']}
          values={activeTransform.position}
          step={0.01}
          onChange={(values, index, nextValue) => {
            const next = [...values];
            next[index] = nextValue;
            onTargetPositionChange(next);
          }}
        />
        <VectorFields
          labels={['Rx', 'Ry', 'Rz']}
          values={activeTransform.rotation}
          step={1}
          onChange={(values, index, nextValue) => {
            const next = [...values];
            next[index] = nextValue;
            onTargetRotationChange(next);
          }}
        />
        <ScaleFields
          values={activeTransform.scale}
          scaleLinked={scaleLinked}
          onScaleLinkedChange={onScaleLinkedChange}
          onChange={(scale, axisIndex, nextValue) => onTargetScaleAxisChange(axisIndex, nextValue)}
        />
      </section>

      <section className="lidc-storyline-debug-section">
        <h3>{t('lidc.storyline.debug.player')}</h3>
        <VectorFields
          labels={['X', 'Y', 'Z']}
          values={player.spawnOffset}
          step={0.01}
          onChange={(values, index, nextValue) => {
            const next = [...values];
            next[index] = nextValue;
            onPlayerChange({ spawnOffset: next });
          }}
        />
        <NumberField
          label={t('lidc.storyline.debug.heightOffset')}
          step={0.01}
          value={player.heightOffset}
          onChange={(heightOffset) => onPlayerChange({ heightOffset })}
        />
        <label className="lidc-storyline-debug-check">
          <input
            type="checkbox"
            checked={player.snapToFloor}
            onChange={(event) => onPlayerChange({ snapToFloor: event.target.checked })}
          />
          <span>{t('lidc.storyline.debug.snapToFloor')}</span>
        </label>
        <button type="button" className="lidc-storyline-debug-action" onClick={onSnapPlayerToRoom}>
          {t('lidc.storyline.debug.snapPlayerToRoom')}
        </button>
      </section>

      <section className="lidc-storyline-debug-section">
        <h3>{t('lidc.storyline.debug.camera')}</h3>
        <pre className="lidc-storyline-debug-readout">
          {cameraPosition.map((value) => value.toFixed(3)).join(', ')}
        </pre>
      </section>

      <div className="lidc-storyline-debug-actions">
        <button type="button" className="lidc-storyline-debug-action is-primary" onClick={onSave}>
          <Save size={14} />
          {t('lidc.storyline.debug.save')}
        </button>
        <button type="button" className="lidc-storyline-debug-action" onClick={onDownload}>
          <Download size={14} />
          {t('lidc.storyline.debug.download')}
        </button>
        <button type="button" className="lidc-storyline-debug-action" onClick={onCopy}>
          <Copy size={14} />
          {t('lidc.storyline.debug.copy')}
        </button>
        <button type="button" className="lidc-storyline-debug-action" onClick={onReset}>
          <RotateCcw size={14} />
          {t('lidc.storyline.debug.reset')}
        </button>
      </div>

      {saveStatus && (
        <p className="lidc-storyline-debug-status">{saveStatus}</p>
      )}

      <p className="lidc-storyline-debug-hint">{t('lidc.storyline.debug.hint')}</p>
    </aside>
  );
}
