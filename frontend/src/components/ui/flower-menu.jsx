import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import './flower-menu.css';

const DEFAULT_LABEL_MAX_LENGTH = 13;

function truncateMenuLabel(label = '', maxLength = DEFAULT_LABEL_MAX_LENGTH) {
  const text = String(label || '').trim().toUpperCase();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function getFlowerLayout({ togglerSize, itemCount, petalOffset, hasLabels = true }) {
  const labelExtra = hasLabels ? 22 : 0;
  let densityScale = 1;
  if (itemCount > 7) densityScale = 0.76;
  else if (itemCount > 5) densityScale = 0.88;

  const itemSize = Math.round(togglerSize * 1.75 * densityScale);
  const iconSize = Math.max(16, Math.floor(togglerSize * 0.52 * densityScale));
  const countBoost = Math.max(0, itemCount - 4) * (hasLabels ? 11 : 7);
  const effectivePetalOffset = petalOffset + countBoost;
  const outerRadius = itemSize + effectivePetalOffset + labelExtra;
  const menuSpan = Math.max(togglerSize * 2.85, outerRadius * 2 + itemSize * 0.35);

  return { itemSize, iconSize, effectivePetalOffset, menuSpan };
}

const MenuToggler = ({
  togglerId,
  isOpen,
  onChange,
  animationDuration,
  togglerSize,
  iconSize,
  centerIcon: CenterIcon,
  centerOnClick,
}) => {
  const lineHeight = iconSize * 0.1;
  const lineWidth = iconSize * 0.8;
  const lineSpacing = iconSize * 0.25;
  const hubStyle = {
    width: togglerSize,
    height: togglerSize,
  };

  return (
    <>
      {!centerOnClick && (
        <input
          id={togglerId}
          type="checkbox"
          checked={isOpen}
          onChange={onChange}
          className="absolute inset-0 z-10 m-auto cursor-pointer opacity-0"
          style={{ width: togglerSize, height: togglerSize }}
        />
      )}
      {centerOnClick ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            centerOnClick();
          }}
          className="flower-menu__hub absolute inset-0 z-20 m-auto flex cursor-pointer items-center justify-center rounded-full"
          style={hubStyle}
          aria-label="Back"
        >
          {CenterIcon ? (
            <CenterIcon style={{ width: iconSize, height: iconSize }} aria-hidden="true" />
          ) : null}
        </button>
      ) : (
        <label
          htmlFor={togglerId}
          className="flower-menu__hub absolute inset-0 z-20 m-auto flex cursor-pointer items-center justify-center rounded-full"
          style={hubStyle}
        >
          {CenterIcon ? (
            <CenterIcon style={{ width: iconSize, height: iconSize }} aria-hidden="true" />
          ) : (
            <span
              className="relative flex flex-col items-center justify-center"
              style={{ width: iconSize, height: iconSize }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn('absolute bg-current transition-all', {
                    'opacity-0': isOpen && i === 0,
                    'rotate-45': isOpen && i === 1,
                    '-rotate-45': isOpen && i === 2,
                  })}
                  style={{
                    transitionDuration: `${animationDuration}ms`,
                    width: lineWidth,
                    height: lineHeight,
                    top: isOpen
                      ? `calc(50% - ${lineHeight / 2}px)`
                      : `calc(50% + ${(i - 1) * lineSpacing}px - ${lineHeight / 2}px)`,
                  }}
                />
              ))}
            </span>
          )}
        </label>
      )}
    </>
  );
};

