import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gamepad2, Layers3, Maximize2, Minimize2, Radar, ShieldCheck, Truck } from 'lucide-react';
import armoredImg from '../assets/vehicles/armored.png';
import utilityImg from '../assets/vehicles/utility.png';
import attackHeliImg from '../assets/vehicles/attack-heli.png';
import airDefenseImg from '../assets/vehicles/air-defense.png';
import transportHeliImg from '../assets/vehicles/transport-heli.png';
import fuelTruckImg from '../assets/vehicles/fuel-truck.png';

const GAMEPLAY_FEATURES = [
  {
    id: 'territory',
    title: 'Frontline Dinamico',
    description: 'Le zone cambiano stato in tempo reale. Ogni conquista modifica il bilanciamento del fronte.',
    Icon: Radar,
  },
  {
    id: 'logistics',
    title: 'Logistica Strategica',
    description: 'Gestione di rifornimenti, rotte e priorita missioni per mantenere operative le basi.',
    Icon: Truck,
  },
  {
    id: 'combined',
    title: 'Operazioni Combined Arms',
    description: 'Veicoli e unita di supporto lavorano in sinergia con i piloti per gli obiettivi a terra.',
    Icon: Layers3,
  },
  {
    id: 'defense',
    title: 'Difesa Attiva',
    description: 'Assetti antiaerei e colonne mobili proteggono aeroporti, convogli e punti critici.',
    Icon: ShieldCheck,
  },
];

const VEHICLES = [
  {
    id: 't90',
    category: 'Corazzato',
    name: 'T-90M',
    description: 'Carro pesante da sfondamento. Controlla i choke point e tiene la linea sotto fuoco intenso.',
    image: armoredImg,
  },
  {
    id: 'uaz',
    category: 'Ricognizione',
    name: 'UAZ Recon',
    description: 'Mezzo rapido per scouting avanzato. Individua movimenti nemici e apre finestre di ingaggio.',
    image: utilityImg,
  },
  {
    id: 'ka50',
    category: 'Attacco',
    name: 'Ka-50 Black Shark',
    description: 'Elicottero anticarro. Neutralizza minacce prioritarie con attacchi rapidi e precisi.',
    image: attackHeliImg,
  },
  {
    id: 'sa19',
    category: 'Difesa Aerea',
    name: 'SA-19 Tunguska',
    description: 'Scudo mobile a corto raggio. Protegge i convogli da elicotteri e strike a bassa quota.',
    image: airDefenseImg,
  },
  {
    id: 'ch47',
    category: 'Trasporto',
    name: 'CH-47 Chinook',
    description: 'Trasporto truppe e carichi pesanti. Essenziale per redeploy rapidi e rinforzi sul fronte.',
    image: transportHeliImg,
  },
  {
    id: 'cisterna',
    category: 'Supporto',
    name: 'Fuel Truck M978',
    description: 'Rifornimento mobile per basi avanzate. Mantiene in vita operazioni aeree e terrestri prolungate.',
    image: fuelTruckImg,
  },
];

const SLOT_ITEM_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];
const SLOT_STEP = 138;
const WHEEL_THRESHOLD = 40;
const FULLSCREEN_TRANSITION_MS = 280;
const SHOWROOM_BLUE_GLOW = 'rgba(78, 197, 255, 0.16)';

