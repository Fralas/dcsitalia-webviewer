import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

const MenuToggler = ({
  togglerId,
  isOpen,
  onChange,
  backgroundColor,
  iconColor,
  animationDuration,
  togglerSize,
  iconSize,
  centerIcon: CenterIcon,
  centerOnClick,
}) => {
  const lineHeight = iconSize * 0.1;
  const lineWidth = iconSize * 0.8;
  const lineSpacing = iconSize * 0.25;

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
          className="absolute inset-0 z-20 m-auto flex cursor-pointer items-center justify-center rounded-full border border-transparent transition-all"
          style={{
            backgroundColor,
            color: iconColor,
            transitionDuration: `${animationDuration}ms`,
            width: togglerSize,
            height: togglerSize,
          }}
          aria-label="Back"
        >
          {CenterIcon ? (
            <CenterIcon style={{ width: iconSize, height: iconSize }} aria-hidden="true" />
          ) : null}
        </button>
      ) : (
        <label
          htmlFor={togglerId}
          className="absolute inset-0 z-20 m-auto flex cursor-pointer items-center justify-center rounded-full border border-transparent transition-all"
          style={{
            backgroundColor,
            color: iconColor,
            transitionDuration: `${animationDuration}ms`,
            width: togglerSize,
            height: togglerSize,
          }}
        >
          {CenterIcon && !isOpen ? (
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
  iconColor,
  backgroundColor,
  animationDuration,
  itemCount,
  itemSize,
  iconSize,
  petalOffset,
}) => {
  const Icon = item.icon;

  return (
    <li
      className={cn('absolute inset-0 m-auto list-none transition-all', {
        'opacity-100': isOpen,
        'opacity-0': !isOpen,
      })}
      style={{
        width: itemSize,
        height: itemSize,
        transform: isOpen
          ? `rotate(${(360 / itemCount) * index}deg) translateX(-${itemSize + petalOffset}px)`
          : 'none',
        transitionDuration: `${animationDuration}ms`,
      }}
    >
      <button
        type="button"
        title={item.title || item.label || ''}
        aria-label={item.label || item.title || `Action ${index + 1}`}
        onClick={(event) => {
          event.stopPropagation();
          item.onClick?.(event);
        }}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full border border-transparent opacity-60 transition-all duration-100 group hover:scale-125 hover:opacity-100',
          {
            'pointer-events-auto': isOpen,
            'pointer-events-none': !isOpen,
          }
        )}
        style={{
          backgroundColor,
          color: iconColor,
          transform: `rotate(-${(360 / itemCount) * index}deg)`,
          transitionDuration: `${animationDuration}ms`,
        }}
      >
        <Icon
          className="transition-transform duration-200 group-hover:scale-125"
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
      </button>
    </li>
  );
};

export function FlowerMenu({
  menuItems,
  iconColor = 'white',
  backgroundColor = 'rgba(255, 255, 255, 0.2)',
  animationDuration = 500,
  togglerSize = 40,
  petalOffset = 30,
  defaultOpen = false,
  centerIcon = null,
  centerOnClick = null,
  className,
}) {
  const togglerId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen || Boolean(centerOnClick));
  const itemCount = menuItems.length;
  const itemSize = Math.round(togglerSize * 1.75);
  const iconSize = Math.max(20, Math.floor(togglerSize * 0.55));
  const menuSpan = togglerSize * 2.6;

  return (
    <nav
      className={cn('relative', className)}
      style={{ width: menuSpan, height: menuSpan, minHeight: menuSpan }}
      aria-label="Radial action menu"
    >
      <MenuToggler
        togglerId={togglerId}
        isOpen={isOpen}
        onChange={() => setIsOpen((value) => !value)}
        backgroundColor={backgroundColor}
        iconColor={iconColor}
        animationDuration={animationDuration}
        togglerSize={togglerSize}
        iconSize={iconSize}
        centerIcon={centerIcon}
        centerOnClick={centerOnClick}
      />
      <ul className="absolute inset-0 m-0 h-full w-full list-none p-0">
        {menuItems.map((item, index) => (
          <FlowerMenuItem
            key={item.id || item.label || index}
            item={item}
            index={index}
            isOpen={isOpen}
            iconColor={iconColor}
            backgroundColor={backgroundColor}
            animationDuration={animationDuration}
            itemCount={itemCount}
            itemSize={itemSize}
            iconSize={iconSize}
            petalOffset={petalOffset}
          />
        ))}
      </ul>
    </nav>
  );
}

export const Component = FlowerMenu;
