import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import './flower-menu.css';

// Petal card size (px): icon + label + one meta line (cost / subtitle / submenu).
const PETAL_W = 106;
const PETAL_H = 74;
const MIN_RADIUS = 104;
const HUB_SIZE = 30;
const PETAL_GAP = 10;

function petalOffset(index, count, radius) {
  // First item at the top, then clockwise.
  const angle = (-90 + (360 / count) * index) * (Math.PI / 180);
  return { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
}

/** Smallest ring radius (from MIN_RADIUS up) where no two cards come closer than PETAL_GAP. */
function ringRadius(count) {
  for (let radius = MIN_RADIUS; radius < 400; radius += 2) {
    const points = Array.from({ length: count }, (_, i) => petalOffset(i, count, radius));
    const clear = points.every((a, i) => points.every((b, j) => j <= i
      || Math.abs(a.x - b.x) >= PETAL_W + PETAL_GAP
      || Math.abs(a.y - b.y) >= PETAL_H + PETAL_GAP));
    if (clear) return radius;
  }
  return 400;
}

/** Ring, ticks and centre dot drawn in one SVG so they share the exact same centre (the clicked point). */
function HubReticle({ size }) {
  const c = size / 2;
  const r = c - 1;
  const tick = 5;
  return (
    <svg className="flower-menu__reticle" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="flower-menu__reticle-ring" cx={c} cy={c} r={r} />
      <path
        className="flower-menu__reticle-ticks"
        d={`M${c} ${c - r}v${tick} M${c} ${c + r}v${-tick} M${c - r} ${c}h${tick} M${c + r} ${c}h${-tick}`}
      />
      <circle className="flower-menu__reticle-dot" cx={c} cy={c} r={1.5} />
    </svg>
  );
}

/**
 * Radial action menu in the map panels' style (dark glass cards, hairline border, orange accent).
 * Items: { id, icon, label, meta?, metaTone?: 'cost' | 'mute', hasChildren?, onClick }.
 * The hub sits on the clicked point: centerOnClick (e.g. back) or, without it, it closes the menu.
 * title / caption: the header chip above the ring (current path, coordinates).
 */
export function FlowerMenu({
  menuItems,
  centerIcon: CenterIcon = null,
  centerLabel = 'Chiudi',
  centerOnClick = null,
  onClose = null,
  title = '',
  caption = '',
  animationDuration = 260,
  className,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const count = menuItems.length;
  const radius = ringRadius(count);
  const span = (radius + Math.max(PETAL_W, PETAL_H) / 2) * 2 + 8;

  // Open on the next frame so the petals animate out of the hub.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsOpen(true));
    return () => {
      window.cancelAnimationFrame(id);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleHub = (event) => {
    event.stopPropagation();
    if (centerOnClick) {
      centerOnClick();
      return;
    }
    setIsOpen(false);
    if (onClose) closeTimerRef.current = window.setTimeout(onClose, animationDuration * 0.7);
  };

  return (
    <nav
      className={cn('flower-menu', isOpen && 'is-open', className)}
      style={{ width: span, height: span, '--fm-duration': `${animationDuration}ms` }}
      aria-label={title || 'Menu azioni'}
    >
      {(title || caption) && (
        <div className="flower-menu__header" style={{ bottom: `calc(50% + ${radius + PETAL_H / 2 + 12}px)` }}>
          {title && <span className="flower-menu__title">{title}</span>}
          {caption && <span className="flower-menu__caption">{caption}</span>}
        </div>
      )}

      <ul className="flower-menu__ring">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const { x, y } = petalOffset(index, count, radius);
          return (
            <li
              key={item.id || item.label || index}
              className="flower-menu__slot"
              style={{
                '--fm-x': `${x}px`,
                '--fm-y': `${y}px`,
                '--fm-delay': `${index * 22}ms`,
                width: PETAL_W,
                height: PETAL_H,
              }}
            >
              <button
                type="button"
                className={cn('flower-menu__petal', item.hasChildren && 'has-children')}
                onClick={(event) => {
                  event.stopPropagation();
                  item.onClick?.(event);
                }}
                tabIndex={isOpen ? 0 : -1}
                title={item.title || item.label}
              >
                {Icon && <Icon className="flower-menu__icon" aria-hidden="true" />}
                <span className="flower-menu__label">{item.label}</span>
                {(item.meta || item.hasChildren) && (
                  <span className={cn('flower-menu__meta', item.metaTone === 'cost' && 'is-cost')}>
                    {item.meta}
                    {item.hasChildren && <ChevronRight className="flower-menu__more" aria-hidden="true" />}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className={cn('flower-menu__hub', centerOnClick && 'is-back')}
        style={{ width: HUB_SIZE, height: HUB_SIZE }}
        onClick={handleHub}
        aria-label={centerLabel}
        title={centerLabel}
      >
        {CenterIcon
          ? <CenterIcon className="flower-menu__hub-icon" aria-hidden="true" />
          : <HubReticle size={HUB_SIZE} />}
      </button>
    </nav>
  );
}

export const Component = FlowerMenu;