function wrapIndex(value, length) {
  return ((value % length) + length) % length;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getVisualFromPosition(positionPx) {
  const normalized = Math.abs(positionPx) / SLOT_STEP;

  let opacity;
  let blur;
  let sizePx;

  if (normalized <= 1) {
    opacity = 1 - (0.5 * normalized);
    blur = 0.2 * normalized;
    sizePx = 156 - (76 * normalized);
  } else if (normalized <= 2) {
    const local = normalized - 1;
    opacity = 0.5 - (0.32 * local);
    blur = 0.2 + (1.6 * local);
    sizePx = 80 - (8 * local);
  } else {
    const local = normalized - 2;
    opacity = 0.18 - (0.13 * local);
    blur = 1.8 + (0.8 * local);
    sizePx = 72 - (10 * local);
  }

  return {
    opacity: clamp(opacity, 0.05, 1),
    blur: clamp(blur, 0, 2.6),
    sizePx: clamp(sizePx, 62, 156),
  };
}

export default function WikiPage() {
  const [selectedVehicleIndex, setSelectedVehicleIndex] = useState(0);
  const [isShowroomFullscreen, setIsShowroomFullscreen] = useState(false);
  const [isShowroomFullscreenActive, setIsShowroomFullscreenActive] = useState(false);
  const [slotAnimating, setSlotAnimating] = useState(false);
  const [slotTranslate, setSlotTranslate] = useState(0);
  const wheelAccumulatorRef = useRef(0);
  const closeTimeoutRef = useRef(null);
  const openRafRef = useRef(null);
  const slotRafRef = useRef(null);
  const slotPendingDirectionRef = useRef(0);

  const priorityOffset = useMemo(() => {
    let bestOffset = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    SLOT_ITEM_OFFSETS.forEach((offset) => {
      const position = (offset * SLOT_STEP) + slotTranslate;
      const distance = Math.abs(position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestOffset = offset;
      }
    });

    return bestOffset;
  }, [slotTranslate]);

  const selectedVehicle = useMemo(() => {
    const visualIndex = wrapIndex(selectedVehicleIndex + priorityOffset, VEHICLES.length);
    return VEHICLES[visualIndex];
  }, [selectedVehicleIndex, priorityOffset]);

  const shiftVehicle = (direction) => {
    if (!direction || slotAnimating) {
      return;
    }

    const normalizedDirection = direction > 0 ? 1 : -1;
    slotPendingDirectionRef.current = normalizedDirection;
    setSlotAnimating(true);
    setSlotTranslate(0);

    if (slotRafRef.current) {
      cancelAnimationFrame(slotRafRef.current);
    }

    slotRafRef.current = requestAnimationFrame(() => {
      setSlotTranslate(-normalizedDirection * SLOT_STEP);
    });
  };

  const closeShowroomFullscreen = () => {
    setIsShowroomFullscreenActive(false);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsShowroomFullscreen(false);
    }, FULLSCREEN_TRANSITION_MS);
  };

  useEffect(() => {
    if (!isShowroomFullscreen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeShowroomFullscreen();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isShowroomFullscreen]);

  useEffect(() => {
    document.body.classList.toggle('wiki-showroom-open', isShowroomFullscreen);
    return () => {
      document.body.classList.remove('wiki-showroom-open');
    };
  }, [isShowroomFullscreen]);

  useEffect(() => () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    if (openRafRef.current) {
      cancelAnimationFrame(openRafRef.current);
    }
    if (slotRafRef.current) {
      cancelAnimationFrame(slotRafRef.current);
    }
  }, []);

  const openShowroomFullscreen = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsShowroomFullscreen(true);
    openRafRef.current = requestAnimationFrame(() => {
      setIsShowroomFullscreenActive(true);
    });
  };

  const toggleShowroomFullscreen = () => {
    if (isShowroomFullscreen) {
      closeShowroomFullscreen();
      return;
    }
    openShowroomFullscreen();
  };

  const handleWheel = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (slotAnimating) {
      return;
    }

    wheelAccumulatorRef.current += event.deltaY;

    if (Math.abs(wheelAccumulatorRef.current) < WHEEL_THRESHOLD) {
      return;
    }

    const direction = wheelAccumulatorRef.current > 0 ? 1 : -1;
    wheelAccumulatorRef.current = 0;
    shiftVehicle(direction);
  };

  const handleKeyDown = (event) => {
    if (slotAnimating) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      shiftVehicle(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      shiftVehicle(-1);
    }
  };

  const handleShowroomClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const clickedInteractive = target.closest('button, a, input, textarea, select, [role="listbox"]');
    if (clickedInteractive) {
      return;
    }

    openShowroomFullscreen();
  };

  const handleSlotTrackTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform' || !slotAnimating) {
      return;
    }

    const direction = slotPendingDirectionRef.current || 0;
    if (!direction) {
      return;
    }

    setSelectedVehicleIndex((prev) => wrapIndex(prev + direction, VEHICLES.length));
    setSlotTranslate(0);
    setSlotAnimating(false);
    slotPendingDirectionRef.current = 0;
  };

  const renderShowroomContent = ({ fullscreen = false } = {}) => (
    <>
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-[0.08em] text-yt-text-primary">Veicoli</h2>
          <p className="text-sm text-yt-text-secondary">Showroom virtuale con selezione a scorrimento verticale.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-yt-accent/30 bg-yt-accent/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-yt-accent">
            Slot View
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleShowroomFullscreen();
            }}
            className="inline-flex items-center gap-1 rounded-full border border-yt-border/80 bg-[#101827] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
            title={fullscreen ? 'Chiudi fullscreen' : 'Apri fullscreen'}
            aria-label={fullscreen ? 'Chiudi fullscreen' : 'Apri fullscreen'}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {fullscreen ? 'Chiudi' : 'Fullscreen'}
          </button>
        </div>
      </div>

      <div className={`relative grid gap-8 ${fullscreen ? 'lg:grid-cols-[430px_minmax(0,1fr)]' : 'lg:grid-cols-[390px_minmax(0,1fr)]'}`}>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[460px] opacity-60"
          style={{
            background: `radial-gradient(circle at 28% 50%, ${SHOWROOM_BLUE_GLOW}, transparent 64%)`,
          }}
        />

        <aside className="relative flex flex-col items-center">
          <div
            className={`relative w-full overflow-hidden outline-none focus:outline-none ${fullscreen ? 'h-[min(74vh,760px)]' : 'h-[560px]'}`}
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 11%, black 89%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 11%, black 89%, transparent 100%)',
              overscrollBehavior: 'contain',
            }}
            onWheelCapture={handleWheel}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="listbox"
            aria-label="Lista veicoli showroom"
          >
            <div
              className={`absolute inset-0 ${slotAnimating ? 'transition-transform duration-[420ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]' : ''}`}
              style={{
                transform: `translateY(${slotTranslate}px)`,
              }}
              onTransitionEnd={handleSlotTrackTransitionEnd}
            >
              {SLOT_ITEM_OFFSETS.map((offset) => {
                const itemIndex = wrapIndex(selectedVehicleIndex + offset, VEHICLES.length);
                const vehicle = VEHICLES[itemIndex];
                const position = (offset * SLOT_STEP) + slotTranslate;
                const visual = getVisualFromPosition(position);
                const isPriority = offset === priorityOffset;

                return (
                  <button
                    key={`${vehicle.id}_${offset}`}
                    type="button"
                    onClick={() => {
                      if (offset === 0) {
                        return;
                      }
                      shiftVehicle(offset > 0 ? 1 : -1);
                    }}
                    className="absolute left-1/2 w-[92%] -translate-x-1/2 p-0 transition-all duration-250"
                    style={{
                      transform: `translate(-50%, calc(-50% + ${offset * SLOT_STEP}px))`,
                      top: '50%',
                      opacity: visual.opacity,
                      filter: `blur(${visual.blur}px)`,
                    }}
                    role="option"
                    aria-selected={isPriority}
                  >
                    <img
                      src={vehicle.image}
                      alt={vehicle.name}
                      className={`mx-auto object-contain transition-[filter] duration-200 ${
                        isPriority ? 'drop-shadow-[0_0_14px_rgba(78,197,255,0.26)]' : ''
                      }`}
                      style={{
                        width: `${visual.sizePx}px`,
                        height: `${visual.sizePx}px`,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <article className="relative flex items-start justify-center">
          <div className="w-full max-w-xl space-y-3 pt-1 text-center">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <h3 className={`font-black uppercase leading-tight tracking-[0.05em] text-yt-text-primary ${fullscreen ? 'text-4xl' : 'text-3xl'}`}>
                {selectedVehicle.name}
              </h3>
              <div className="inline-flex items-center gap-2 rounded-full border border-yt-accent/40 bg-yt-accent/12 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-yt-accent shadow-[0_0_10px_rgba(78,197,255,0.7)]" />
                <span className="text-xs font-black uppercase tracking-[0.14em] text-yt-accent">
                  Categoria: {selectedVehicle.category}
                </span>
              </div>
            </div>
            <p className={`mx-auto max-w-xl leading-relaxed text-yt-text-secondary ${fullscreen ? 'text-base' : 'text-sm'}`}>
              {selectedVehicle.description}
            </p>
          </div>
        </article>
      </div>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-6">
      <section className="rounded-3xl border border-yt-border/70 bg-yt-bg-secondary/85 p-5 shadow-[0_16px_34px_rgba(0,0,0,0.32)] backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl border border-yt-accent/35 bg-yt-accent/12 p-2">
            <Gamepad2 className="h-5 w-5 text-yt-accent" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-[0.08em] text-yt-text-primary">Gameplay</h2>
            <p className="text-sm text-yt-text-secondary">Feature di gioco principali della campagna.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {GAMEPLAY_FEATURES.map(({ id, title, description, Icon }) => (
            <article
              key={id}
              className="rounded-2xl border border-yt-border/80 bg-[#101926] p-4 shadow-[0_8px_18px_rgba(0,0,0,0.26)]"
            >
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-yt-border/80 bg-[#0b121d] px-2.5 py-1">
                <Icon className="h-4 w-4 text-yt-accent" />
                <h3 className="text-xs font-bold uppercase tracking-[0.09em] text-yt-accent">{title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-yt-text-secondary">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="relative cursor-zoom-in overflow-hidden rounded-3xl border border-yt-border/70 bg-yt-bg-secondary/90 p-5 shadow-[0_20px_46px_rgba(0,0,0,0.38)]"
        onClick={handleShowroomClick}
        title="Clicca per aprire lo showroom in fullscreen"
      >
        <div className="relative">
          {renderShowroomContent()}
        </div>
      </section>

      {isShowroomFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[260] flex items-center justify-center bg-[#03070eb8] p-3 backdrop-blur-sm transition-opacity duration-300 sm:p-5 ${
            isShowroomFullscreenActive ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeShowroomFullscreen}
        >
          <section
            className={`relative h-[min(90vh,1040px)] w-[min(1420px,96vw)] overflow-hidden rounded-3xl border border-yt-border/80 bg-yt-bg-secondary/95 p-5 shadow-[0_24px_56px_rgba(0,0,0,0.56)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-6 ${
              isShowroomFullscreenActive ? 'scale-100 opacity-100' : 'scale-[0.975] opacity-0'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative h-full">
              {renderShowroomContent({ fullscreen: true })}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
