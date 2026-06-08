import { Maximize2 } from 'lucide-react';
import {
  STRIP_DIRECTION,
  getStripModelClass,
  getStripStateCode,
  isPendingGroundCoordination,
  isPendingTowerCoordination,
} from './atcStripModel';
import AtcActionBar from './AtcActionBar';
import AtcFitField from './AtcFitField';
import AtcStripInkOverlay from './AtcStripInkOverlay';
import { parseInkValue } from './atcInkCore';
import { t } from '../../utils/locale';

function Cell({
  label,
  children,
  className = '',
  split,
  labelCorner = 'tl',
}) {
  return (
    <div className={`atc-cell atc-cell--label-${labelCorner} ${className}`.trim()}>
      <span className="atc-cell__label">{label}</span>
      <div className={`atc-cell__value ${split ? 'atc-cell__value--split' : ''}`}>{children}</div>
    </div>
  );
}

function Field({
  value,
  field,
  editable,
  onFieldChange,
  onFieldCommit,
  onFieldFocus,
  onFieldBlur,
  uppercase,
  maxLength,
  className,
  inputMode,
  placeholder,
  maxFontSize,
  entryMode = 'keyboard',
}) {
  const common = {
    value: value ?? '',
    editable,
    className,
    onChange: (next) => onFieldChange?.(field, next),
    onCommit: (next) => onFieldCommit?.(field, next),
    onFocus: onFieldFocus,
    onBlur: onFieldBlur,
  };

  return (
    <AtcFitField
      {...common}
      uppercase={uppercase}
      maxLength={maxLength}
      inputMode={inputMode}
      placeholder={placeholder}
      maxFontSize={maxFontSize}
    />
  );
}

function PhaseTimes({ value }) {
  if (!value) return null;
  return <span className="atc-phase-times">{value}</span>;
}

function formatEtaDisplay(value) {
  if (!value || value.length < 4) return value || '';
  return (
    <>
      <span className="atc-eta__hh">{value.slice(0, 2)}</span>
      <span className="atc-eta__mm">{value.slice(2, 4)}</span>
    </>
  );
}

function EtaField({
  value,
  field,
  editable,
  onFieldChange,
  onFieldCommit,
  onFieldFocus,
  onFieldBlur,
}) {
  if (editable) {
    return (
      <Field
        value={value}
        field={field}
        editable
        onFieldChange={onFieldChange}
        onFieldCommit={onFieldCommit}
        onFieldFocus={onFieldFocus}
        onFieldBlur={onFieldBlur}
        maxLength={4}
        inputMode="numeric"
        placeholder="1420"
      />
    );
  }
  return <span className="atc-eta">{formatEtaDisplay(value)}</span>;
}

function fieldProps(bind, field, extra = {}) {
  const { entryMode, ...rest } = bind;
  const cellEditable = rest.editable && entryMode !== 'ink';
  return { ...rest, editable: cellEditable, field, entryMode, ...extra };
}