const FlowerMenuItem = ({
  item,
  index,
  isOpen,
  animationDuration,
  itemCount,
  itemSize,
  iconSize,
  labelMaxLength,
  effectivePetalOffset,
}) => {
  const Icon = item.icon;
  const displayLabel = truncateMenuLabel(item.label, labelMaxLength);
  const ariaLabel = item.label || item.title || `Action ${index + 1}`;

  return (
    <li
      className={cn('absolute inset-0 m-auto list-none overflow-visible transition-all', {
        'opacity-100': isOpen,
        'opacity-0': !isOpen,
      })}
      style={{
        width: itemSize,
        height: itemSize,
        transform: isOpen
          ? `rotate(${(360 / itemCount) * index}deg) translateX(-${itemSize + effectivePetalOffset}px)`
          : 'none',
        transitionDuration: `${animationDuration}ms`,
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={(event) => {
          event.stopPropagation();
          item.onClick?.(event);
        }}
        className={cn(
          'flower-menu__petal flex w-full flex-col items-center justify-center gap-1 border-0 bg-transparent p-0',
          {
            'pointer-events-auto': isOpen,
            'pointer-events-none': !isOpen,
          }
        )}
        style={{
          transform: `rotate(-${(360 / itemCount) * index}deg)`,
          transitionDuration: `${animationDuration}ms`,
        }}
      >
        <span
          className="flower-menu__petal-icon flex items-center justify-center rounded-full"
          style={{ width: itemSize, height: itemSize }}
        >
          <Icon
            style={{ width: iconSize, height: iconSize }}
            aria-hidden="true"
          />
        </span>
        {displayLabel ? (
          <span className="flower-menu__label">
            {displayLabel}
          </span>
        ) : null}
      </button>
    </li>
  );
};

export function FlowerMenu({
  menuItems,
  iconColor = '#EDEDED',
  centerIconColor = '#FF8C00',
  backgroundColor = 'rgba(18, 18, 18, 0.94)',
  borderColor = 'rgba(255, 255, 255, 0.16)',
  animationDuration = 280,
  togglerSize = 40,
  petalOffset = 30,
  labelMaxLength = DEFAULT_LABEL_MAX_LENGTH,
  defaultOpen = false,
  centerIcon = null,
  centerOnClick = null,
  onClose = null,
  closeDelay = null,
  className,
}) {
  const togglerId = useId();
  const closeTimerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(defaultOpen || Boolean(centerOnClick));
  const itemCount = menuItems.length;
  const layout = getFlowerLayout({ togglerSize, itemCount, petalOffset, hasLabels: true });
  const { itemSize, iconSize, effectivePetalOffset, menuSpan } = layout;

  useEffect(() => () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  const handleToggle = () => {
    setIsOpen((open) => {
      if (open) {
        if (onClose) {
          if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
          const dismissAfterMs = closeDelay ?? animationDuration;
          closeTimerRef.current = window.setTimeout(onClose, dismissAfterMs);
          return false;
        }
        return false;
      }
      return true;
    });
  };

  return (
    <nav
      className={cn('flower-menu relative overflow-visible', isOpen && 'is-open', className)}
      style={{
        width: menuSpan,
        height: menuSpan,
        minHeight: menuSpan,
        '--fm-fill': backgroundColor,
        '--fm-border': borderColor,
        '--fm-icon': iconColor,
        '--fm-center': centerIconColor || iconColor,
        '--fm-duration': `${animationDuration}ms`,
      }}
      aria-label="Radial action menu"
    >
      <MenuToggler
        togglerId={togglerId}
        isOpen={isOpen}
        onChange={handleToggle}
        animationDuration={animationDuration}
        togglerSize={togglerSize}
        iconSize={iconSize}
        centerIcon={centerIcon}
        centerOnClick={centerOnClick}
      />
      <ul className="absolute inset-0 m-0 h-full w-full list-none overflow-visible p-0">
        {menuItems.map((item, index) => (
          <FlowerMenuItem
            key={item.id || item.label || index}
            item={item}
            index={index}
            isOpen={isOpen}
            animationDuration={animationDuration}
            itemCount={itemCount}
            itemSize={itemSize}
            iconSize={iconSize}
            effectivePetalOffset={effectivePetalOffset}
            labelMaxLength={labelMaxLength}
          />
        ))}
      </ul>
    </nav>
  );
}

export const Component = FlowerMenu;
