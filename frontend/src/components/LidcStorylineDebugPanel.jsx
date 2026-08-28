import { Copy, Download, Link2, Plus, RotateCcw, Save, Trash2, Unlink, X } from 'lucide-react';
import { DEBUG_TARGETS } from '../utils/lidcStorylineTransform';
import { ZONE_TYPES } from '../utils/lidcStorylineZones';
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

function TextField({ label, value, onChange }) {
  return (
    <label className="lidc-storyline-debug-field">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default function LidcStorylineDebugPanel({
  transform,
  transformMode,
  debugTarget,
  selectedZoneId,
  scaleLinked,
  cameraPosition,
  saveStatus,
  lastTriggerEvent,
  onDebugTargetChange,
  onSelectZone,
  onAddZone,
  onRemoveZone,
  onZoneMetaChange,
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
  const { room, whiteboard, player, zones = [] } = transform;
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;
  const activeTransform = debugTarget === DEBUG_TARGETS.ZONE && selectedZone
    ? selectedZone
    : debugTarget === DEBUG_TARGETS.WHITEBOARD
      ? whiteboard
      : room;

  const targetLabel = debugTarget === DEBUG_TARGETS.ZONE && selectedZone
    ? t('lidc.storyline.debug.zoneTransform')
    : debugTarget === DEBUG_TARGETS.WHITEBOARD
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
        {debugTarget === DEBUG_TARGETS.ZONE && selectedZone && (
          <>
            <TextField
              label={t('lidc.storyline.debug.zoneLabel')}
              value={selectedZone.label}
              onChange={(label) => onZoneMetaChange(selectedZone.id, { label })}
            />
            {selectedZone.type === ZONE_TYPES.TRIGGER && (
              <TextField
                label={t('lidc.storyline.debug.zoneEventId')}
                value={selectedZone.eventId}
                onChange={(eventId) => onZoneMetaChange(selectedZone.id, { eventId })}
              />
            )}
          </>
        )}
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
        <div className="lidc-storyline-debug-section-head">
          <h3>{t('lidc.storyline.debug.zonesTitle')}</h3>
          <div className="lidc-storyline-debug-zone-actions">
            <button
              type="button"
              className="lidc-storyline-debug-zone-add is-trigger"
              onClick={() => onAddZone(ZONE_TYPES.TRIGGER)}
              title={t('lidc.storyline.debug.addTriggerZone')}
            >
              <Plus size={14} />
              {t('lidc.storyline.debug.addTriggerZone')}
            </button>
            <button
              type="button"
              className="lidc-storyline-debug-zone-add is-collision"
              onClick={() => onAddZone(ZONE_TYPES.COLLISION)}
              title={t('lidc.storyline.debug.addCollisionZone')}
            >
              <Plus size={14} />
              {t('lidc.storyline.debug.addCollisionZone')}
            </button>
          </div>
        </div>

        {zones.length === 0 && (
          <p className="lidc-storyline-debug-empty">{t('lidc.storyline.debug.zonesEmpty')}</p>
        )}

        <ul className="lidc-storyline-debug-zone-list">
          {zones.map((zone) => (
            <li key={zone.id}>
              <button
                type="button"
                className={`lidc-storyline-debug-zone-item ${selectedZoneId === zone.id ? 'is-active' : ''} is-${zone.type}`}
                onClick={() => onSelectZone(zone.id)}
              >
                <span className="lidc-storyline-debug-zone-type">
                  {t(`lidc.storyline.debug.zoneTypes.${zone.type}`)}
                </span>
                <span className="lidc-storyline-debug-zone-name">{zone.label || zone.id}</span>
              </button>
              <button
                type="button"
                className="lidc-storyline-debug-zone-delete"
                onClick={() => onRemoveZone(zone.id)}
                aria-label={t('lidc.storyline.debug.removeZone')}
                title={t('lidc.storyline.debug.removeZone')}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>

        {lastTriggerEvent && (
          <p className="lidc-storyline-debug-trigger-log">
            {t('lidc.storyline.debug.lastTrigger', {
              eventId: lastTriggerEvent.eventId,
              label: lastTriggerEvent.label,
            })}
          </p>
        )}
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
