import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gamepad2, Layers3, Maximize2, Minimize2, Radar, ShieldCheck, Truck } from 'lucide-react';
import avengerImg from '../../img/wiki/veh/AVENGER.png';
import firtinaImg from '../../img/wiki/veh/FIRTINA.png';
import fmtvImg from '../../img/wiki/veh/FMTV.png';
import gepardImg from '../../img/wiki/veh/GEPARD.png';
import gmlrsAtacmsImg from '../../img/wiki/veh/GMLRS-ATACMS.png';
import hemttImg from '../../img/wiki/veh/HEMTT.png';
import hmmwvImg from '../../img/wiki/veh/HMMWV.png';
import l118Img from '../../img/wiki/veh/L118.png';
import lavImg from '../../img/wiki/veh/LAV.png';
import mbtImg from '../../img/wiki/veh/MBT.png';
import rolandImg from '../../img/wiki/veh/ROLAND.png';
import scimitarImg from '../../img/wiki/veh/SCIMITAR.png';
import scorpionImg from '../../img/wiki/veh/SCORPION.png';
import towImg from '../../img/wiki/veh/TOW.png';

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
    id: 'avenger',
    category: 'Difesa Aerea',
    name: 'Avenger',
    description: 'Sistema SHORAD mobile per contrastare elicotteri e minacce a bassa quota.',
    image: avengerImg,
  },
  {
    id: 'firtina',
    category: 'Artiglieria',
    name: 'Firtina',
    description: 'Obice semovente per fuoco indiretto a lunga distanza su obiettivi tattici.',
    image: firtinaImg,
  },
  {
    id: 'fmtv',
    category: 'Logistica',
    name: 'FMTV',
    description: 'Camion tattico multiruolo per trasporto rifornimenti, munizioni e supporto operativo.',
    image: fmtvImg,
  },
  {
    id: 'gepard',
    category: 'Difesa Aerea',
    name: 'Gepard',
    description: 'Piattaforma antiaerea a cannoni per protezione ravvicinata delle unita a terra.',
    image: gepardImg,
  },
  {
    id: 'gmlrs',
    category: 'Artiglieria Missilistica',
    name: 'GMLRS',
    description: 'Razzi guidati a lungo raggio per ingaggi di precisione su target strategici.',
    image: gmlrsAtacmsImg,
  },
  {
    id: 'atacms',
    category: 'Artiglieria Missilistica',
    name: 'ATACMS',
    description: 'Missile tattico a lunghissimo raggio per colpire nodi critici in profondita.',
    image: gmlrsAtacmsImg,
  },
  {
    id: 'hemtt',
    category: 'Logistica',
    name: 'HEMTT',
    description: 'Piattaforma pesante per trasporto carburante, container e materiali di prima linea.',
    image: hemttImg,
  },
  {
    id: 'hmmwv',
    category: 'Ricognizione',
    name: 'HMMWV',
    description: 'Veicolo leggero rapido per pattugliamento, scouting e supporto mobile.',
    image: hmmwvImg,
  },
  {
    id: 'l118',
    category: 'Artiglieria',
    name: 'L118',
    description: 'Obice trainato da 105mm per supporto di fuoco rapido e flessibile.',
    image: l118Img,
  },
  {
    id: 'lav',
    category: 'Corazzato Leggero',
    name: 'LAV',
    description: 'Veicolo blindato veloce per ricognizione armata e protezione convogli.',
    image: lavImg,
  },
  {
    id: 'mbt',
    category: 'Corazzato',
    name: 'MBT',
    description: 'Main Battle Tank per sfondamento e superiorita sul terreno.',
    image: mbtImg,
  },
  {
    id: 'roland',
    category: 'Difesa Aerea',
    name: 'Roland',
    description: 'Sistema SAM mobile a corto-medio raggio per copertura antiaerea del fronte.',
    image: rolandImg,
  },
  {
    id: 'scimitar',
    category: 'Ricognizione',
    name: 'Scimitar',
    description: 'Veicolo cingolato leggero da esplorazione armata e acquisizione bersagli.',
    image: scimitarImg,
  },
  {
    id: 'scorpion',
    category: 'Difesa Aerea',
    name: 'Scorpion',
    description: 'Piattaforma di difesa ravvicinata per contrasto droni e minacce a corto raggio.',
    image: scorpionImg,
  },
  {
    id: 'tow',
    category: 'Controcarro',
    name: 'TOW',
    description: 'Sistema missilistico anticarro per neutralizzare veicoli blindati ad alta priorita.',
    image: towImg,
  },
];

const SLOT_ITEM_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];
const SLOT_STEP = 186;
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

    const primaryDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    wheelAccumulatorRef.current += primaryDelta;

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
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      shiftVehicle(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
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
        </div>
        <div className="flex items-center">
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

      <div className="space-y-5">
        <article className="relative flex items-start justify-center">
          <div className="w-full max-w-3xl space-y-3 pt-1 text-center">
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
            <p className={`mx-auto max-w-2xl leading-relaxed text-yt-text-secondary ${fullscreen ? 'text-base' : 'text-sm'}`}>
              {selectedVehicle.description}
            </p>
          </div>
        </article>

        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0 opacity-55"
            style={{
              background: `radial-gradient(circle at 50% 62%, ${SHOWROOM_BLUE_GLOW}, transparent 65%)`,
            }}
          />

          <div
            className={`relative mx-auto overflow-hidden outline-none focus:outline-none ${fullscreen ? 'h-[360px] max-w-[min(92vw,1280px)]' : 'h-[300px] max-w-[min(92vw,1040px)]'}`}
            style={{
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
              maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
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
                transform: `translateX(${slotTranslate}px)`,
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
                    className="absolute top-1/2 left-1/2 p-0 transition-all duration-250"
                    style={{
                      transform: `translate(calc(-50% + ${offset * SLOT_STEP}px), -50%)`,
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
        </div>
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
