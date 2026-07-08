import { Ambulance, Blend, Factory, Forklift, Satellite } from 'lucide-react';
import './MapFilterBar.css';

const FILTER_ITEMS = [
  { key: 'showAto', icon: Blend, label: 'ATO', title: 'ATO' },
  { key: 'showLogistics', icon: Forklift, label: 'Logistics', title: 'Logistics' },
  { key: 'showDcsar', icon: Ambulance, label: 'CSAR', title: 'CSAR' },
  { key: 'showProductionPoints', icon: Factory, label: 'Production Points', title: 'Production Points' },
];

export default function MapFilterBar({
  filters,
  basemapMode,
  basemapModeSatellite,
  onToggleFilter,
  onToggleBasemap,
}) {
  return (
    <div className="map-filter-bar-wrap">
      <nav className="map-filter-bar" aria-label="Map layer filters">
        {FILTER_ITEMS.map(({ key, icon: Icon, label, title }) => {
          const isActive = Boolean(filters?.[key]);
          return (
            <button
              key={key}
              type="button"
              className={`map-filter-bar__item${isActive ? ' is-active' : ''}`}
              aria-label={`Toggle ${label}`}
              aria-pressed={isActive}
              title={title}
              onClick={() => onToggleFilter(key)}
            >
              <Icon className="map-filter-bar__icon" aria-hidden="true" />
            </button>
          );
        })}
        <span className="map-filter-bar__divider" aria-hidden="true" />
        <button
          type="button"
          className={`map-filter-bar__item${basemapMode === basemapModeSatellite ? ' is-active' : ''}`}
          aria-label="Toggle satellite basemap"
          aria-pressed={basemapMode === basemapModeSatellite}
          title="Satellite"
          onClick={onToggleBasemap}
        >
          <Satellite className="map-filter-bar__icon" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
