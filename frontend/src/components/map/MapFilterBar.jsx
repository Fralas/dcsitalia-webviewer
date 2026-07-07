import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ambulance, Blend, Factory, Forklift, Satellite } from 'lucide-react';
import './MapFilterBar.css';

const HEADER_FILTER_SLOT_ID = 'app-header-map-filters';

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
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    setSlot(document.getElementById(HEADER_FILTER_SLOT_ID));
  }, []);

  if (!slot) return null;

  return createPortal(
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
    </nav>,
    slot
  );
}
