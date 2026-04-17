import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Gamepad2, Layers3, Maximize2, Minimize2, Radar, ShieldCheck, Truck } from 'lucide-react';
import armoredImg from '../assets/vehicles/armored.svg';
import utilityImg from '../assets/vehicles/utility.svg';
import attackHeliImg from '../assets/vehicles/attack-heli.svg';
import airDefenseImg from '../assets/vehicles/air-defense.svg';
import transportHeliImg from '../assets/vehicles/transport-heli.svg';
import fuelTruckImg from '../assets/vehicles/fuel-truck.svg';

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
    glow: 'rgba(255, 123, 61, 0.42)',
  },
  {
    id: 'uaz',
    category: 'Ricognizione',
    name: 'UAZ Recon',
    description: 'Mezzo rapido per scouting avanzato. Individua movimenti nemici e apre finestre di ingaggio.',
    image: utilityImg,
    glow: 'rgba(113, 218, 255, 0.42)',
  },
  {
    id: 'ka50',
    category: 'Attacco',
    name: 'Ka-50 Black Shark',
    description: 'Elicottero anticarro. Neutralizza minacce prioritarie con attacchi rapidi e precisi.',
    image: attackHeliImg,
    glow: 'rgba(255, 92, 133, 0.42)',
  },
  {
    id: 'sa19',
    category: 'Difesa Aerea',
    name: 'SA-19 Tunguska',
    description: 'Scudo mobile a corto raggio. Protegge i convogli da elicotteri e strike a bassa quota.',
    image: airDefenseImg,
    glow: 'rgba(125, 241, 125, 0.38)',
  },
  {
    id: 'ch47',
    category: 'Trasporto',
    name: 'CH-47 Chinook',
    description: 'Trasporto truppe e carichi pesanti. Essenziale per redeploy rapidi e rinforzi sul fronte.',
    image: transportHeliImg,
    glow: 'rgba(255, 219, 120, 0.4)',
  },
  {
    id: 'cisterna',
    category: 'Supporto',
    name: 'Fuel Truck M978',
    description: 'Rifornimento mobile per basi avanzate. Mantiene in vita operazioni aeree e terrestri prolungate.',
    image: fuelTruckImg,
    glow: 'rgba(155, 150, 255, 0.4)',
  },
];

const SLOT_ITEM_OFFSETS = [-2, -1, 0, 1, 2];
const SLOT_STEP = 94;
const WHEEL_THRESHOLD = 36;

function wrapIndex(value, length) {
  return ((value % length) + length) % length;
}

function getOffsetVisual(offset) {
  const distance = Math.abs(offset);
  if (distance === 0) {
    return { opacity: 1, scale: 1, blur: 0 };
  }
  if (distance === 1) {
    return { opacity: 0.52, scale: 0.86, blur: 0 };
  }
  return { opacity: 0.2, scale: 0.74, blur: 1.5 };
}