function ArrivalStrip({ strip, bind }) {
  const stateCode = getStripStateCode(strip);
  const fp = (field, opts = {}) => fieldProps(bind, field, opts);

  return (
    <div className="atc-strip__grid atc-strip__grid--arr">
      <div className="atc-strip__sec-ab">
        <Cell label="A" className="atc-cell--a">
          <EtaField value={strip.eta} field="eta" {...bind} />
        </Cell>
        <Cell label="B" className="atc-cell--b-corner">
          <Field value={strip.levelPlanned || strip.level} {...fp('levelPlanned', { uppercase: true })} />
        </Cell>
      </div>

      <Cell label="C" className="atc-cell--c" split>
        <Field value={strip.flightRule} {...fp('flightRule', { uppercase: true, maxLength: 2 })} />
        <Field value={strip.localC} {...fp('localC', { uppercase: true })} />
      </Cell>

      <Cell label="D" className="atc-cell--d" labelCorner="br">
        <div className="atc-cell-d">
          <Field value={strip.origin} {...fp('origin', { uppercase: true, className: 'atc-cell-d__origin' })} />
          <span className="atc-cell-d__type">
            <Field value={strip.aircraftType} {...fp('aircraftType', { uppercase: true })} />
            {strip.wakeCategory || bind.editable ? '/' : ''}
            <Field value={strip.wakeCategory} {...fp('wakeCategory', { uppercase: true, maxLength: 1 })} />
          </span>
          <Field value={strip.callsign} {...fp('callsign', { uppercase: true, className: 'atc-cell-d__callsign', maxFontSize: 14 })} />
          <Field value={strip.tas} {...fp('tas', { className: 'atc-cell-d__tas', inputMode: 'numeric' })} />
        </div>
      </Cell>

      <div className="atc-strip__sec-grid8">
        <Cell label="E" className="atc-cell--e">
          <Field value={strip.missedApproach} {...fp('missedApproach', { uppercase: true })} />
        </Cell>
        <Cell label="F" className="atc-cell--f">
          <Field value={strip.ata} {...fp('ata')} />
          {strip.ataAcknowledged ? ' ✓' : ''}
        </Cell>
        <Cell label="G" className="atc-cell--g">
          <Field value={strip.pilotEstimate} {...fp('pilotEstimate')} />
        </Cell>
        <Cell label="H" className="atc-cell--h" split>
          <Field value={strip.previousFix} {...fp('previousFix', { uppercase: true })} />
          <span className="atc-cell__split-row">
            <Field value={strip.ato} {...fp('ato')} />
            {strip.atl || bind.editable ? '/' : ''}
            <Field value={strip.atl} {...fp('atl')} />
          </span>
          <PhaseTimes value={strip.phaseTimes} />
        </Cell>
        <Cell label="I" className="atc-cell--i">
          <Field value={strip.destination} {...fp('destination', { uppercase: true })} />
        </Cell>
        <Cell label="J" className="atc-cell--j">
          <Field value={strip.localJ} {...fp('localJ')} />
        </Cell>
        <Cell label="K" className="atc-cell--k">
          <Field value={strip.localK} {...fp('localK')} />
        </Cell>
        <Cell label="L" className="atc-cell--l">
          <Field value={strip.stand} {...fp('stand', { uppercase: true })} />
          {strip.standAcknowledged ? ' ✓' : ''}
        </Cell>
      </div>

      <Cell label="M" className="atc-cell--m atc-cell--remarks" labelCorner="br">
        <span className="atc-state-row">
          {stateCode ? <span className="atc-state-code">{stateCode}</span> : null}
          <Field value={strip.remarks} {...fp('remarks')} />
        </span>
      </Cell>
    </div>
  );
}

function DepartureStrip({ strip, bind }) {
  const stateCode = getStripStateCode(strip);
  const fp = (field, opts = {}) => fieldProps(bind, field, opts);

  return (
    <div className="atc-strip__grid atc-strip__grid--dep">
      <div className="atc-strip__sec-dep-left">
        <div className="atc-strip__dep-row">
          <Cell label="A" className="atc-cell--a-dep">
            <EtaField value={strip.eobt} field="eobt" {...bind} />
          </Cell>
          <Cell label="B" className="atc-cell--b-dep">
            <Field value={strip.levelPlanned} {...fp('levelPlanned', { uppercase: true })} />
          </Cell>
        </div>
        <div className="atc-strip__dep-row atc-strip__dep-row--triple">
          <Cell label="C" className="atc-cell--c-dep">
            <Field value={strip.flightRule} {...fp('flightRule', { uppercase: true, maxLength: 2 })} />
          </Cell>
          <Cell label="D" className="atc-cell--d-dep">
            <div className="atc-cell-d atc-cell-d--dep">
              <Field value={strip.callsign} {...fp('callsign', { uppercase: true, className: 'atc-cell-d__callsign' })} />
              <Field value={strip.aircraftType} {...fp('aircraftType', { uppercase: true, className: 'atc-cell-d__type' })} />
            </div>
          </Cell>
          <Cell label="E" className="atc-cell--e-dep">
            <Field value={strip.level} {...fp('level', { uppercase: true })} />
          </Cell>
        </div>
      </div>

      <Cell label="F" className="atc-cell--f-dep" labelCorner="br">
        <span className="atc-cell__split-row">
          <Field value={strip.runway} {...fp('runway', { uppercase: true })} />
          <Field value={strip.sid} {...fp('sid', { uppercase: true })} />
        </span>
      </Cell>

      <div className="atc-strip__sec-dep-mid">
        <div className="atc-strip__dep-row atc-strip__dep-row--triple">
          <Cell label="G" className="atc-cell--g-dep" split>
            <Field value={strip.startup} {...fp('startup', { uppercase: true })} />
            <Field value={strip.taxiAuth} {...fp('taxiAuth', { uppercase: true })} />
          </Cell>
          <Cell label="H" className="atc-cell--h-dep">
            <Field value={strip.clearanceTimes} {...fp('clearanceTimes')} />
          </Cell>
          <Cell label="I" className="atc-cell--i-dep">
            <span className="atc-cell__split-row">
              <Field value={strip.ssr} {...fp('ssr')} />
              <Field value={strip.delay} {...fp('delay')} />
            </span>
          </Cell>
        </div>
        <Cell label="J" className="atc-cell--j-dep atc-cell--route">
          <Field
            value={bind.editable ? (strip.route ?? '') : (strip.route || strip.destination || '')}
            {...fp('route', { uppercase: true, placeholder: strip.destination || '' })}
          />
        </Cell>
      </div>

      <div className="atc-strip__sec-dep-right">
        <Cell label="K" className="atc-cell--k-dep atc-cell--clearance" labelCorner="tr">
          <span className="atc-state-row">
            {stateCode ? <span className="atc-state-code">{stateCode}</span> : null}
            <Field value={strip.clearanceText} {...fp('clearanceText')} />
          </span>
        </Cell>
        <Cell label="L" className="atc-cell--l-dep atc-cell--instructions" labelCorner="br" split>
          <Field value={strip.instructions} {...fp('instructions')} />
          <PhaseTimes value={strip.phaseTimes} />
        </Cell>
      </div>
    </div>
  );
}

