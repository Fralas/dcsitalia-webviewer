import { useMemo } from 'react';
import { Crosshair, Fuel, Hammer, PlaneLanding, Radar, Shield, Target } from 'lucide-react';
import { FlowerMenu } from '../ui/flower-menu';

const DBUILD_CATALOG_FALLBACK = [
  { id: 'mortar', label: 'Mortar' },
  { id: 'ewr', label: 'EWR' },
  { id: 'nasams', label: 'NASAMS' },
  { id: 'rapier', label: 'Rapier' },
  { id: 'farp', label: 'FARP' },
];

const TANKER_OPTIONS_FALLBACK = [
  { keyword: 'BOOM', label: 'BOOM' },
  { keyword: 'BASKET', label: 'BASKET' },
];

const DBUILD_ICON_BY_ID = {
  mortar: Target,
  ewr: Radar,
  nasams: Shield,
  rapier: Crosshair,
  farp: PlaneLanding,
};

export default function MapActionContextMenu({
  menu,
  catalog,
  tankerOptions,
  onSelectDbuild,
  onSelectTanker,
}) {
  const menuItems = useMemo(() => {
    const entries = catalog.length > 0 ? catalog : DBUILD_CATALOG_FALLBACK;
    const tankers = tankerOptions.length > 0 ? tankerOptions : TANKER_OPTIONS_FALLBACK;

    return [
      ...entries.map((entry) => ({
        id: `dbuild-${entry.id}`,
        icon: DBUILD_ICON_BY_ID[entry.id] || Hammer,
        label: entry.label || entry.id,
        onClick: () => onSelectDbuild(entry.id),
      })),
      ...tankers.map((entry) => ({
        id: `tanker-${entry.keyword}`,
        icon: Fuel,
        label: entry.label || entry.keyword,
        title: entry.platform ? `${entry.label || entry.keyword} · ${entry.platform}` : undefined,
        onClick: () => onSelectTanker(entry.keyword, entry.label || entry.keyword),
      })),
    ];
  }, [catalog, tankerOptions, onSelectDbuild, onSelectTanker]);

  if (!menu) return null;

  return (
    <div
      className="absolute z-[1200] -translate-x-1/2 -translate-y-1/2"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <FlowerMenu
        menuItems={menuItems}
        defaultOpen
        centerIcon={Hammer}
        togglerSize={44}
        animationDuration={420}
        iconColor="#f8fafc"
        backgroundColor="rgba(21, 25, 37, 0.88)"
        className="drop-shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
      />
    </div>
  );
}
