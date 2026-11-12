import { useMemo } from 'react';
import { Bug, Crosshair, RotateCcw, Shuffle, Swords, Undo2 } from 'lucide-react';
import { HIDC_REGION_BORDERS, HIDC_ZONE_LINKS } from '../../config/hidcRegionBorders';
import './HidcRegionVotePanel.css';
import './HidcFrontDebugPanel.css';

/**
 * Front line debug tool (enable with ?hidcDebug=1, disable with ?hidcDebug=0).
 * Purely client-side: overrides the active/base region and zone statuses fed to the region
 * borders + front line on this page only. Nothing is sent to the backend or DCS.
 */

const STATUS_CYCLE = ['RED', 'UNDER_ATTACK', 'BLUE'];
const REGION_IDS = HIDC_REGION_BORDERS.features.map((feature) => feature.properties.id);
const ZONES_BY_REGION = new Map(HIDC_REGION_BORDERS.features.map((feature) => [feature.properties.id, feature.properties.zones || []]));
const REGION_OF_ZONE = new Map();
ZONES_BY_REGION.forEach((zones, regionId) => zones.forEach((zoneId) => REGION_OF_ZONE.set(zoneId, regionId)));

function regionLabel(regionId) {
  const match = String(regionId || '').match(/^REGION_(\d+)$/);
  return match ? `Region ${match[1]}` : '—';
}

function linkedRegions(regionId) {
  const out = new Set();
  (ZONES_BY_REGION.get(regionId) || []).forEach((zoneId) => {
    (HIDC_ZONE_LINKS[zoneId] || []).forEach((neighborId) => {
      const other = REGION_OF_ZONE.get(neighborId);
      if (other && other !== regionId) out.add(other);
    });
  });
  return [...out].sort();
}

function normalizeStatus(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'BLUE' || value === 'UNDER_ATTACK') return value;
  return 'RED';
}

function pickRandom(list) {
  return list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null;
}

export function readHidcDebugFlag() {
  if (typeof window === 'undefined') return false;
  try {
    const query = new URLSearchParams(window.location.search);
    if (query.has('hidcDebug')) {
      if (query.get('hidcDebug') === '0') window.localStorage.removeItem('hidcDebug');
      else window.localStorage.setItem('hidcDebug', '1');
    }
    return window.localStorage.getItem('hidcDebug') === '1';
  } catch {
    return false;
  }
}

/**
 * @param {object} props
 * @param {object|null} props.liveCampaign
 * @param {object} props.liveZoneStatus  zoneId -> live status
 * @param {object|null} props.debug      { target, from, overrides } or null (live)
 * @param {(next: object|null) => void} props.onChange
 * @param {object|null} props.stats      front line stats from HidcRegionBorders
 */
