import { Pencil } from 'lucide-react';
import {
  STRIP_DIRECTION,
  getStripModelClass,
  isPendingGroundCoordination,
  isPendingTowerCoordination,
} from './atcStripModel';
import AtcActionBar from './AtcActionBar';

function Cell({ label, children, className = '', split, labelCorner = 'tl' }) {
  return (
    <div className={`atc-cell atc-cell--label-${labelCorner} ${className}`}>
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

/** Mod. A/C/E — arrivi e sorvoli (layout ENAV) */
function ArrivalStrip({ strip }) {
  return (
    <div className="atc-strip__grid atc-strip__grid--arr">
      <div className="atc-strip__sec-ab">
        <div className="atc-cell atc-cell--a">
          <span className="atc-cell__label">A</span>
          <div className="atc-cell__value">
            <span className="atc-eta">{formatEtaDisplay(strip.eta)}</span>
          </div>
        </div>
        <div className="atc-cell atc-cell--b-corner">
          <span className="atc-cell__label">B</span>
          <div className="atc-cell__value">{strip.levelPlanned || strip.level || ''}</div>
        </div>
      </div>

      <Cell label="C" className="atc-cell--c">{strip.flightRule || ''}</Cell>

      <Cell label="D" className="atc-cell--d" labelCorner="br">
        <div className="atc-cell-d">
          <span className="atc-cell-d__origin">{strip.origin || ''}</span>
          <span className="atc-cell-d__type">
            {strip.aircraftType || ''}{strip.wakeCategory ? `/${strip.wakeCategory}` : ''}
          </span>
          <span className="atc-cell-d__callsign">{strip.callsign || ''}</span>
          <span className="atc-cell-d__tas">{strip.tas || ''}</span>
        </div>
      </Cell>

      <div className="atc-strip__sec-grid8">
        <Cell label="E" className="atc-cell--e">{strip.missedApproach || ''}</Cell>
        <Cell label="F" className="atc-cell--f">
          {strip.ata || ''}{strip.ataAcknowledged ? ' ✓' : ''}
        </Cell>
        <Cell label="G" className="atc-cell--g">{strip.pilotEstimate || ''}</Cell>
        <Cell label="H" className="atc-cell--h" split>
          <span>{strip.previousFix || ''}</span>
          <span>{strip.ato || ''}{strip.atl ? `/${strip.atl}` : ''}</span>
        </Cell>
        <Cell label="I" className="atc-cell--i">{strip.destination || ''}</Cell>
        <Cell label="J" className="atc-cell--j">{strip.localJ || ''}</Cell>
        <Cell label="K" className="atc-cell--k">{strip.localK || ''}</Cell>
        <Cell label="L" className="atc-cell--l">
          {strip.stand || ''}{strip.standAcknowledged ? ' ✓' : ''}
        </Cell>
      </div>

      <Cell label="M" className="atc-cell--m" labelCorner="br">{strip.remarks || ''}</Cell>
    </div>
  );
}

/** Mod. B/D — partenze (layout ENAV) */
function DepartureStrip({ strip }) {
  return (
    <div className="atc-strip__grid atc-strip__grid--dep">
      <div className="atc-strip__sec-dep-left">
        <div className="atc-strip__dep-row">
          <Cell label="A" className="atc-cell--a-dep">
            <span className="atc-eta">{formatEtaDisplay(strip.eobt)}</span>
          </Cell>
          <Cell label="B" className="atc-cell--b-dep">{strip.levelPlanned || ''}</Cell>
        </div>
        <div className="atc-strip__dep-row atc-strip__dep-row--triple">
          <Cell label="C" className="atc-cell--c-dep">{strip.flightRule || ''}</Cell>
          <Cell label="D" className="atc-cell--d-dep">
            <div className="atc-cell-d atc-cell-d--dep">
              <span className="atc-cell-d__callsign">{strip.callsign || ''}</span>
              <span className="atc-cell-d__type">{strip.aircraftType || ''}</span>
            </div>
          </Cell>
          <Cell label="E" className="atc-cell--e-dep">{strip.level || ''}</Cell>
        </div>
      </div>

      <Cell label="F" className="atc-cell--f-dep" labelCorner="br">
        {strip.runway || ''}{strip.sid ? ` ${strip.sid}` : ''}
      </Cell>

      <div className="atc-strip__sec-dep-mid">
        <div className="atc-strip__dep-row atc-strip__dep-row--triple">
          <Cell label="G" className="atc-cell--g-dep" split>
            <span>{strip.startup || ''}</span>
            <span>{strip.taxiAuth || ''}</span>
          </Cell>
          <Cell label="H" className="atc-cell--h-dep">{strip.clearanceTimes || ''}</Cell>
          <Cell label="I" className="atc-cell--i-dep">
            {strip.ssr || ''}{strip.delay ? ` ${strip.delay}` : ''}
          </Cell>
        </div>
        <Cell label="J" className="atc-cell--j-dep">{strip.route || strip.destination || ''}</Cell>
      </div>

      <div className="atc-strip__sec-dep-right">
        <Cell label="K" className="atc-cell--k-dep" labelCorner="tr">{strip.clearanceText || ''}</Cell>
        <Cell label="L" className="atc-cell--l-dep" labelCorner="br">{strip.instructions || ''}</Cell>
      </div>
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
  const pendingToc = isPendingTowerCoordination(strip);
  const pendingAog = isPendingGroundCoordination(strip);

  return (
    <div
      className={`atc-strip ${getStripModelClass(strip.model)} ${selected ? 'atc-strip--selected' : ''} ${pendingToc || pendingAog ? 'atc-strip--pending' : ''} ${strip.flags?.highlighted ? 'atc-strip--highlight' : ''} ${readOnly ? 'atc-strip--readonly' : ''}`}
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
      {pendingToc && <span className="atc-strip__badge">TOC</span>}
      {pendingAog && <span className="atc-strip__badge atc-strip__badge--aog">AOG</span>}
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
