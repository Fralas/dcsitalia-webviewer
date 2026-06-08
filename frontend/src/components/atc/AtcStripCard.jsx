import {
  STRIP_DIRECTION,
  getStripModelClass,
  getStripStateCode,
  isPendingGroundCoordination,
  isPendingTowerCoordination,
} from './atcStripModel';
import AtcActionBar from './AtcActionBar';
import AtcFitField from './AtcFitField';

function Cell({
  label,
  children,
  className = '',
  split,
  labelCorner = 'tl',
}) {
  return (
    <div className={`atc-cell atc-cell--label-${labelCorner} ${className}`}>
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
}) {
  return (
    <AtcFitField
      value={value ?? ''}
      editable={editable}
      uppercase={uppercase}
      maxLength={maxLength}
      className={className}
      inputMode={inputMode}
      placeholder={placeholder}
      maxFontSize={maxFontSize}
      onChange={(next) => onFieldChange?.(field, next)}
      onCommit={(next) => onFieldCommit?.(field, next)}
      onFocus={onFieldFocus}
      onBlur={onFieldBlur}
    />
  );
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

function ArrivalStrip({
  strip,
  editable,
  onFieldChange,
  onFieldCommit,
  onFieldFocus,
  onFieldBlur,
}) {
  const stateCode = getStripStateCode(strip);
  const bind = {
    editable,
    onFieldChange,
    onFieldCommit,
    onFieldFocus,
    onFieldBlur,
  };

  return (
    <div className="atc-strip__grid atc-strip__grid--arr">
      <div className="atc-strip__sec-ab">
        <div className="atc-cell atc-cell--a">
          <span className="atc-cell__label">A</span>
          <div className="atc-cell__value">
            <EtaField value={strip.eta} field="eta" {...bind} />
          </div>
        </div>
        <div className="atc-cell atc-cell--b-corner">
          <span className="atc-cell__label">B</span>
          <div className="atc-cell__value">
            <Field value={strip.levelPlanned || strip.level} field="levelPlanned" uppercase {...bind} />
          </div>
        </div>
      </div>

      <Cell label="C" className="atc-cell--c">
        <Field value={strip.flightRule} field="flightRule" uppercase maxLength={2} {...bind} />
      </Cell>

      <Cell label="D" className="atc-cell--d" labelCorner="br">
        <div className="atc-cell-d">
          <Field value={strip.origin} field="origin" uppercase className="atc-cell-d__origin" {...bind} />
          <span className="atc-cell-d__type">
            <Field value={strip.aircraftType} field="aircraftType" uppercase {...bind} />
            {strip.wakeCategory ? '/' : ''}
            <Field value={strip.wakeCategory} field="wakeCategory" uppercase maxLength={1} {...bind} />
          </span>
          <Field value={strip.callsign} field="callsign" uppercase className="atc-cell-d__callsign" maxFontSize={12} {...bind} />
          <Field value={strip.tas} field="tas" className="atc-cell-d__tas" inputMode="numeric" {...bind} />
        </div>
      </Cell>

      <div className="atc-strip__sec-grid8">
        <Cell label="E" className="atc-cell--e">
          <Field value={strip.missedApproach} field="missedApproach" uppercase {...bind} />
        </Cell>
        <Cell label="F" className="atc-cell--f">
          <Field value={strip.ata} field="ata" {...bind} />
          {strip.ataAcknowledged ? ' ✓' : ''}
        </Cell>
        <Cell label="G" className="atc-cell--g">
          <Field value={strip.pilotEstimate} field="pilotEstimate" {...bind} />
        </Cell>
        <Cell label="H" className="atc-cell--h" split>
          <Field value={strip.previousFix} field="previousFix" uppercase maxFontSize={9} {...bind} />
          <span className="atc-cell__split-row">
            <Field value={strip.ato} field="ato" maxFontSize={9} {...bind} />
            {strip.atl ? '/' : ''}
            <Field value={strip.atl} field="atl" maxFontSize={9} {...bind} />
          </span>
        </Cell>
        <Cell label="I" className="atc-cell--i">
          <Field value={strip.destination} field="destination" uppercase {...bind} />
        </Cell>
        <Cell label="J" className="atc-cell--j">
          <Field value={strip.localJ} field="localJ" {...bind} />
        </Cell>
        <Cell label="K" className="atc-cell--k">
          <Field value={strip.localK} field="localK" {...bind} />
        </Cell>
        <Cell label="L" className="atc-cell--l">
          <Field value={strip.stand} field="stand" uppercase {...bind} />
          {strip.standAcknowledged ? ' ✓' : ''}
        </Cell>
      </div>

      <Cell label="M" className="atc-cell--m" labelCorner="br">
        <span className="atc-state-row">
          {stateCode ? <span className="atc-state-code">{stateCode}</span> : null}
          <Field value={strip.remarks} field="remarks" {...bind} />
        </span>
      </Cell>
    </div>
  );
}

function DepartureStrip({
  strip,
  editable,
  onFieldChange,
  onFieldCommit,
  onFieldFocus,
  onFieldBlur,
}) {
  const stateCode = getStripStateCode(strip);
  const bind = {
    editable,
    onFieldChange,
    onFieldCommit,
    onFieldFocus,
    onFieldBlur,
  };

  return (
    <div className="atc-strip__grid atc-strip__grid--dep">
      <div className="atc-strip__sec-dep-left">
        <div className="atc-strip__dep-row">
          <Cell label="A" className="atc-cell--a-dep">
            <EtaField value={strip.eobt} field="eobt" {...bind} />
          </Cell>
          <Cell label="B" className="atc-cell--b-dep">
            <Field value={strip.levelPlanned} field="levelPlanned" uppercase {...bind} />
          </Cell>
        </div>
        <div className="atc-strip__dep-row atc-strip__dep-row--triple">
          <Cell label="C" className="atc-cell--c-dep">
            <Field value={strip.flightRule} field="flightRule" uppercase maxLength={2} {...bind} />
          </Cell>
          <Cell label="D" className="atc-cell--d-dep">
            <div className="atc-cell-d atc-cell-d--dep">
              <Field value={strip.callsign} field="callsign" uppercase className="atc-cell-d__callsign" maxFontSize={12} {...bind} />
              <Field value={strip.aircraftType} field="aircraftType" uppercase className="atc-cell-d__type" {...bind} />
            </div>
          </Cell>
          <Cell label="E" className="atc-cell--e-dep">
            <Field value={strip.level} field="level" uppercase {...bind} />
          </Cell>
        </div>
      </div>

      <Cell label="F" className="atc-cell--f-dep" labelCorner="br">
        <span className="atc-cell__split-row">
          <Field value={strip.runway} field="runway" uppercase maxFontSize={9} {...bind} />
          <Field value={strip.sid} field="sid" uppercase maxFontSize={9} {...bind} />
        </span>
      </Cell>

      <div className="atc-strip__sec-dep-mid">
        <div className="atc-strip__dep-row atc-strip__dep-row--triple">
          <Cell label="G" className="atc-cell--g-dep" split>
            <Field value={strip.startup} field="startup" uppercase maxFontSize={9} {...bind} />
            <Field value={strip.taxiAuth} field="taxiAuth" uppercase maxFontSize={9} {...bind} />
          </Cell>
          <Cell label="H" className="atc-cell--h-dep">
            <Field value={strip.clearanceTimes} field="clearanceTimes" {...bind} />
          </Cell>
          <Cell label="I" className="atc-cell--i-dep">
            <span className="atc-cell__split-row">
              <Field value={strip.ssr} field="ssr" maxFontSize={9} {...bind} />
              <Field value={strip.delay} field="delay" maxFontSize={9} {...bind} />
            </span>
          </Cell>
        </div>
        <Cell label="J" className="atc-cell--j-dep">
          <Field
            value={editable ? (strip.route ?? '') : (strip.route || strip.destination || '')}
            field="route"
            uppercase
            placeholder={strip.destination || ''}
            {...bind}
          />
        </Cell>
      </div>

      <div className="atc-strip__sec-dep-right">
        <Cell label="K" className="atc-cell--k-dep" labelCorner="tr">
          <span className="atc-state-row">
            {stateCode ? <span className="atc-state-code">{stateCode}</span> : null}
            <Field value={strip.clearanceText} field="clearanceText" {...bind} />
          </span>
        </Cell>
        <Cell label="L" className="atc-cell--l-dep" labelCorner="br">
          <Field value={strip.instructions} field="instructions" {...bind} />
        </Cell>
      </div>
    </div>
  );
}

export default function AtcStripCard({
  strip,
  selected = false,
  nextAction = null,
  onSelect,
  onFieldChange,
  onFieldCommit,
  onFieldFocus,
  onFieldBlur,
  onAction,
  onCoordinate,
  onCancelHandoff,
  operatorRole,
  readOnly = false,
  editable = false,
}) {
  const isArrival = strip.direction === STRIP_DIRECTION.ARR;
  const pendingToc = isPendingTowerCoordination(strip);
  const pendingAog = isPendingGroundCoordination(strip);
  const canEdit = editable && !readOnly;

  const handleFieldChange = (field, value) => onFieldChange?.(strip.id, field, value);
  const handleFieldCommit = (field, value) => onFieldCommit?.(strip.id, field, value);

  return (
    <div
      className={`atc-strip ${getStripModelClass(strip.model)} ${selected ? 'atc-strip--selected' : ''} ${pendingToc || pendingAog ? 'atc-strip--pending' : ''} ${strip.flags?.highlighted ? 'atc-strip--highlight' : ''} ${readOnly ? 'atc-strip--readonly' : ''} ${canEdit ? 'atc-strip--inline-edit' : ''}`}
      onClick={() => onSelect?.(strip)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSelect?.(strip);
      }}
    >
      {pendingToc && <span className="atc-strip__badge">TOC</span>}
      {pendingAog && <span className="atc-strip__badge atc-strip__badge--aog">AOG</span>}

      {isArrival ? (
        <ArrivalStrip
          strip={strip}
          editable={canEdit}
          onFieldChange={handleFieldChange}
          onFieldCommit={handleFieldCommit}
          onFieldFocus={onFieldFocus}
          onFieldBlur={onFieldBlur}
        />
      ) : (
        <DepartureStrip
          strip={strip}
          editable={canEdit}
          onFieldChange={handleFieldChange}
          onFieldCommit={handleFieldCommit}
          onFieldFocus={onFieldFocus}
          onFieldBlur={onFieldBlur}
        />
      )}

      {selected && !readOnly && (
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
