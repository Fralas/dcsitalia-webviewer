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

  const flowerItems = useMemo(() => currentItems.map((entry) => ({
    id: entry.id,
    icon: resolveIcon(entry),
    label: entry.label,
    onClick: () => handleItemClick(entry),
  })), [currentItems, handleItemClick]);

  if (!menu) return null;

  const atRoot = path.length === 0;
  const centerIcon = atRoot ? Crosshair : ChevronLeft;

  return (
    <div
      className="absolute z-[1200] -translate-x-1/2 -translate-y-1/2"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <FlowerMenu
        key={path.join('/') || 'root'}
        menuItems={flowerItems}
        defaultOpen
        centerIcon={centerIcon}
        centerOnClick={atRoot ? null : handleBack}
        onClose={atRoot ? onClose : null}
        closeDelay={200}
        togglerSize={36}
        petalOffset={28}
        labelMaxLength={11}
        animationDuration={380}
        iconColor="#ffffff"
        centerIconColor={atRoot ? '#FF8C00' : '#ffffff'}
        backgroundColor="#575757"
        borderColor="#575757"
        className="drop-shadow-[0_10px_26px_rgba(0,0,0,0.5)]"
      />
    </div>
  );
}