export default function WikiPage() {
  const [selectedVehicleIndex, setSelectedVehicleIndex] = useState(0);
  const [isShowroomFullscreen, setIsShowroomFullscreen] = useState(false);
  const [isShowroomFullscreenActive, setIsShowroomFullscreenActive] = useState(false);
  const wheelAccumulatorRef = useRef(0);
  const closeTimeoutRef = useRef(null);
  const openRafRef = useRef(null);
  const FULLSCREEN_TRANSITION_MS = 280;

  const selectedVehicle = useMemo(
    () => VEHICLES[selectedVehicleIndex],
    [selectedVehicleIndex],
  );

  const shiftVehicle = (direction) => {
    setSelectedVehicleIndex((prev) => wrapIndex(prev + direction, VEHICLES.length));
  };

  const handleWheel = (event) => {
    event.preventDefault();
    wheelAccumulatorRef.current += event.deltaY;

    if (Math.abs(wheelAccumulatorRef.current) < WHEEL_THRESHOLD) {
      return;
    }

    const direction = wheelAccumulatorRef.current > 0 ? 1 : -1;
    wheelAccumulatorRef.current = 0;
    shiftVehicle(direction);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      shiftVehicle(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      shiftVehicle(-1);
    }
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

  const closeShowroomFullscreen = () => {
    setIsShowroomFullscreenActive(false);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsShowroomFullscreen(false);
    }, FULLSCREEN_TRANSITION_MS);
  };

  const toggleShowroomFullscreen = () => {
    if (isShowroomFullscreen) {
      closeShowroomFullscreen();
      return;
    }
    openShowroomFullscreen();
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

      <div className={`relative grid gap-6 ${fullscreen ? 'xl:grid-cols-[260px_minmax(0,1fr)]' : 'lg:grid-cols-[220px_minmax(0,1fr)]'}`}>
        <aside className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => shiftVehicle(-1)}
            className="inline-flex items-center justify-center rounded-lg border border-yt-border/80 bg-[#101827] p-2 text-yt-text-secondary transition-colors hover:border-yt-accent hover:text-yt-accent"
            aria-label="Veicolo precedente"
            title="Veicolo precedente"
          >
            <ChevronUp className="h-4 w-4" />
          </button>

          <div
            className={`relative w-full overflow-hidden rounded-2xl border border-yt-border/80 bg-[#0c1320] px-2 ${fullscreen ? '' : 'h-[430px]'}`}
            style={fullscreen ? { height: 'min(72vh, 760px)' } : undefined}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="listbox"
            aria-label="Lista veicoli showroom"
          >
            <div className="pointer-events-none absolute inset-x-2 top-1/2 h-[108px] -translate-y-1/2 rounded-2xl border border-yt-accent/40 bg-yt-accent/8 shadow-[0_0_36px_rgba(78,197,255,0.28)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#0c1320] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0c1320] to-transparent" />

            {SLOT_ITEM_OFFSETS.map((offset) => {
              const itemIndex = wrapIndex(selectedVehicleIndex + offset, VEHICLES.length);
              const vehicle = VEHICLES[itemIndex];
              const visual = getOffsetVisual(offset);
              const isActive = offset === 0;

              return (
                <button
                  key={`${vehicle.id}_${offset}`}
                  type="button"
                  onClick={() => setSelectedVehicleIndex(itemIndex)}
                  className={`absolute left-1/2 w-[88%] -translate-x-1/2 rounded-xl border px-3 py-2 text-center transition-all duration-250 ${
                    isActive
                      ? 'border-yt-accent/45 bg-[#112035] shadow-[0_0_22px_rgba(78,197,255,0.28)]'
                      : 'border-yt-border/70 bg-[#111926]'
                  }`}
                  style={{
                    transform: `translate(-50%, calc(-50% + ${offset * SLOT_STEP}px)) scale(${visual.scale})`,
                    top: '50%',
                    opacity: visual.opacity,
                    filter: `blur(${visual.blur}px)`,
                  }}
                  role="option"
                  aria-selected={isActive}
                >
                  <img
                    src={vehicle.image}
                    alt={vehicle.name}
                    className={`mx-auto object-contain ${isActive ? 'h-11 w-11' : 'h-8 w-8'}`}
                  />
                  <div className={`mt-1 text-xs font-bold uppercase tracking-[0.08em] ${isActive ? 'text-yt-accent' : 'text-yt-text-secondary'}`}>
                    {vehicle.name}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => shiftVehicle(1)}
            className="inline-flex items-center justify-center rounded-lg border border-yt-border/80 bg-[#101827] p-2 text-yt-text-secondary transition-colors hover:border-yt-accent hover:text-yt-accent"
            aria-label="Veicolo successivo"
            title="Veicolo successivo"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <p className="text-center text-[11px] uppercase tracking-[0.1em] text-yt-text-secondary">
            Scroll su e giu
          </p>
        </aside>

        <article className="relative overflow-hidden rounded-3xl border border-yt-border/80 bg-[#111b2a] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background: `radial-gradient(circle at 88% 18%, ${selectedVehicle.glow}, transparent 42%)`,
            }}
          />

          <div className={`relative grid items-center gap-5 ${fullscreen ? 'lg:grid-cols-[280px_minmax(0,1fr)]' : 'md:grid-cols-[220px_minmax(0,1fr)]'}`}>
            <div className="rounded-2xl border border-yt-border/80 bg-[#0b1320] p-4 shadow-[inset_0_0_30px_rgba(78,197,255,0.1)]">
              <img
                src={selectedVehicle.image}
                alt={selectedVehicle.name}
                className={`mx-auto object-contain ${fullscreen ? 'h-44 w-44' : 'h-36 w-36'}`}
              />
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-yt-accent/40 bg-yt-accent/12 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-yt-accent shadow-[0_0_10px_rgba(78,197,255,0.7)]" />
                <span className="text-xs font-black uppercase tracking-[0.14em] text-yt-accent">
                  Categoria: {selectedVehicle.category}
                </span>
              </div>

              <h3 className={`font-black uppercase leading-tight tracking-[0.05em] text-yt-text-primary ${fullscreen ? 'text-4xl' : 'text-3xl'}`}>
                {selectedVehicle.name}
              </h3>
              <p className={`max-w-2xl leading-relaxed text-yt-text-secondary ${fullscreen ? 'text-base' : 'text-sm'}`}>
                {selectedVehicle.description}
              </p>
            </div>
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
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(circle at 16% 50%, ${selectedVehicle.glow}, transparent 47%)`,
          }}
        />

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
            className={`relative h-[min(84vh,900px)] w-[min(1180px,92vw)] overflow-hidden rounded-3xl border border-yt-border/80 bg-yt-bg-secondary/95 p-5 shadow-[0_24px_56px_rgba(0,0,0,0.56)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-6 ${
              isShowroomFullscreenActive ? 'scale-100 opacity-100' : 'scale-[0.975] opacity-0'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                background: `radial-gradient(circle at 14% 52%, ${selectedVehicle.glow}, transparent 48%)`,
              }}
            />
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
