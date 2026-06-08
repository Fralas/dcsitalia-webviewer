import { Pencil } from 'lucide-react';
import { COORDINATION_STATUS, STRIP_DIRECTION, getStripModelClass } from './atcStripModel';
import AtcActionBar from './AtcActionBar';

function Cell({ label, children, className = '', split }) {
  return (
    <div className={`atc-cell ${className}`}>
      <span className="atc-cell__label">{label}</span>
      <div className={`atc-cell__value ${split ? 'atc-cell__value--split' : ''}`}>{children}</div>
    </div>
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

function ArrivalStrip({ strip }) {
  return (
    <div className="atc-strip__grid atc-strip__grid--arr">
      <Cell label="A" className="atc-cell--a">
        <span className="atc-eta">{formatEtaDisplay(strip.eta)}</span>
      </Cell>
      <Cell label="B" className="atc-cell--b" />
      <Cell label="C" className="atc-cell--c">{strip.flightRule || ''}</Cell>
      <Cell label="D" className="atc-cell--d">
        <div className="atc-cell-d">
          <span className="atc-cell-d__origin">{strip.origin || ''}</span>
          <span className="atc-cell-d__type">{strip.aircraftType || ''}{strip.wakeCategory ? `/${strip.wakeCategory}` : ''}</span>
          <span className="atc-cell-d__callsign">{strip.callsign || ''}</span>
          <span className="atc-cell-d__tas">{strip.tas || ''}</span>
        </div>
      </Cell>
      <Cell label="E" className="atc-cell--e">{strip.missedApproach || ''}</Cell>
      <Cell label="I" className="atc-cell--i">{strip.destination || ''}</Cell>
      <Cell label="F" className="atc-cell--f">
        {strip.ata || ''}{strip.ataAcknowledged ? ' ✓' : ''}
      </Cell>
      <Cell label="J" className="atc-cell--j">{strip.localJ || ''}</Cell>
      <Cell label="G" className="atc-cell--g">{strip.pilotEstimate || ''}</Cell>
      <Cell label="K" className="atc-cell--k">{strip.localK || ''}</Cell>
      <Cell label="H" className="atc-cell--h" split>
        <span>{strip.previousFix || ''}</span>
        <span>{strip.ato || ''}{strip.atl ? `/${strip.atl}` : ''}</span>
      </Cell>
      <Cell label="L" className="atc-cell--l">
        {strip.stand || ''}{strip.standAcknowledged ? ' ✓' : ''}
      </Cell>
      <Cell label="M" className="atc-cell--m">{strip.remarks || ''}</Cell>
    </div>
  );
}

function DepartureStrip({ strip }) {
  return (
    <div className="atc-strip__grid atc-strip__grid--dep">
      <Cell label="F" className="atc-cell--f-top">{strip.runway || ''}{strip.sid ? ` ${strip.sid}` : ''}</Cell>
      <Cell label="A" className="atc-cell--a-dep">
        <span className="atc-eta">{formatEtaDisplay(strip.eobt)}</span>
      </Cell>
      <Cell label="B" className="atc-cell--b-dep">{strip.levelPlanned || strip.level || ''}</Cell>
      <Cell label="C" className="atc-cell--c-dep">{strip.flightRule || ''}</Cell>
      <Cell label="D" className="atc-cell--d-dep">
        <div className="atc-cell-d atc-cell-d--dep">
          <span className="atc-cell-d__callsign">{strip.callsign || ''}</span>
          <span className="atc-cell-d__type">{strip.aircraftType || ''}</span>
          <span className="atc-cell-d__dest">{strip.destination || ''}</span>
        </div>
      </Cell>
      <Cell label="E" className="atc-cell--e-dep">{strip.level || ''}</Cell>
      <Cell label="G" className="atc-cell--g-dep" split>
        <span>{strip.startup || ''}</span>
        <span>{strip.taxiAuth || ''}</span>
      </Cell>
      <Cell label="H" className="atc-cell--h-dep">{strip.clearanceTimes || ''}</Cell>
      <Cell label="I" className="atc-cell--i-dep">
        {strip.ssr || ''}{strip.delay ? ` ${strip.delay}` : ''}
      </Cell>
      <Cell label="K" className="atc-cell--k-dep">{strip.clearanceText || ''}</Cell>
      <Cell label="L" className="atc-cell--l-dep">{strip.instructions || ''}</Cell>
      <Cell label="J" className="atc-cell--j-dep">{strip.route || strip.destination || ''}</Cell>
    </div>
  );
}

export default function AtcStripCard({
  strip,
  selected = false,
  nextAction = null,
  onSelect,
  onEdit,
  onAction,
  onCoordinate,
  onCancelHandoff,
  operatorRole,
  readOnly = false,
}) {
  const isArrival = strip.direction === STRIP_DIRECTION.ARR;
  const pending = strip.coordinationStatus === COORDINATION_STATUS.PENDING_TOC;

  return (
    <div
      className={`atc-strip ${getStripModelClass(strip.model)} ${selected ? 'atc-strip--selected' : ''} ${pending ? 'atc-strip--pending' : ''} ${strip.flags?.highlighted ? 'atc-strip--highlight' : ''}`}
      onClick={() => onSelect?.(strip)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!readOnly) onEdit?.(strip);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSelect?.(strip);
        if (event.key === 'e' && !readOnly && selected) {
          event.preventDefault();
          onEdit?.(strip);
        }
      }}
    >
      {pending && <span className="atc-strip__badge">TOC</span>}
      {!readOnly && selected && (
        <button
          type="button"
          className="atc-strip__edit"
          title="Edit"
          onClick={(e) => { e.stopPropagation(); onEdit?.(strip); }}
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}

      {isArrival ? <ArrivalStrip strip={strip} /> : <DepartureStrip strip={strip} />}

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
