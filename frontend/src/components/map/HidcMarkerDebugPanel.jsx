import { useState } from 'react';
import { ChevronDown, ChevronUp, Crosshair, Eye, EyeOff, MapPin } from 'lucide-react';
import { DEBUG_MARKER_GROUPS, DEBUG_MARKER_TYPES } from '../../utils/hidcDebugMarkers';
import './HidcRegionVotePanel.css';
import './HidcFrontDebugPanel.css';
import './HidcMarkerDebugPanel.css';

/**
 * Marker debug tool, hidden: shown only with ?hidcDebug=1 (same flag as the front debug panel).
 * Toggles fake markers of every type around the anchor point, to check their look on the map.
 * Purely client-side: nothing is sent to the backend or DCS.
 *
 * @param {object} props
 * @param {Set<string>} props.enabled
 * @param {(next: Set<string>) => void} props.onChange
 * @param {string} props.anchorLabel
 * @param {() => void} props.onCenter
 * @param {boolean} props.shifted  true when the front debug panel sits in the same corner
 */
export default function HidcMarkerDebugPanel({ enabled, onChange, anchorLabel, onCenter, shifted }) {
  const [collapsed, setCollapsed] = useState(false);
  const total = DEBUG_MARKER_TYPES.length;

  const setMany = (ids, value) => {
    const next = new Set(enabled);
    ids.forEach((id) => (value ? next.add(id) : next.delete(id)));
    onChange(next);
  };
  const toggle = (id) => setMany([id], !enabled.has(id));

  return (
    <section
      className={`hidc-vote hidc-front-debug hidc-marker-debug${shifted ? ' is-shifted' : ''}`}
      aria-label="Debug marker"
    >
      <div className="hidc-vote__head hidc-front-debug__head">
        <span className="hidc-vote__head-copy">
          <span className="hidc-vote__kicker"><MapPin className="h-3 w-3" /> Debug marker</span>
          <span className="hidc-vote__title">
            {enabled.size}/{total} attivi
            <span className="hidc-vote__title-from"> · finti, solo questa pagina</span>
          </span>
        </span>
        <button type="button" className="hidc-vote__btn" onClick={onCenter} title={`Inquadra i marker di test (${anchorLabel})`}>
          <Crosshair className="h-3.5 w-3.5" /> Centra
        </button>
        <button
          type="button"
          className="hidc-vote__btn"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Espandi' : 'Riduci'}
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="hidc-vote__body hidc-marker-debug__body">
          <div className="hidc-front-debug__actions">
            <button type="button" className="hidc-vote__btn" onClick={() => setMany(DEBUG_MARKER_TYPES.map((type) => type.id), true)}>
              <Eye className="h-3.5 w-3.5" /> Tutti
            </button>
            <button type="button" className="hidc-vote__btn" onClick={() => onChange(new Set())}>
              <EyeOff className="h-3.5 w-3.5" /> Nessuno
            </button>
          </div>

          {DEBUG_MARKER_GROUPS.map((group) => {
            const types = DEBUG_MARKER_TYPES.filter((type) => type.group === group);
            const allOn = types.every((type) => enabled.has(type.id));
            return (
              <div key={group} className="hidc-marker-debug__group">
                <button
                  type="button"
                  className="hidc-marker-debug__group-head"
                  onClick={() => setMany(types.map((type) => type.id), !allOn)}
                  title={allOn ? 'Spegni il gruppo' : 'Accendi il gruppo'}
                >
                  <span>{group}</span>
                  <span className="hidc-vote__time">{types.filter((type) => enabled.has(type.id)).length}/{types.length}</span>
                </button>
                <div className="hidc-marker-debug__chips">
                  {types.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      className={`hidc-marker-debug__chip${enabled.has(type.id) ? ' is-on' : ''}`}
                      onClick={() => toggle(type.id)}
                      aria-pressed={enabled.has(type.id)}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <p className="hidc-vote__last hidc-front-debug__stats">Posizione: {anchorLabel}</p>
        </div>
      )}
    </section>
  );
}