export default function AtcStripCard({
  strip,
  variant = 'board',
  selected = false,
  nextAction = null,
  onSelect,
  onMoveArm,
  moveArmed = false,
  onExpand,
  onFieldChange,
  onFieldCommit,
  onFieldFocus,
  onFieldBlur,
  entryMode = 'keyboard',
  onAction,
  onCoordinate,
  onCancelHandoff,
  operatorRole,
  readOnly = false,
  editable = false,
  showActionBar = false,
  interactive = true,
}) {
  const isArrival = strip.direction === STRIP_DIRECTION.ARR;
  const pendingToc = isPendingTowerCoordination(strip);
  const pendingAog = isPendingGroundCoordination(strip);
  const canEdit = editable && !readOnly;
  const inkMode = canEdit && entryMode === 'ink';
  const hasInk = Boolean(parseInkValue(strip.stripInk));

  const handleFieldChange = (field, value) => onFieldChange?.(strip.id, field, value);
  const handleFieldCommit = (field, value) => onFieldCommit?.(strip.id, field, value);

  const bind = {
    editable: canEdit,
    variant,
    entryMode,
    onFieldChange: handleFieldChange,
    onFieldCommit: handleFieldCommit,
    onFieldFocus,
    onFieldBlur,
  };

  const actionVisible = (showActionBar || (selected && variant === 'board')) && !readOnly;

  return (
    <div
      className={[
        'atc-strip',
        getStripModelClass(strip.model),
        `atc-strip--${variant}`,
        selected ? 'atc-strip--selected' : '',
        pendingToc || pendingAog ? 'atc-strip--pending' : '',
        strip.flags?.highlighted ? 'atc-strip--highlight' : '',
        readOnly ? 'atc-strip--readonly' : '',
        canEdit ? 'atc-strip--inline-edit' : '',
        inkMode ? 'atc-strip--ink-mode' : '',
        moveArmed ? 'atc-strip--move-armed' : '',
        hasInk && !inkMode ? 'atc-strip--has-ink' : '',
        interactive ? 'atc-strip--interactive' : '',
      ].filter(Boolean).join(' ')}
      onClick={interactive && !inkMode ? (event) => {
        event.stopPropagation();
        onSelect?.(strip);
      } : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === 'Enter') onSelect?.(strip);
      } : undefined}
      onDoubleClick={interactive && onExpand ? (event) => {
        if (window.matchMedia('(pointer: coarse)').matches) return;
        event.stopPropagation();
        onExpand(strip);
      } : undefined}
      onContextMenu={canEdit && inkMode ? (event) => {
        event.preventDefault();
        event.stopPropagation();
        onMoveArm?.(strip);
      } : undefined}
    >
      {pendingToc && <span className="atc-strip__badge">TOC</span>}
      {pendingAog && <span className="atc-strip__badge atc-strip__badge--aog">AOG</span>}

      {interactive && onExpand && variant === 'board' && (
        <button
          type="button"
          className="atc-strip__expand"
          title={t('atc.focus.open')}
          onClick={(event) => {
            event.stopPropagation();
            onExpand(strip);
          }}
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      )}

      <div className="atc-strip__surface">
        {isArrival ? <ArrivalStrip strip={strip} bind={bind} /> : <DepartureStrip strip={strip} bind={bind} />}
        {(inkMode || hasInk) && (
          <AtcStripInkOverlay
            value={strip.stripInk || ''}
            editable={inkMode && !moveArmed}
            onChange={(next) => handleFieldChange('stripInk', next)}
            onCommit={(next) => handleFieldCommit('stripInk', next)}
            onLongPress={inkMode && !moveArmed ? () => onMoveArm?.(strip) : undefined}
            onDoubleTap={interactive && onExpand ? () => onExpand(strip) : undefined}
          />
        )}
      </div>

      {actionVisible && (
        <AtcActionBar
          strip={strip}
          nextAction={nextAction}
          operatorRole={operatorRole}
          onAction={onAction}
          onCoordinate={onCoordinate}
          onCancelHandoff={onCancelHandoff}
        />
      )}
    </div>
  );
}
