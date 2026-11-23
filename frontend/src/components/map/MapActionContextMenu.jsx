import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  Boxes,
  ChevronLeft,
  Crosshair,
  Factory,
  Fuel,
  Hammer,
  Plane,
  PlaneLanding,
  Radar,
  Radio,
  Rocket,
  Shield,
  Target,
  Truck,
} from 'lucide-react';
import {
  MAP_CONTEXT_MENU_ROOT,
  resolveContextMenuNode,
} from '../../config/mapContextMenuConfig';
import { FlowerMenu } from '../ui/flower-menu';

const ICON_BY_KEY = {
  hammer: Hammer,
  shield: Shield,
  crosshair: Crosshair,
  factory: Factory,
  'plane-landing': PlaneLanding,
  radar: Radar,
  target: Target,
  plane: Plane,
  fuel: Fuel,
  radio: Radio,
  drone: Radio,
  tank: Truck,
  truck: Truck,
  rocket: Rocket,
  bomb: Rocket,
  anchor: Anchor,
  boxes: Boxes,
};

function resolveIcon(entry) {
  return ICON_BY_KEY[entry.icon] || Target;
}

function formatLatLon(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return '';
  return `${Math.abs(la).toFixed(3)}°${la >= 0 ? 'N' : 'S'}  ${Math.abs(lo).toFixed(3)}°${lo >= 0 ? 'E' : 'W'}`;
}

export default function MapActionContextMenu({
  menu,
  onClose,
  onSelectDbuild,
  onSelectTanker,
  onSelectMapAction,
}) {
  const [path, setPath] = useState([]);

  useEffect(() => {
    if (menu) setPath([]);
  }, [menu?.lat, menu?.lon]);

  const currentNode = useMemo(() => resolveContextMenuNode(path), [path]);
  const currentItems = currentNode?.children || MAP_CONTEXT_MENU_ROOT.children || [];

  const handleBack = useCallback(() => {
    setPath((current) => current.slice(0, -1));
  }, []);

  const handleItemClick = useCallback((entry) => {
    if (entry.action) {
      const { type, buildType, keyword } = entry.action;
      if (type === 'dbuild' && buildType) {
        onSelectDbuild(buildType);
        return;
      }
      if (type === 'tanker' && keyword) {
        onSelectTanker(keyword, entry.label || keyword);
        return;
      }
      onSelectMapAction?.({
        type,
        keyword,
        label: entry.label,
        subtitle: entry.subtitle,
        cost: entry.cost,
        lat: menu?.lat,
        lon: menu?.lon,
      });
      return;
    }
    if (entry.children?.length) {
      setPath((current) => [...current, entry.id]);
    }
  }, [menu, onSelectDbuild, onSelectMapAction, onSelectTanker]);

  const flowerItems = useMemo(() => currentItems.map((entry) => {
    const hasChildren = Boolean(entry.children?.length) && !entry.action;
    let meta = null;
    let metaTone = 'mute';
    if (Number.isFinite(Number(entry.cost)) && entry.cost !== null && entry.cost !== undefined) {
      meta = `${entry.cost} fp`;
      metaTone = 'cost';
    } else if (entry.subtitle) {
      meta = entry.subtitle;
    } else if (hasChildren) {
      meta = `${entry.children.length} voci`;
    }
    return {
      id: entry.id,
      icon: resolveIcon(entry),
      label: entry.label,
      title: [entry.label, entry.subtitle, entry.cost != null ? `${entry.cost} fp` : null].filter(Boolean).join(' · '),
      meta,
      metaTone,
      hasChildren,
      onClick: () => handleItemClick(entry),
    };
  }), [currentItems, handleItemClick]);

  // Esc: back one level, or close at the root.
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (path.length > 0) handleBack();
      else onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, path.length, handleBack, onClose]);

  if (!menu) return null;

  const atRoot = path.length === 0;
  const centerIcon = atRoot ? null : ChevronLeft;
  const trail = path.map((id) => resolveContextMenuNode(path.slice(0, path.indexOf(id) + 1))?.label || id);
  const title = atRoot ? 'Azioni' : trail.join(' › ');
  const caption = formatLatLon(menu.lat, menu.lon);

  return (
    <div
      className="absolute z-[1200] -translate-x-1/2 -translate-y-1/2"
      style={{ left: Math.round(menu.x), top: Math.round(menu.y) }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <FlowerMenu
        key={path.join('/') || 'root'}
        menuItems={flowerItems}
        centerIcon={centerIcon}
        centerLabel={atRoot ? 'Chiudi' : 'Indietro'}
        centerOnClick={atRoot ? null : handleBack}
        onClose={atRoot ? onClose : null}
        title={title}
        caption={caption}
      />
    </div>
  );
}