export default function HidcFrontDebugPanel({ liveCampaign, liveZoneStatus, debug, onChange, stats }) {
  const liveTarget = liveCampaign?.focus?.target || null;
  const liveFrom = liveCampaign?.focus?.from || null;
  const target = debug?.target ?? liveTarget;
  const from = debug?.from ?? liveFrom;
  const overrides = debug?.overrides || {};

  const statusOf = (zoneId) => normalizeStatus(overrides[zoneId] ?? liveZoneStatus[zoneId]);
  const baseOptions = useMemo(() => (target ? linkedRegions(target) : []), [target]);
  const targetZones = ZONES_BY_REGION.get(target) || [];
  const fromZones = ZONES_BY_REGION.get(from) || [];
  const blueCount = targetZones.filter((zoneId) => statusOf(zoneId) === 'BLUE').length;

  const update = (patch) => onChange({ target, from, overrides, ...debug, ...patch });

  const setTarget = (nextTarget) => {
    const bases = linkedRegions(nextTarget);
    update({ target: nextTarget, from: bases.includes(from) ? from : (bases[0] || null), overrides: {} });
  };

  const cycleZone = (zoneId) => {
    const current = statusOf(zoneId);
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    update({ overrides: { ...overrides, [zoneId]: next } });
  };

  // Random conquest/loss on the front: a RED target zone linked to a BLUE zone (or the reverse).
  const randomFlip = (toBlue) => {
    const pool = targetZones.filter((zoneId) => {
      const side = statusOf(zoneId);
      if (toBlue ? side === 'BLUE' : side !== 'BLUE') return false;
      return (HIDC_ZONE_LINKS[zoneId] || []).some((neighborId) => {
        const inPlay = targetZones.includes(neighborId) || fromZones.includes(neighborId);
        if (!inPlay) return false;
        const neighborSide = statusOf(neighborId);
        return toBlue ? neighborSide === 'BLUE' : neighborSide !== 'BLUE';
      });
    });
    const zoneId = pickRandom(pool);
    if (zoneId) update({ overrides: { ...overrides, [zoneId]: toBlue ? 'BLUE' : 'RED' } });
  };

  return (
    <section className="hidc-vote hidc-front-debug" aria-label="Debug fronte">
      <div className="hidc-vote__head hidc-front-debug__head">
        <span className="hidc-vote__head-copy">
          <span className="hidc-vote__kicker"><Bug className="h-3 w-3" /> Debug fronte</span>
          <span className="hidc-vote__title">
            {debug ? 'Simulazione' : 'Stato live'}
            <span className="hidc-vote__title-from"> · solo questa pagina</span>
          </span>
        </span>
        {target && (
          <button
            type="button"
            className="hidc-vote__btn"
            onClick={() => window.dispatchEvent(new CustomEvent('hidc:fit-regions', { detail: [target, from].filter(Boolean) }))}
            title="Inquadra regione attiva e base"
          >
            <Crosshair className="h-3.5 w-3.5" /> Centra
          </button>
        )}
        {debug && (
          <button type="button" className="hidc-vote__btn" onClick={() => onChange(null)} title="Torna allo stato live">
            <Undo2 className="h-3.5 w-3.5" /> Live
          </button>
        )}
      </div>

      <div className="hidc-vote__body">
        <div className="hidc-front-debug__selects">
          <label className="hidc-vote__field">
            <span>Regione attiva</span>
            <select value={target || ''} onChange={(event) => setTarget(event.target.value || null)}>
              <option value="">—</option>
              {REGION_IDS.map((regionId) => (
                <option key={regionId} value={regionId}>{regionLabel(regionId)}{regionId === liveTarget ? ' (live)' : ''}</option>
              ))}
            </select>
          </label>
          <label className="hidc-vote__field">
            <span>Base BLUE</span>
            <select value={from || ''} onChange={(event) => update({ from: event.target.value || null })} disabled={!target}>
              <option value="">—</option>
              {baseOptions.map((regionId) => (
                <option key={regionId} value={regionId}>{regionLabel(regionId)}{regionId === liveFrom ? ' (live)' : ''}</option>
              ))}
            </select>
          </label>
        </div>

        {target && (
          <>
            <div className="hidc-vote__row">
              <span className="hidc-vote__label">Zone {regionLabel(target)}</span>
              <span className="hidc-vote__time">{blueCount}/{targetZones.length} BLUE</span>
            </div>
            <div className="hidc-front-debug__zones">
              {targetZones.map((zoneId) => {
                const status = statusOf(zoneId);
                return (
                  <button
                    key={zoneId}
                    type="button"
                    className={`hidc-front-debug__zone is-${status.toLowerCase()}${overrides[zoneId] ? ' is-override' : ''}`}
                    onClick={() => cycleZone(zoneId)}
                    title={`${zoneId}: ${status} (clic per cambiare)`}
                  >
                    {zoneId.replace('zone_', '')}
                  </button>
                );
              })}
            </div>
            <div className="hidc-front-debug__actions">
              <button type="button" className="hidc-vote__btn" onClick={() => randomFlip(true)}>
                <Swords className="h-3.5 w-3.5" /> Conquista
              </button>
              <button type="button" className="hidc-vote__btn" onClick={() => randomFlip(false)}>
                <Shuffle className="h-3.5 w-3.5" /> Perdi
              </button>
              <button type="button" className="hidc-vote__btn" onClick={() => update({ overrides: {} })}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset zone
              </button>
            </div>
          </>
        )}

        <p className="hidc-vote__last hidc-front-debug__stats">
          {stats
            ? `Fronte: ${stats.lines} tratti · ${stats.lengthKm} km · ${stats.ms} ms · griglia ${stats.grid || '—'}`
            : 'Fronte: nessun calcolo'}
        </p>
      </div>
    </section>
  );
}
