import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import {
  Activity,
  Anchor,
  ClipboardList,
  Eye,
  Factory,
  Gamepad2,
  Handshake,
  Helicopter,
  Layers3,
  Loader2,
  MapPin,
  Megaphone,
  Package,
  PenSquare,
  Plus,
  Radar,
  Radio,
  ScanEye,
  Save,
  ShieldCheck,
  Target,
  Truck,
  Upload,
  Waypoints,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import avengerImg from '../../img/wiki/veh/AVENGER.png';
import blueBombImg from '../../img/wiki/veh/BLUE_BOMB.png';
import blueCasImg from '../../img/wiki/veh/BLUE_CAS.png';
import blueCruiseImg from '../../img/wiki/veh/BLUE_CRUISE.png';
import blueDroneImg from '../../img/wiki/veh/BLUE_DRONE.png';
import blueEwarImg from '../../img/wiki/veh/BLUE_EWAR.png';
import bluePatrolImg from '../../img/wiki/veh/BLUE_PATROL.png';
import firtinaImg from '../../img/wiki/veh/FIRTINA.png';
import fmtvImg from '../../img/wiki/veh/FMTV.png';
import gepardImg from '../../img/wiki/veh/GEPARD.png';
import gmlrsAtacmsImg from '../../img/wiki/veh/GMLRS-ATACMS.png';
import heliSupplyImg from '../../img/wiki/veh/HELISUPPLY.png';
import hmmweMgImg from '../../img/wiki/veh/HMMWE MG.png';
import hmmwvImg from '../../img/wiki/veh/HMMWV.png';
import iristImg from '../../img/wiki/veh/IRIST.png';
import l118Img from '../../img/wiki/veh/L118.png';
import lavImg from '../../img/wiki/veh/LAV.png';
import manpadImg from '../../img/wiki/veh/MANPAD.png';
import mbtImg from '../../img/wiki/veh/MBT.png';
import nasamsImg from '../../img/wiki/veh/NASAMS.png';
import patriotImg from '../../img/wiki/veh/PATRIOT.png';
import rolandImg from '../../img/wiki/veh/ROLAND.png';
import scimitarImg from '../../img/wiki/veh/SCIMITAR.png';
import scorpionImg from '../../img/wiki/veh/SCORPION.png';
import scoutImg from '../../img/wiki/veh/SCOUT.png';
import shipImg from '../../img/wiki/veh/SHIP.png';
import towImg from '../../img/wiki/veh/TOW.png';
import { useUser } from '../contexts/UserContext';
import * as api from '../services/api';

const GAMEPLAY_FEATURES = [
  {
    id: 'dmas',
    iconKey: 'mappin',
    title: { en: 'DMAS - Mark Action System', it: 'DMAS - Sistema Mark Action' },
    description: {
      en: 'F10 marker command system to spawn assets, request support, and drive operations.',
      it: 'Sistema comandi via marker F10 per spawn asset, supporto e controllo operativo.',
    },
    Icon: MapPin,
  },
  {
    id: 'dmap-zones',
    iconKey: 'waypoints',
    title: { en: 'DMAP (Zones) - Dynamic Mapping Core', it: 'DMAP (Zone) - Dynamic Mapping Core' },
    description: {
      en: 'Dynamic map logic: active/passive zones, front links, and capture progression.',
      it: 'Logica mappa dinamica: zone attive/passive, linee fronte e progressione conquista.',
    },
    Icon: Waypoints,
  },
  {
    id: 'dfow',
    iconKey: 'scaneye',
    title: { en: 'DFOW - Dynamic Fog Of War', it: 'DFOW - Dynamic Fog Of War' },
    description: {
      en: 'Recon-driven map visibility: enemy contacts appear only when detected by scouts.',
      it: 'Visibilita mappa guidata da recon: contatti nemici visibili solo se rilevati.',
    },
    Icon: ScanEye,
  },
  {
    id: 'dcsar',
    iconKey: 'helicopter',
    title: { en: 'DCSAR - Combat Search And Rescue', it: 'DCSAR - Combat Search And Rescue' },
    description: {
      en: 'Recover downed pilots and deliver them to BLUE airbases to earn campaign rewards.',
      it: 'Recupera piloti eiettati e consegnali a basi BLUE per ottenere ricompense.',
    },
    Icon: Helicopter,
  },
];

function normalizeGameplayIconKey(iconKey) {
  return String(iconKey || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatLucideLabel(iconName) {
  return String(iconName || '')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}

const LUCIDE_ICON_EXCLUDED_EXPORTS = new Set([
  'Icon',
  'icons',
  'createLucideIcon',
  'default',
]);

const GAMEPLAY_ICON_LIBRARY = Object.entries(LucideIcons)
  .filter(([name, value]) => {
    if (LUCIDE_ICON_EXCLUDED_EXPORTS.has(name)) return false;
    if (!/^[A-Z]/.test(name)) return false;
    if (name.startsWith('Lucide')) return false;
    if (name.endsWith('Icon')) return false;
    if (typeof value === 'function') return true;
    if (value && typeof value === 'object') {
      return Boolean(value.$$typeof) || typeof value.render === 'function';
    }
    return false;
  })
  .map(([name, Icon]) => ({
    key: normalizeGameplayIconKey(name),
    label: formatLucideLabel(name),
    Icon,
  }))
  .filter((item, index, arr) => arr.findIndex((candidate) => candidate.key === item.key) === index)
  .sort((a, b) => a.label.localeCompare(b.label, 'it'));

const GAMEPLAY_ICON_MAP = GAMEPLAY_ICON_LIBRARY.reduce((acc, iconDef) => {
  acc[iconDef.key] = iconDef.Icon;
  return acc;
}, {});

const GAMEPLAY_ICON_LABEL_MAP = GAMEPLAY_ICON_LIBRARY.reduce((acc, iconDef) => {
  acc[iconDef.key] = iconDef.label;
  return acc;
}, {});

const VEHICLES = [
  {
    id: 'avenger',
    category: { en: 'AIR DEFENCE', it: 'AIR DEFENCE' },
    name: 'Avenger',
    description: {
      en: 'US SHORAD system on HMMWV, fielded in the 1990s. Uses Stinger missiles for mobile close air defense. Range: 2.6 NM / 4,800 m. Ceiling: up to 12,500 ft. Targets: helicopters, drones, low-altitude aircraft. Seeker: IR fire-and-forget missile. Feature: Air-droppable.',
      it: 'Sistema SHORAD statunitense su HMMWV, in servizio dagli anni 90. Usa missili Stinger per difesa ravvicinata mobile. Raggio: 2.6 NM / 4,800 m. Quota: fino a 12,500 ft. Bersagli: elicotteri, droni, aerei a bassa quota. Guida: missile IR fire-and-forget. Caratteristica: aviolanciabile.',
    },
    image: avengerImg,
  },
  {
    id: 'roland',
    category: { en: 'AIR DEFENCE', it: 'AIR DEFENCE' },
    name: 'Roland',
    description: {
      en: 'Franco-German short-range SAM developed during the Cold War for mobile defense of units and sensitive sites. Range: 4.3 NM / 8,000 m. Ceiling: up to 18,000 ft. Targets: aircraft, helicopters, low-altitude threats. Guidance: command-guided missile with radar/optical tracking.',
      it: 'Sistema SAM franco-tedesco a corto raggio sviluppato nella Guerra Fredda per difesa mobile di unita e siti sensibili. Raggio: 4.3 NM / 8,000 m. Quota: fino a 18,000 ft. Bersagli: aerei, elicotteri, minacce a bassa quota. Guida: missile a comando con tracking radar/ottico.',
    },
    image: rolandImg,
  },
  {
    id: 'gepard',
    category: { en: 'AIR DEFENCE', it: 'AIR DEFENCE' },
    name: 'Gepard',
    description: {
      en: 'German SPAAG on Leopard 1 chassis designed for close anti-air protection of armored forces. Range: 2.7 NM / 5,000 m. Ceiling: up to 11,500 ft. Targets: helicopters, drones, and low pass aircraft. Weapon: twin 35 mm cannons with search and tracking radar.',
      it: 'SPAAG tedesco su scafo Leopard 1, progettato per protezione antiaerea ravvicinata delle forze corazzate. Raggio: 2.7 NM / 5,000 m. Quota: fino a 11,500 ft. Bersagli: elicotteri, droni, aerei in passaggio ravvicinato. Arma: doppio cannone da 35 mm con radar di scoperta e inseguimento.',
    },
    image: gepardImg,
  },
  {
    id: 'manpad',
    category: { en: 'AIR DEFENCE', it: 'AIR DEFENCE' },
    name: 'Manpad',
    description: {
      en: 'Shoulder-launched infantry air defense for lightweight and dispersed frontline coverage. Range: 2.6 NM / 4,800 m. Ceiling: up to 12,500 ft. Targets: helicopters, drones, low-altitude aircraft. Seeker: passive IR fire-and-forget. Feature: Helicopter transportable.',
      it: 'Difesa antiaerea spalleggiabile di fanteria, pensata per copertura leggera e dispersa del fronte. Raggio: 2.6 NM / 4,800 m. Quota: fino a 12,500 ft. Bersagli: elicotteri, droni, aerei a bassa quota. Guida: missile IR passivo fire-and-forget. Caratteristica: trasportabile su elicottero.',
    },
    image: manpadImg,
  },
  {
    id: 'tow',
    category: { en: 'GROUND', it: 'GROUND' },
    name: 'TOW',
    description: {
      en: 'US anti-tank missile introduced in the 1970s and still widely used on tripods and vehicles. Range: 2.0 NM / 3,750 m. Targets: MBTs, IFVs, bunkers, armored vehicles. Guidance: SACLOS, optically tracked, wire-guided. Feature: Air-droppable and sling-load transportable.',
      it: 'Missile anticarro statunitense introdotto negli anni 70, ancora molto diffuso su treppiede e veicoli. Raggio: 2.0 NM / 3,750 m. Bersagli: MBT, IFV, bunker, veicoli corazzati. Guida: missile SACLOS, tracciamento ottico, wire-guided. Caratteristica: aviolanciabile e trasportabile via SlingLoad.',
    },
    image: towImg,
  },
  {
    id: 'mbt',
    category: { en: 'GROUND', it: 'GROUND' },
    name: 'MBT',
    description: {
      en: 'Modern Main Battle Tank, the core of armored land forces, combining protection, mobility, and heavy direct fire. Range: 2.2 NM / 4,000 m. Targets: tanks, armored vehicles, fortifications, infantry. Weapon: direct-fire cannon with optics and fire-control system.',
      it: 'Main Battle Tank moderno, cuore della forza corazzata terrestre. Combina protezione, mobilita e fuoco diretto pesante. Raggio: 2.2 NM / 4,000 m. Bersagli: carri, mezzi corazzati, fortificazioni, fanteria. Arma: cannone diretto con ottiche e fire control system.',
    },
    image: mbtImg,
  },
  {
    id: 'lav25',
    category: { en: 'GROUND', it: 'GROUND' },
    name: 'LAV25',
    description: {
      en: 'Light 8x8 armored vehicle built for armed reconnaissance and rapid support. Range: 1.1 NM / 2,000 m. Targets: infantry, light vehicles, positions, and soft-skinned targets. Weapon: 25 mm autocannon, direct optical fire. Feature: Amphibious.',
      it: 'Veicolo blindato leggero 8x8 nato per ricognizione armata e supporto rapido. Raggio: 1.1 NM / 2,000 m. Bersagli: fanteria, veicoli leggeri, postazioni, bersagli soft-skinned. Arma: cannone automatico da 25 mm, tiro diretto ottico. Caratteristica: anfibio.',
    },
    image: lavImg,
  },
  {
    id: 'scorpion',
    category: { en: 'GROUND', it: 'GROUND' },
    name: 'SCORPION',
    description: {
      en: 'FV101 Scorpion, British reconnaissance vehicle with 76 mm cannon, introduced in the 1970s. Range: 1.2 NM / 2,200 m. Targets: light vehicles, infantry, exposed positions. Weapon: 76 mm direct-fire cannon. Feature: Air-droppable.',
      it: 'FV101 Scorpion, veicolo britannico da ricognizione armato con cannone da 76 mm, introdotto negli anni 70. Raggio: 1.2 NM / 2,200 m. Bersagli: veicoli leggeri, fanteria, posizioni scoperte. Arma: cannone da 76 mm a tiro diretto. Caratteristica: aviolanciabile.',
    },
    image: scorpionImg,
  },
  {
    id: 'scimitar',
    category: { en: 'GROUND', it: 'GROUND' },
    name: 'SCIMITAR',
    description: {
      en: 'British CVR(T) reconnaissance vehicle oriented to rapid direct fire compared to Scorpion. Range: 1.1 NM / 2,000 m. Targets: infantry, light vehicles, scouts, and positions. Weapon: 30 mm direct-fire cannon. Feature: Air-droppable.',
      it: 'Veicolo da ricognizione britannico CVR(T), orientato al fuoco rapido rispetto allo Scorpion. Raggio: 1.1 NM / 2,000 m. Bersagli: fanteria, veicoli leggeri, scout, postazioni. Arma: cannone da 30 mm a tiro diretto. Caratteristica: aviolanciabile.',
    },
    image: scimitarImg,
  },
  {
    id: 'atacms',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'ATCAMS',
    description: {
      en: 'Long-range tactical missile designed for deep precision strikes. Range: 162.0 NM / 300,000 m. Targets: depots, radars, SAM sites, airfields, and force concentrations. Guidance: tactical ballistic missile with INS/GPS.',
      it: 'Missile tattico a lungo raggio pensato per colpire obiettivi in profondita con alta precisione. Raggio: 162.0 NM / 300,000 m. Bersagli: depositi, radar, SAM, aeroporti, concentrazioni di forze. Guida: missile balistico tattico INS/GPS.',
    },
    image: gmlrsAtacmsImg,
  },
  {
    id: 'gmlrs',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'GMLRS',
    description: {
      en: 'Guided rocket for MLRS/HIMARS developed for precise medium-to-long range strikes. Range: 54.0 NM / 100,000 m. Targets: artillery, depots, vehicles, structures, and command points. Guidance: INS/GPS guided rocket.',
      it: 'Razzo guidato per MLRS/HIMARS sviluppato per attacchi precisi a medio-lungo raggio. Raggio: 54.0 NM / 100,000 m. Bersagli: artiglieria, depositi, veicoli, strutture, punti di comando. Guida: razzo guidato INS/GPS.',
    },
    image: gmlrsAtacmsImg,
  },
  {
    id: 'firtina',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'FIRTINA',
    description: {
      en: 'Turkish 155 mm self-propelled howitzer derived from K9, used for mobile artillery support. Range: 21.6 NM / 40,000 m. Targets: infantry, artillery, positions, and logistic areas. Fire mode: indirect artillery with HE and special munitions.',
      it: 'Obice semovente turco da 155 mm derivato dal K9, impiegato per supporto di artiglieria mobile. Raggio: 21.6 NM / 40,000 m. Bersagli: fanteria, artiglieria, postazioni, aree logistiche. Modalita: artiglieria indiretta con munizionamento HE e speciale.',
    },
    image: firtinaImg,
  },
  {
    id: 'l118',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'L118',
    description: {
      en: 'British lightweight 105 mm howitzer, widely used for mobile support and rapid deployment. Range: 9.3 NM / 17,200 m. Targets: infantry, positions, area targets, and opportunity targets. Fire mode: indirect artillery (HE, illumination, target marking). Feature: Sling-load transportable.',
      it: 'Obice leggero britannico da 105 mm, molto usato per supporto mobile e rapido schieramento. Raggio: 9.3 NM / 17,200 m. Bersagli: fanteria, postazioni, aree, bersagli di opportunita. Modalita: artiglieria indiretta, HE, illumination, target marking. Caratteristica: trasportabile via SlingLoad.',
    },
    image: l118Img,
  },
  {
    id: 'scout',
    category: { en: 'SCOUT', it: 'SCOUT' },
    name: 'SCOUT',
    description: {
      en: 'Light ground element for forward observation, contact, and target acquisition. Targets: reconnaissance of enemy ground units and movements. Method: optical/passive observation. Feature: Helicopter transportable. Active EFOW range: 2 km.',
      it: 'Elemento terrestre leggero dedicato a osservazione avanzata, contatto e acquisizione bersagli. Bersagli: ricognizione su unita terrestri e movimenti nemici. Metodo: osservazione ottica/passiva. Caratteristica: trasportabile su elicottero. EFOW attiva: raggio 2 km.',
    },
    image: scoutImg,
  },
  {
    id: 'hmmwv',
    category: { en: 'SCOUT', it: 'SCOUT' },
    name: 'HMMWV',
    description: {
      en: 'Light multi-role vehicle used for transport, patrol, and tactical liaison. Targets: light support, patrolling, and team transport. Weapon: optional machine gun or AGL, direct fire. Features: Air-droppable and sling-load transportable. Active EFOW range: 5 km.',
      it: 'Veicolo leggero multiruolo usato per trasporto, pattuglia e collegamento tattico. Bersagli: supporto leggero, pattugliamento, trasporto team. Arma: mitragliatrice o AGL opzionale, tiro diretto. Caratteristica: aviolanciabile e trasportabile via SlingLoad. EFOW attiva: raggio 5 km.',
    },
    image: hmmwvImg,
  },
  {
    id: 'drone',
    category: { en: 'SCOUT', it: 'SCOUT' },
    name: 'DRONE',
    description: {
      en: 'UAV surveillance and spotting platform for tactical situational awareness. Targets: reconnaissance, target acquisition, and battle damage assessment. Sensors: EO/IR. Active EFOW range: 10 km.',
      it: 'Piattaforma UAV da sorveglianza e spotting, fondamentale per consapevolezza tattica. Bersagli: ricognizione, acquisizione bersagli, battle damage assessment. Sensori: EO/IR. EFOW attiva: raggio 10 km.',
    },
    image: blueDroneImg,
  },
  {
    id: 'patrol',
    category: { en: 'MARK ATTACK', it: 'MARK ATTACK' },
    name: 'PATROL',
    description: {
      en: 'Air patrol sortie for presence, interception, and sector control. Targets: hostile aircraft, helicopters, drones, and suspicious contacts. Method: air-to-air interception with radar and missiles.',
      it: 'Sortita aerea di pattugliamento per presenza, intercettazione e controllo di settore. Bersagli: aerei ostili, elicotteri, droni, contatti sospetti. Metodo: intercettazione aria-aria con radar e missili.',
    },
    image: bluePatrolImg,
  },
  {
    id: 'cas',
    category: { en: 'MARK ATTACK', it: 'MARK ATTACK' },
    name: 'CAS',
    description: {
      en: 'Close Air Support dedicated to direct support of troops in contact. Targets: infantry, vehicles, positions, columns, and light fortifications. Weapon delivery: guided bombs, rockets, cannon, laser, GPS, and CCIP.',
      it: 'Close Air Support dedicato all appoggio diretto delle truppe a terra durante il combattimento. Bersagli: fanteria, veicoli, postazioni, colonne, fortificazioni leggere. Ingaggio: bombe guidate, razzi, cannon, laser, GPS, CCIP.',
    },
    image: blueCasImg,
  },
  {
    id: 'ewar',
    category: { en: 'MARK ATTACK', it: 'MARK ATTACK' },
    name: 'EWAR',
    description: {
      en: 'Electronic warfare asset used for radar disruption and SEAD/DEAD support. Targets: radar, SAM, and detection/tracking networks. Method: non-kinetic electronic jamming.',
      it: 'Asset di guerra elettronica impiegato per disturbo radar e supporto SEAD/DEAD. Bersagli: radar, SAM, reti di scoperta e tracking. Metodo: jamming elettronico non cinetico.',
    },
    image: blueEwarImg,
  },
  {
    id: 'bomb-f117',
    category: { en: 'MARK ATTACK', it: 'MARK ATTACK' },
    name: 'BOMB (F117)',
    description: {
      en: 'Stealth precision strike against high-value, heavily defended targets. Targets: bunkers, C2, hangars, radars, and strategic structures. Weapon: precision-guided bombs using laser or GPS.',
      it: 'Attacco stealth di precisione contro obiettivi ad alto valore e ben difesi. Bersagli: bunker, C2, hangar, radar, strutture strategiche. Arma: bombe guidate di precisione, laser o GPS.',
    },
    image: blueBombImg,
  },
  {
    id: 'cruise-b52',
    category: { en: 'MARK ATTACK', it: 'MARK ATTACK' },
    name: 'CRUISE (B52)',
    description: {
      en: 'Long-range strategic strike with cruise missiles launched by bomber aircraft. Targets: infrastructure, depots, SAM sites, and fixed high-value targets. Weapon: cruise missile guided by INS/GPS/TERCOM.',
      it: 'Strike strategico a lungo raggio eseguito con missili cruise lanciati da bombardiere. Bersagli: infrastrutture, depositi, SAM, obiettivi fissi ad alto valore. Arma: missile cruise guidato INS/GPS/TERCOM.',
    },
    image: blueCruiseImg,
  },
  {
    id: 'ship',
    category: { en: 'MARK ATTACK', it: 'MARK ATTACK' },
    name: 'SHIP',
    description: {
      en: 'Naval support or strike from surface units for coastal operations and deep strikes. Targets: coastal units, infrastructure, ships, and land targets. Weapon: naval artillery or anti-ship/land-attack missiles.',
      it: 'Supporto o attacco navale da unita di superficie, utile per costa e strike di profondita. Bersagli: unita costiere, infrastrutture, navi, obiettivi terrestri. Arma: artiglieria navale o missile antinave/land-attack.',
    },
    image: shipImg,
  },
  {
    id: 'patriot',
    category: { en: 'SAM SITE', it: 'SAM SITE' },
    name: 'PATRIOT',
    description: {
      en: 'US long-range, high-altitude SAM system for area defense and anti-missile operations. Range: 37.8 NM / 70,000 m. Ceiling: up to 65,600 ft. Targets: aircraft, cruise missiles, and some ballistic threats. Guidance: radar-guided / hit-to-kill depending on variant.',
      it: 'Sistema SAM statunitense a lungo raggio e alta quota, impiegato per difesa area e antimissile. Raggio: 37.8 NM / 70,000 m. Quota: fino a 65,600 ft. Bersagli: aerei, cruise missile, alcune minacce balistiche. Guida: radar-guided / hit-to-kill secondo variante.',
    },
    image: patriotImg,
  },
  {
    id: 'irist',
    category: { en: 'SAM SITE', it: 'SAM SITE' },
    name: 'IRIST',
    description: {
      en: 'Modern German medium-range system with 360-degree coverage and high precision. Range: 21.6 NM / 40,000 m. Ceiling: up to 65,600 ft. Targets: aircraft, helicopters, cruise missiles, drones. Guidance: IR seeker missile with system guidance/data link.',
      it: 'Sistema tedesco moderno a medio raggio con copertura 360 gradi e alta precisione. Raggio: 21.6 NM / 40,000 m. Quota: fino a 65,600 ft. Bersagli: aerei, elicotteri, cruise missile, droni. Guida: missile con seeker IR e data link.',
    },
    image: iristImg,
  },
  {
    id: 'nasams',
    category: { en: 'SAM SITE', it: 'SAM SITE' },
    name: 'NASAMS',
    description: {
      en: 'Norwegian-American modular short-to-medium range system for point defense. Range: 21.6 NM / 40,000 m. Ceiling: up to 50,000 ft. Targets: aircraft, helicopters, drones, cruise missiles. Guidance: active radar missiles AMRAAM / AMRAAM-ER.',
      it: 'Sistema norvegese-americano modulare a corto-medio raggio per difesa di punti sensibili. Raggio: 21.6 NM / 40,000 m. Quota: fino a 50,000 ft. Bersagli: aerei, elicotteri, droni, cruise missile. Guida: missile radar attivo AMRAAM / AMRAAM-ER.',
    },
    image: nasamsImg,
  },
  {
    id: 'fmtv',
    category: { en: 'SUPPLY & LOGISTIC', it: 'SUPPLY & LOGISTIC' },
    name: 'FMTV',
    description: {
      en: 'Medium tactical truck used for cargo, ammunition, and logistics sustainment across the frontline.',
      it: 'Camion tattico medio usato per trasporto carichi, munizioni e sostegno logistico lungo il fronte.',
    },
    image: fmtvImg,
  },
  {
    id: 'adv',
    category: { en: 'SUPPLY & LOGISTIC', it: 'SUPPLY & LOGISTIC' },
    name: 'ADV',
    description: {
      en: 'Armed escort and route-security vehicle used to protect logistic movements in contested sectors.',
      it: 'Veicolo armato di scorta e sicurezza rotta usato per proteggere i movimenti logistici in settori contesi.',
    },
    image: hmmweMgImg,
  },
  {
    id: 'supply',
    category: { en: 'SUPPLY & LOGISTIC', it: 'SUPPLY & LOGISTIC' },
    name: 'SUPPLY',
    description: {
      en: 'General supply convoy element carrying fuel and materiel for sustained operations.',
      it: 'Elemento convoglio rifornimenti per trasporto carburante e materiali a supporto di operazioni prolungate.',
    },
    image: fmtvImg,
  },
  {
    id: 'helisupply',
    category: { en: 'SUPPLY & LOGISTIC', it: 'SUPPLY & LOGISTIC' },
    name: 'HELISUPPLY',
    description: {
      en: 'Rotary-wing resupply profile to deliver urgent logistics to hard-to-reach forward positions.',
      it: 'Profilo di rifornimento ad ala rotante per consegne urgenti a posizioni avanzate difficili da raggiungere.',
    },
    image: heliSupplyImg,
  },
];

const FULLSCREEN_TRANSITION_MS = 280;
const VEHICLE_FILTER_TRANSITION_MS = 170;
const WIKI_EDITOR_IDS = new Set(['675706661570347041']);
const WIKI_SHORT_DESCRIPTION_MAX_LENGTH = 82;
const DEFAULT_LANGUAGE = 'en';
const UI_COPY = {
  en: {
    language: 'Language',
    gameplay: 'Gameplay',
    gameplaySubtitle: 'Core campaign gameplay features.',
    vehicles: 'Vehicles',
    vehiclesSubtitle: 'List of all BLUFOR spawnable assets',
    showroomListAria: 'Vehicle showroom list',
    showroomHint: 'Click to open the showroom in fullscreen',
    category: 'Category',
    vehicleName: 'Vehicle',
    vehicleImage: 'Image',
    vehicleDescription: 'Description',
    noVehicles: 'No vehicle available.',
    close: 'Close',
    fullscreen: 'Fullscreen',
    openFullscreen: 'Open fullscreen',
    closeFullscreen: 'Close fullscreen',
    editArticle: 'Edit Article',
    closeEditor: 'Close Editor',
    closeArticle: 'Close article',
    editorPreview: 'Wiki Editor + Preview',
    loadingDraft: 'Loading draft...',
    loadingArticles: 'Loading wiki articles...',
    loadingFailed: 'Unable to load wiki pages',
    noDraftSaved: 'No saved draft',
    draftLoaded: 'Draft loaded',
    savingDraft: 'Saving draft...',
    draftSaved: 'Draft saved',
    draftSaveError: 'Draft save failed',
    draftLoadError: 'Draft load failed',
    publishing: 'Publishing...',
    published: 'Article published',
    publishError: 'Publish failed',
    mediaInserted: 'Media inserted into markdown',
    mediaError: 'Media upload failed',
    uploadMedia: 'Media',
    publish: 'Publish',
    preview: 'Preview',
    titlePlaceholder: 'Article title',
    summaryPlaceholder: 'Short description',
    contentPlaceholder: 'Markdown content...',
    titlePlaceholderIt: 'Article title (Italian translation)',
    summaryPlaceholderIt: 'Short description (Italian translation)',
    contentPlaceholderIt: 'Markdown content (Italian translation)...',
    englishBase: 'English Base (Required)',
    italianTranslation: 'Italian Translation (Optional)',
    titleFallback: 'Title',
    summaryFallback: 'Short description',
    emptyContentFallback: '*No content*',
    noIcon: 'None',
    chooseIcon: 'Choose Icon',
    hideIcons: 'Hide Icons',
    searchIcon: 'Search icon...',
    iconSearchHint: 'All icons are shown below. Search is optional.',
    noIconsFound: 'No icon matches your search.',
    newTopic: 'New Topic',
    closeNewTopic: 'Close New Topic',
    createNewTopic: 'Create New Topic',
    createTopic: 'Create Topic',
    creatingTopic: 'Creating topic...',
    topicCreated: 'Article created',
    topicCreateError: 'Topic creation failed',
    fillRequiredFields: 'Fill title, summary, and content.',
    fillRequiredFieldsEn: 'Fill English title, summary, and content.',
    cancel: 'Cancel',
    topicTitlePlaceholder: 'Topic title',
    topicSummaryPlaceholder: 'Short description',
    topicContentPlaceholder: 'Initial markdown content',
    topicTitlePlaceholderIt: 'Topic title (Italian translation)',
    topicSummaryPlaceholderIt: 'Short description (Italian translation)',
    topicContentPlaceholderIt: 'Initial markdown content (Italian translation)',
    icon: 'Icon',
    customWikiArticle: 'Custom wiki article',
    lastUpdated: 'Last updated',
    notAuthenticated: 'Not authenticated',
    articleTitle: 'New Topic',
  },
  it: {
    language: 'Lingua',
    gameplay: 'Gameplay',
    gameplaySubtitle: 'Feature di gioco principali della campagna.',
    vehicles: 'Veicoli',
    vehiclesSubtitle: 'Lista di tutti gli asset BLUFOR Spawnabili',
    showroomListAria: 'Lista showroom veicoli',
    showroomHint: 'Clicca per aprire lo showroom in fullscreen',
    category: 'Categoria',
    vehicleName: 'Veicolo',
    vehicleImage: 'Immagine',
    vehicleDescription: 'Descrizione',
    noVehicles: 'Nessun veicolo disponibile.',
    close: 'Chiudi',
    fullscreen: 'Schermo Intero',
    openFullscreen: 'Apri fullscreen',
    closeFullscreen: 'Chiudi fullscreen',
    editArticle: 'Modifica Articolo',
    closeEditor: 'Chiudi Editor',
    closeArticle: 'Chiudi articolo',
    editorPreview: 'Editor Wiki + Preview',
    loadingDraft: 'Caricamento bozza...',
    loadingArticles: 'Caricamento articoli wiki...',
    loadingFailed: 'Impossibile caricare le pagine wiki',
    noDraftSaved: 'Nessuna bozza salvata',
    draftLoaded: 'Bozza caricata',
    savingDraft: 'Salvataggio bozza...',
    draftSaved: 'Bozza salvata',
    draftSaveError: 'Errore salvataggio bozza',
    draftLoadError: 'Errore caricamento bozza',
    publishing: 'Pubblicazione...',
    published: 'Articolo pubblicato',
    publishError: 'Errore pubblicazione',
    mediaInserted: 'Media inserito nel markdown',
    mediaError: 'Errore upload media',
    uploadMedia: 'Media',
    publish: 'Pubblica',
    preview: 'Preview',
    titlePlaceholder: 'Titolo articolo',
    summaryPlaceholder: 'Descrizione breve',
    contentPlaceholder: 'Contenuto markdown...',
    titlePlaceholderIt: 'Titolo articolo (traduzione italiana)',
    summaryPlaceholderIt: 'Descrizione breve (traduzione italiana)',
    contentPlaceholderIt: 'Contenuto markdown (traduzione italiana)...',
    englishBase: 'Base Inglese (Obbligatoria)',
    italianTranslation: 'Traduzione Italiana (Opzionale)',
    titleFallback: 'Titolo',
    summaryFallback: 'Descrizione breve',
    emptyContentFallback: '*Nessun contenuto*',
    noIcon: 'Nessuna',
    chooseIcon: 'Scegli Icona',
    hideIcons: 'Nascondi Icone',
    searchIcon: 'Cerca icona...',
    iconSearchHint: 'Tutte le icone sono visibili sotto. La ricerca e opzionale.',
    noIconsFound: 'Nessuna icona trovata con questa ricerca.',
    newTopic: 'Nuovo Argomento',
    closeNewTopic: 'Chiudi Nuovo Argomento',
    createNewTopic: 'Crea Nuovo Argomento',
    createTopic: 'Crea Argomento',
    creatingTopic: 'Creazione argomento...',
    topicCreated: 'Articolo creato',
    topicCreateError: 'Errore creazione argomento',
    fillRequiredFields: 'Compila titolo, descrizione e contenuto.',
    fillRequiredFieldsEn: 'Compila titolo, descrizione e contenuto in inglese.',
    cancel: 'Annulla',
    topicTitlePlaceholder: 'Titolo argomento',
    topicSummaryPlaceholder: 'Descrizione breve',
    topicContentPlaceholder: 'Contenuto markdown iniziale',
    topicTitlePlaceholderIt: 'Titolo argomento (traduzione italiana)',
    topicSummaryPlaceholderIt: 'Descrizione breve (traduzione italiana)',
    topicContentPlaceholderIt: 'Contenuto markdown iniziale (traduzione italiana)',
    icon: 'Icona',
    customWikiArticle: 'Articolo wiki personalizzato',
    lastUpdated: 'Ultimo aggiornamento',
    notAuthenticated: 'Non autenticato',
    articleTitle: 'Nuovo Argomento',
  },
};
function buildEmptyNewTopicDraft() {
  const heading = 'New Topic';
  const description = 'Write the article content here.';
  return {
    iconKey: 'layers3',
    titleEn: '',
    summaryEn: '',
    contentEn: `## ${heading}\n\n${description}`,
    titleIt: '',
    summaryIt: '',
    contentIt: '',
  };
}

function toLocalizedDraftValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      en: String(value.en || ''),
      it: String(value.it || ''),
    };
  }
  return {
    en: String(value || ''),
    it: '',
  };
}

function createWikiDraftFromSource(source = {}) {
  const title = toLocalizedDraftValue(source.title);
  const summary = toLocalizedDraftValue(source.summary);
  const content = toLocalizedDraftValue(source.content);
  return {
    iconKey: normalizeGameplayIconKey(source.iconKey || 'layers3'),
    titleEn: title.en,
    summaryEn: summary.en,
    contentEn: content.en,
    titleIt: title.it,
    summaryIt: summary.it,
    contentIt: content.it,
  };
}

function createWikiPayloadFromDraft(draft = {}) {
  return {
    iconKey: normalizeGameplayIconKey(draft.iconKey || 'layers3'),
    title: {
      en: String(draft.titleEn || '').trim(),
      it: String(draft.titleIt || '').trim(),
    },
    summary: {
      en: String(draft.summaryEn || '').trim(),
      it: String(draft.summaryIt || '').trim(),
    },
    content: {
      en: String(draft.contentEn || '').trim(),
      it: String(draft.contentIt || '').trim(),
    },
  };
}

function getDraftLocalizedField(draft = {}, field = 'title', language = DEFAULT_LANGUAGE) {
  const en = String(draft?.[`${field}En`] || '');
  const it = String(draft?.[`${field}It`] || '');
  if (language === 'it' && it) {
    return it;
  }
  return en || it;
}

function localizeText(value, language) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[language] || value.en || value.it || '';
  }
  return String(value || '');
}

function getVehicleCategoryKey(category) {
  if (category && typeof category === 'object' && !Array.isArray(category)) {
    return String(category.en || category.it || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  }
  return String(category || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

const VEHICLE_CATEGORY_KEYS = {
  airDefence: getVehicleCategoryKey('AIR DEFENCE'),
  ground: getVehicleCategoryKey('GROUND'),
  support: getVehicleCategoryKey('SUPPORT'),
  scout: getVehicleCategoryKey('SCOUT'),
  markAttack: getVehicleCategoryKey('MARK ATTACK'),
  samSite: getVehicleCategoryKey('SAM SITE'),
  supplyLogistic: getVehicleCategoryKey('SUPPLY & LOGISTIC'),
};

const DEFAULT_VEHICLE_CATEGORY_KEY = VEHICLE_CATEGORY_KEYS.airDefence;

const VEHICLE_CATEGORY_ICON_BY_KEY = {
  [VEHICLE_CATEGORY_KEYS.airDefence]: Radar,
  [VEHICLE_CATEGORY_KEYS.ground]: Waypoints,
  [VEHICLE_CATEGORY_KEYS.support]: Handshake,
  [VEHICLE_CATEGORY_KEYS.scout]: ScanEye,
  [VEHICLE_CATEGORY_KEYS.markAttack]: MapPin,
  [VEHICLE_CATEGORY_KEYS.samSite]: ShieldCheck,
  [VEHICLE_CATEGORY_KEYS.supplyLogistic]: Factory,
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64] = result.split(',');
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function inferMediaMimeType(file) {
  const fromFile = String(file?.type || '').trim().toLowerCase();
  if (fromFile.startsWith('image/') || fromFile.startsWith('video/')) {
    return fromFile;
  }

  const lowerName = String(file?.name || '').trim().toLowerCase();
  if (!lowerName) return '';

  const extensionMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
  };

  const entry = Object.entries(extensionMap).find(([extension]) => lowerName.endsWith(extension));
  return entry?.[1] || '';
}

function mediaToMarkdownSnippet(media) {
  if (!media?.url) return '';
  const safeName = String(media.fileName || media.id || 'media')
    .replaceAll('[', '')
    .replaceAll(']', '');
  if (media.type === 'image') {
    return `![${safeName}](${media.url})`;
  }
  return `[${safeName}](${media.url})`;
}

function resolveGameplayIcon(iconKey, fallback = Layers3) {
  const normalizedKey = normalizeGameplayIconKey(iconKey);
  return GAMEPLAY_ICON_MAP[normalizedKey] || fallback;
}

export default function WikiPage({ language = DEFAULT_LANGUAGE }) {
  const { user } = useUser();
  const [selectedVehicleCategoryKey, setSelectedVehicleCategoryKey] = useState(DEFAULT_VEHICLE_CATEGORY_KEY);
  const [isVehicleCategoryContentVisible, setIsVehicleCategoryContentVisible] = useState(true);
  const [wikiPagesById, setWikiPagesById] = useState({});
  const [wikiLoading, setWikiLoading] = useState(true);
  const [wikiError, setWikiError] = useState('');
  const [selectedGameplayId, setSelectedGameplayId] = useState('');
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [newTopicDraft, setNewTopicDraft] = useState(() => buildEmptyNewTopicDraft());
  const [newTopicStatus, setNewTopicStatus] = useState('');
  const [newTopicIconPickerOpen, setNewTopicIconPickerOpen] = useState(false);
  const [newTopicIconSearch, setNewTopicIconSearch] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [isGameplayArticleFullscreen, setIsGameplayArticleFullscreen] = useState(false);
  const [isGameplayArticleFullscreenActive, setIsGameplayArticleFullscreenActive] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [wikiDraftIconPickerOpen, setWikiDraftIconPickerOpen] = useState(false);
  const [wikiDraftIconSearch, setWikiDraftIconSearch] = useState('');
  const [wikiDraft, setWikiDraft] = useState(() => createWikiDraftFromSource({ iconKey: 'layers3' }));
  const [draftStatus, setDraftStatus] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const vehicleCategorySwitchTimeoutRef = useRef(null);
  const vehicleCategoryShowRafRef = useRef(null);
  const gameplayCloseTimeoutRef = useRef(null);
  const gameplayOpenRafRef = useRef(null);
  const wikiSaveTimerRef = useRef(null);
  const lastSavedDraftSerializedRef = useRef('');
  const wikiMediaInputRef = useRef(null);
  const newTopicMediaInputRef = useRef(null);
  const markdownTextareaRefs = useRef(new Map());
  const activeMarkdownEditorRef = useRef(null);
  const pendingMarkdownCaretRef = useRef(null);

  const canEditWiki = Boolean(user?.id && WIKI_EDITOR_IDS.has(String(user.id)));
  const ui = UI_COPY[language] || UI_COPY.en;
  const dateLocale = language === 'it' ? 'it-IT' : 'en-US';

  const filteredNewTopicIcons = useMemo(() => {
    const query = String(newTopicIconSearch || '').trim().toLowerCase();
    if (!query) return GAMEPLAY_ICON_LIBRARY;
    return GAMEPLAY_ICON_LIBRARY.filter((iconDef) => iconDef.label.toLowerCase().includes(query));
  }, [newTopicIconSearch]);

  const filteredDraftIcons = useMemo(() => {
    const query = String(wikiDraftIconSearch || '').trim().toLowerCase();
    if (!query) return GAMEPLAY_ICON_LIBRARY;
    return GAMEPLAY_ICON_LIBRARY.filter((iconDef) => iconDef.label.toLowerCase().includes(query));
  }, [wikiDraftIconSearch]);

  const vehicleGroups = useMemo(() => {
    const groupsByKey = new Map();
    VEHICLES.forEach((vehicle) => {
      const categoryKey = getVehicleCategoryKey(vehicle.category);
      if (!groupsByKey.has(categoryKey)) {
        groupsByKey.set(categoryKey, {
          key: categoryKey,
          category: vehicle.category,
          vehicles: [],
        });
      }
      groupsByKey.get(categoryKey).vehicles.push(vehicle);
    });
    return Array.from(groupsByKey.values());
  }, []);

  const selectedVehicleGroup = useMemo(
    () => vehicleGroups.find((group) => group.key === selectedVehicleCategoryKey) || vehicleGroups[0] || null,
    [vehicleGroups, selectedVehicleCategoryKey],
  );

  useEffect(() => {
    if (!vehicleGroups.length) return;
    if (vehicleGroups.some((group) => group.key === selectedVehicleCategoryKey)) {
      return;
    }
    const supportGroup = vehicleGroups.find((group) => group.key === DEFAULT_VEHICLE_CATEGORY_KEY);
    setSelectedVehicleCategoryKey(supportGroup ? supportGroup.key : vehicleGroups[0].key);
  }, [vehicleGroups, selectedVehicleCategoryKey]);

  const gameplayItems = useMemo(() => {
    const featureById = new Map(GAMEPLAY_FEATURES.map((feature) => [feature.id, feature]));

    const baseItems = GAMEPLAY_FEATURES.map((feature) => {
      const page = wikiPagesById[feature.id];
      const Icon = resolveGameplayIcon(page?.iconKey, feature.Icon);
      return {
        ...feature,
        iconKey: normalizeGameplayIconKey(page?.iconKey || feature.iconKey || ''),
        Icon,
        title: localizeText(page?.title, language) || localizeText(feature.title, language),
        description: localizeText(page?.summary, language) || localizeText(feature.description, language),
      };
    });

    const customItems = Object.values(wikiPagesById)
      .filter((page) => page?.id && !featureById.has(page.id))
      .sort((a, b) => (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0))
      .map((page) => ({
        id: page.id,
        iconKey: normalizeGameplayIconKey(page.iconKey || 'layers3'),
        title: localizeText(page.title, language) || page.id,
        description: localizeText(page.summary, language) || ui.customWikiArticle,
        Icon: resolveGameplayIcon(page.iconKey, Layers3),
      }));

    return [...baseItems, ...customItems];
  }, [wikiPagesById, language, ui.customWikiArticle]);

  const selectedGameplayFeature = useMemo(() => {
    if (!gameplayItems.length) return null;
    const fallback = gameplayItems[0];
    if (!selectedGameplayId) return fallback;
    return gameplayItems.find((item) => item.id === selectedGameplayId) || fallback;
  }, [gameplayItems, selectedGameplayId]);

  const selectedGameplayPage = useMemo(() => {
    if (!selectedGameplayFeature) return null;
    const page = wikiPagesById[selectedGameplayFeature.id];
    if (page) {
      return {
        ...page,
        iconKey: normalizeGameplayIconKey(page.iconKey || selectedGameplayFeature.iconKey || 'layers3'),
      };
    }
    return {
      id: selectedGameplayFeature.id,
      iconKey: normalizeGameplayIconKey(selectedGameplayFeature.iconKey || 'layers3'),
      title: selectedGameplayFeature.title,
      summary: selectedGameplayFeature.description,
      content: `## ${selectedGameplayFeature.title}\n\n${selectedGameplayFeature.description}`,
      updatedAt: null,
      updatedBy: null,
    };
  }, [selectedGameplayFeature, wikiPagesById]);

  const selectedGameplayPageTitle = useMemo(
    () => localizeText(selectedGameplayPage?.title, language) || ui.titleFallback,
    [selectedGameplayPage?.title, language, ui.titleFallback],
  );
  const selectedGameplayPageSummary = useMemo(
    () => localizeText(selectedGameplayPage?.summary, language) || ui.summaryFallback,
    [selectedGameplayPage?.summary, language, ui.summaryFallback],
  );
  const selectedGameplayPageContent = useMemo(
    () => localizeText(selectedGameplayPage?.content, language) || ui.emptyContentFallback,
    [selectedGameplayPage?.content, language, ui.emptyContentFallback],
  );

  const NewTopicSelectedIcon = useMemo(
    () => resolveGameplayIcon(newTopicDraft.iconKey, Layers3),
    [newTopicDraft.iconKey],
  );

  const markdownComponents = useMemo(() => ({
    h1: ({ node, ...props }) => <h1 className="mb-2 mt-4 text-2xl font-black uppercase tracking-[0.04em] text-yt-text-primary" {...props} />,
    h2: ({ node, ...props }) => <h2 className="mb-2 mt-4 text-xl font-extrabold uppercase tracking-[0.04em] text-yt-text-primary" {...props} />,
    h3: ({ node, ...props }) => <h3 className="mb-2 mt-3 text-lg font-bold text-yt-text-primary" {...props} />,
    p: ({ node, ...props }) => <p className="mb-3 leading-relaxed text-yt-text-secondary" {...props} />,
    ul: ({ node, ...props }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-yt-text-secondary" {...props} />,
    ol: ({ node, ...props }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-yt-text-secondary" {...props} />,
    li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
    table: ({ node, ...props }) => (
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm text-yt-text-secondary" {...props} />
      </div>
    ),
    thead: ({ node, ...props }) => <thead className="bg-[#0f1a2a]" {...props} />,
    th: ({ node, ...props }) => <th className="border border-yt-border/80 px-3 py-2 text-left font-bold text-yt-text-primary" {...props} />,
    td: ({ node, ...props }) => <td className="border border-yt-border/70 px-3 py-2 align-top" {...props} />,
    blockquote: ({ node, ...props }) => <blockquote className="mb-3 border-l-2 border-yt-accent/60 pl-3 text-yt-text-secondary/95" {...props} />,
    a: ({ node, ...props }) => <a className="text-yt-accent underline" target="_blank" rel="noreferrer" {...props} />,
    img: ({ node, ...props }) => <img className="my-3 max-h-[420px] w-auto max-w-full rounded border border-yt-border/80 bg-[#0b121d] p-1" loading="lazy" {...props} />,
    code: ({ inline, className, children, ...props }) => (
      inline
        ? <code className="rounded bg-[#0e1827] px-1.5 py-0.5 text-[0.95em] text-yt-accent" {...props}>{children}</code>
        : <code className="block overflow-x-auto rounded-xl border border-yt-border/80 bg-[#0b121d] p-3 text-sm text-yt-text-primary" {...props}>{children}</code>
    ),
  }), []);

  const closeGameplayArticleFullscreen = () => {
    setIsGameplayArticleFullscreenActive(false);
    if (gameplayCloseTimeoutRef.current) {
      clearTimeout(gameplayCloseTimeoutRef.current);
    }
    gameplayCloseTimeoutRef.current = setTimeout(() => {
      setIsGameplayArticleFullscreen(false);
    }, FULLSCREEN_TRANSITION_MS);
  };

  const openGameplayArticleFullscreen = () => {
    if (gameplayCloseTimeoutRef.current) {
      clearTimeout(gameplayCloseTimeoutRef.current);
      gameplayCloseTimeoutRef.current = null;
    }
    setIsGameplayArticleFullscreen(true);
    gameplayOpenRafRef.current = requestAnimationFrame(() => {
      setIsGameplayArticleFullscreenActive(true);
    });
  };

  useEffect(() => {
    if (!isGameplayArticleFullscreen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      closeGameplayArticleFullscreen();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isGameplayArticleFullscreen]);

  useEffect(() => () => {
    if (vehicleCategorySwitchTimeoutRef.current) {
      clearTimeout(vehicleCategorySwitchTimeoutRef.current);
    }
    if (vehicleCategoryShowRafRef.current) {
      cancelAnimationFrame(vehicleCategoryShowRafRef.current);
    }
    if (gameplayCloseTimeoutRef.current) {
      clearTimeout(gameplayCloseTimeoutRef.current);
    }
    if (gameplayOpenRafRef.current) {
      cancelAnimationFrame(gameplayOpenRafRef.current);
    }
    if (wikiSaveTimerRef.current) {
      clearTimeout(wikiSaveTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const loadWikiPages = async () => {
      try {
        setWikiLoading(true);
        setWikiError('');
        const response = await api.getWikiPages();
        const pages = Array.isArray(response?.pages) ? response.pages : [];
        const byId = {};
        pages.forEach((page) => {
          if (page?.id) {
            byId[page.id] = page;
          }
        });
        setWikiPagesById(byId);
      } catch (error) {
        setWikiError(error.message || ui.loadingFailed);
      } finally {
        setWikiLoading(false);
      }
    };

    loadWikiPages();
  }, [ui.loadingFailed]);

  useEffect(() => {
    if (!gameplayItems.length) return;
    if (selectedGameplayId) return;
    setSelectedGameplayId(gameplayItems[0].id);
  }, [gameplayItems, selectedGameplayId]);

  useEffect(() => {
    if (!canEditWiki || !editorOpen || !selectedGameplayFeature?.id) {
      return;
    }

    let cancelled = false;

    const loadDraft = async () => {
      try {
        setDraftLoading(true);
        setDraftStatus(ui.loadingDraft);
        const response = await api.getWikiDraft(selectedGameplayFeature.id);
        if (cancelled) return;
        const incomingDraft = response?.draft;
        const basePage = selectedGameplayPage || {};
        const nextDraft = incomingDraft
          ? createWikiDraftFromSource({
            iconKey: incomingDraft.iconKey || basePage.iconKey || 'layers3',
            title: incomingDraft.title || basePage.title || '',
            summary: incomingDraft.summary || basePage.summary || '',
            content: incomingDraft.content || basePage.content || '',
          })
          : createWikiDraftFromSource({
            iconKey: basePage.iconKey || 'layers3',
            title: basePage.title || '',
            summary: basePage.summary || '',
            content: basePage.content || '',
          });
        setWikiDraft(nextDraft);
        lastSavedDraftSerializedRef.current = JSON.stringify(nextDraft);
        setDraftStatus(incomingDraft ? ui.draftLoaded : ui.noDraftSaved);
      } catch (error) {
        if (cancelled) return;
        const basePage = selectedGameplayPage || {};
        const fallback = createWikiDraftFromSource({
          iconKey: basePage.iconKey || 'layers3',
          title: basePage.title || '',
          summary: basePage.summary || '',
          content: basePage.content || '',
        });
        setWikiDraft(fallback);
        lastSavedDraftSerializedRef.current = JSON.stringify(fallback);
        if (String(error?.message || '').includes('404')) {
          setDraftStatus(ui.noDraftSaved);
        } else {
          setDraftStatus(error.message || ui.draftLoadError);
        }
      } finally {
        if (!cancelled) {
          setDraftLoading(false);
        }
      }
    };

    loadDraft();
    return () => {
      cancelled = true;
    };
  }, [canEditWiki, editorOpen, selectedGameplayFeature?.id, selectedGameplayPage, ui.loadingDraft, ui.draftLoaded, ui.noDraftSaved, ui.draftLoadError]);

  useEffect(() => {
    if (!canEditWiki || !editorOpen || draftLoading || !selectedGameplayFeature?.id) {
      return;
    }

    const serialized = JSON.stringify(wikiDraft);
    if (serialized === lastSavedDraftSerializedRef.current) {
      return;
    }

    if (wikiSaveTimerRef.current) {
      clearTimeout(wikiSaveTimerRef.current);
    }

    wikiSaveTimerRef.current = setTimeout(async () => {
      try {
        setDraftStatus(ui.savingDraft);
        await api.saveWikiDraft(selectedGameplayFeature.id, createWikiPayloadFromDraft(wikiDraft));
        lastSavedDraftSerializedRef.current = serialized;
        setDraftStatus(ui.draftSaved);
      } catch (error) {
        setDraftStatus(error.message || ui.draftSaveError);
      } finally {
        wikiSaveTimerRef.current = null;
      }
    }, 900);
  }, [canEditWiki, draftLoading, editorOpen, selectedGameplayFeature?.id, wikiDraft, ui.savingDraft, ui.draftSaved, ui.draftSaveError]);

  const getMarkdownEditorKey = (scope, field) => `${scope}:${field}`;

  const bindMarkdownEditorRef = (scope, field) => (element) => {
    const key = getMarkdownEditorKey(scope, field);
    if (element) {
      markdownTextareaRefs.current.set(key, element);
    } else {
      markdownTextareaRefs.current.delete(key);
    }
  };

  const syncMarkdownSelection = (scope, field) => {
    const element = markdownTextareaRefs.current.get(getMarkdownEditorKey(scope, field));
    if (!element) return;
    activeMarkdownEditorRef.current = {
      scope,
      field,
      selectionStart: Number.isFinite(element.selectionStart) ? element.selectionStart : 0,
      selectionEnd: Number.isFinite(element.selectionEnd) ? element.selectionEnd : 0,
    };
  };

  const insertMarkdownSnippetAtSelection = (snippet, scope) => {
    if (!snippet) return;

    const active = activeMarkdownEditorRef.current;
    const sameScope = active?.scope === scope;
    const targetField = sameScope && active?.field === 'contentIt' ? 'contentIt' : 'contentEn';
    let nextCaret = null;

    const setDraftState = scope === 'wikiDraft' ? setWikiDraft : setNewTopicDraft;
    setDraftState((prev) => {
      const currentValue = String(prev?.[targetField] || '');
      const rawStart = Number(sameScope ? active?.selectionStart : currentValue.length);
      const rawEnd = Number(sameScope ? active?.selectionEnd : rawStart);
      const start = Math.max(0, Math.min(currentValue.length, Number.isFinite(rawStart) ? rawStart : currentValue.length));
      const end = Math.max(start, Math.min(currentValue.length, Number.isFinite(rawEnd) ? rawEnd : start));

      const before = currentValue.slice(0, start);
      const after = currentValue.slice(end);
      const leading = start > 0 && !before.endsWith('\n') ? '\n' : '';
      const trailing = !after.startsWith('\n') ? '\n' : '';
      const insertion = `${leading}${snippet}${trailing}`;
      const nextValue = `${before}${insertion}${after}`;
      const caretPosition = start + insertion.length;

      nextCaret = {
        scope,
        field: targetField,
        position: caretPosition,
      };

      return {
        ...prev,
        [targetField]: nextValue,
      };
    });

    pendingMarkdownCaretRef.current = nextCaret;
    requestAnimationFrame(() => {
      const pending = pendingMarkdownCaretRef.current;
      if (!pending) return;
      const element = markdownTextareaRefs.current.get(getMarkdownEditorKey(pending.scope, pending.field));
      if (!element) {
        pendingMarkdownCaretRef.current = null;
        return;
      }
      element.focus();
      element.setSelectionRange(pending.position, pending.position);
      activeMarkdownEditorRef.current = {
        scope: pending.scope,
        field: pending.field,
        selectionStart: pending.position,
        selectionEnd: pending.position,
      };
      pendingMarkdownCaretRef.current = null;
    });
  };

  const handleVehicleCategoryFilterChange = (nextCategoryKey) => {
    if (!nextCategoryKey || nextCategoryKey === selectedVehicleCategoryKey) {
      return;
    }

    if (vehicleCategorySwitchTimeoutRef.current) {
      clearTimeout(vehicleCategorySwitchTimeoutRef.current);
    }
    if (vehicleCategoryShowRafRef.current) {
      cancelAnimationFrame(vehicleCategoryShowRafRef.current);
      vehicleCategoryShowRafRef.current = null;
    }

    setIsVehicleCategoryContentVisible(false);

    vehicleCategorySwitchTimeoutRef.current = setTimeout(() => {
      setSelectedVehicleCategoryKey(nextCategoryKey);
      vehicleCategoryShowRafRef.current = requestAnimationFrame(() => {
        setIsVehicleCategoryContentVisible(true);
      });
      vehicleCategorySwitchTimeoutRef.current = null;
    }, VEHICLE_FILTER_TRANSITION_MS);
  };

  const handleSelectGameplayItem = (itemId) => {
    setSelectedGameplayId(itemId);
    setEditorOpen(false);
    setWikiDraftIconPickerOpen(false);
    setWikiDraftIconSearch('');
    setDraftStatus('');
    setNewTopicOpen(false);
    setNewTopicIconPickerOpen(false);
    setNewTopicIconSearch('');
    setNewTopicStatus('');
    openGameplayArticleFullscreen();
  };

  const handleCreateGameplayTopic = async () => {
    if (!canEditWiki) return;

    const iconKey = normalizeGameplayIconKey(newTopicDraft.iconKey || 'layers3');
    const titleEn = String(newTopicDraft.titleEn || '').trim();
    const summaryEn = String(newTopicDraft.summaryEn || '').trim();
    const contentEn = String(newTopicDraft.contentEn || '').trim();
    const titleIt = String(newTopicDraft.titleIt || '').trim();
    const summaryIt = String(newTopicDraft.summaryIt || '').trim();
    const contentIt = String(newTopicDraft.contentIt || '').trim();

    if (!titleEn || !summaryEn || !contentEn) {
      setNewTopicStatus(ui.fillRequiredFieldsEn);
      return;
    }

    try {
      setCreatingTopic(true);
      setNewTopicStatus(ui.creatingTopic);
      const response = await api.createWikiPage({
        iconKey,
        title: { en: titleEn, it: titleIt },
        summary: { en: summaryEn, it: summaryIt },
        content: { en: contentEn, it: contentIt },
      });
      const createdPage = response?.page;
      if (!createdPage?.id) {
        throw new Error(ui.topicCreateError);
      }

      setWikiPagesById((prev) => ({
        ...prev,
        [createdPage.id]: createdPage,
      }));
      setSelectedGameplayId(createdPage.id);
      setEditorOpen(true);

      const createdDraft = createWikiDraftFromSource({
        iconKey: createdPage.iconKey || iconKey || 'layers3',
        title: createdPage.title || { en: titleEn, it: titleIt },
        summary: createdPage.summary || { en: summaryEn, it: summaryIt },
        content: createdPage.content || { en: contentEn, it: contentIt },
      });
      setWikiDraft(createdDraft);
      lastSavedDraftSerializedRef.current = JSON.stringify(createdDraft);
      setDraftStatus(ui.topicCreated);

      setNewTopicOpen(false);
      setNewTopicIconPickerOpen(false);
      setNewTopicIconSearch('');
      setNewTopicStatus('');
      setNewTopicDraft(buildEmptyNewTopicDraft());
      if (newTopicMediaInputRef.current) {
        newTopicMediaInputRef.current.value = '';
      }
      openGameplayArticleFullscreen();
    } catch (error) {
      setNewTopicStatus(error.message || ui.topicCreateError);
    } finally {
      setCreatingTopic(false);
    }
  };

  const handlePublishGameplayArticle = async () => {
    if (!canEditWiki || !selectedGameplayFeature?.id) return;
    const payload = createWikiPayloadFromDraft(wikiDraft);
    if (!payload.title.en || !payload.summary.en || !payload.content.en) {
      setDraftStatus(ui.fillRequiredFieldsEn);
      return;
    }
    try {
      setDraftStatus(ui.publishing);
      const response = await api.updateWikiPage(selectedGameplayFeature.id, payload);
      const updatedPage = response?.page;
      if (updatedPage?.id) {
        setWikiPagesById((prev) => ({
          ...prev,
          [updatedPage.id]: updatedPage,
        }));
      }
      lastSavedDraftSerializedRef.current = JSON.stringify(wikiDraft);
      setDraftStatus(ui.published);
      setEditorOpen(false);
    } catch (error) {
      setDraftStatus(error.message || ui.publishError);
    }
  };

  const handleUploadWikiMedia = async (files) => {
    if (!canEditWiki || !selectedGameplayFeature?.id || !files?.length) return;

    try {
      setUploadingMedia(true);
      const skipped = [];
      const failed = [];
      let uploaded = 0;

      for (const file of files) {
        const mimeType = inferMediaMimeType(file);
        if (!mimeType) {
          skipped.push(file?.name || 'file');
          continue;
        }
        try {
          const base64Data = await fileToBase64(file);
          const response = await api.uploadWikiMedia({
            fileName: file.name,
            mimeType,
            base64Data,
          });
          const media = response?.media;
          const snippet = mediaToMarkdownSnippet(media);
          if (!snippet) {
            failed.push(`${file.name}: invalid upload response`);
            continue;
          }
          insertMarkdownSnippetAtSelection(snippet, 'wikiDraft');
          uploaded += 1;
        } catch (error) {
          failed.push(`${file?.name || 'file'}: ${error.message || ui.mediaError}`);
        }
      }

      if (uploaded > 0) {
        setDraftStatus(ui.mediaInserted);
      } else if (!failed.length && !skipped.length) {
        setDraftStatus(ui.mediaError);
      }
      if (failed.length || skipped.length) {
        const details = [];
        if (skipped.length > 0) {
          details.push(`Unsupported: ${skipped.join(', ')}`);
        }
        if (failed.length > 0) {
          details.push(`Errors: ${failed.join(' | ')}`);
        }
        setDraftStatus(details.join(' - '));
      }
    } catch (error) {
      setDraftStatus(error.message || ui.mediaError);
    } finally {
      setUploadingMedia(false);
      if (wikiMediaInputRef.current) {
        wikiMediaInputRef.current.value = '';
      }
    }
  };

  const handleUploadNewTopicMedia = async (files) => {
    if (!canEditWiki || !files?.length) return;

    try {
      setUploadingMedia(true);
      const skipped = [];
      const failed = [];
      let uploaded = 0;

      for (const file of files) {
        const mimeType = inferMediaMimeType(file);
        if (!mimeType) {
          skipped.push(file?.name || 'file');
          continue;
        }
        try {
          const base64Data = await fileToBase64(file);
          const response = await api.uploadWikiMedia({
            fileName: file.name,
            mimeType,
            base64Data,
          });
          const media = response?.media;
          const snippet = mediaToMarkdownSnippet(media);
          if (!snippet) {
            failed.push(`${file.name}: invalid upload response`);
            continue;
          }
          insertMarkdownSnippetAtSelection(snippet, 'newTopicDraft');
          uploaded += 1;
        } catch (error) {
          failed.push(`${file?.name || 'file'}: ${error.message || ui.mediaError}`);
        }
      }

      if (uploaded > 0) {
        setNewTopicStatus(ui.mediaInserted);
      } else if (!failed.length && !skipped.length) {
        setNewTopicStatus(ui.mediaError);
      }
      if (failed.length || skipped.length) {
        const details = [];
        if (skipped.length > 0) {
          details.push(`Unsupported: ${skipped.join(', ')}`);
        }
        if (failed.length > 0) {
          details.push(`Errors: ${failed.join(' | ')}`);
        }
        setNewTopicStatus(details.join(' - '));
      }
    } catch (error) {
      setNewTopicStatus(error.message || ui.mediaError);
    } finally {
      setUploadingMedia(false);
      if (newTopicMediaInputRef.current) {
        newTopicMediaInputRef.current.value = '';
      }
    }
  };

  const handleMarkdownDragOver = (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleMarkdownDrop = (event, scope, field) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;

    const textarea = event.currentTarget;
    textarea.focus();
    const fallbackPosition = String(textarea.value || '').length;
    const selectionStart = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : fallbackPosition;
    const selectionEnd = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : selectionStart;

    activeMarkdownEditorRef.current = {
      scope,
      field,
      selectionStart,
      selectionEnd,
    };

    if (scope === 'wikiDraft') {
      handleUploadWikiMedia(files);
      return;
    }
    handleUploadNewTopicMedia(files);
  };

  const renderGameplayArticleContent = () => {
    if (!selectedGameplayPage) {
      return null;
    }
    const SelectedArticleIcon = resolveGameplayIcon(selectedGameplayPage.iconKey, Layers3);
    const DraftIcon = resolveGameplayIcon(wikiDraft.iconKey, Layers3);

    return (
      <article className="flex h-full flex-col rounded-2xl border border-yt-border/80 bg-[#0f1723] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="inline-flex items-center gap-2 text-xl font-extrabold uppercase tracking-[0.05em] text-yt-text-primary">
              <SelectedArticleIcon className="h-5 w-5 text-yt-accent" />
              {selectedGameplayPageTitle}
            </h3>
            <p className="mt-1 text-sm text-yt-text-secondary">{selectedGameplayPageSummary}</p>
            {selectedGameplayPage.updatedAt && (
              <p className="mt-1 text-xs text-yt-text-secondary/80">
                {ui.lastUpdated}: {new Date(selectedGameplayPage.updatedAt).toLocaleString(dateLocale)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEditWiki && (
              <button
                type="button"
                onClick={() => setEditorOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
              >
                <PenSquare className="h-3.5 w-3.5" />
                {editorOpen ? ui.closeEditor : ui.editArticle}
              </button>
            )}
            <button
              type="button"
              onClick={closeGameplayArticleFullscreen}
              className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
              aria-label={ui.closeArticle}
            >
              <X className="h-3.5 w-3.5" />
              {ui.close}
            </button>
          </div>
        </div>

        <div
          className={`overflow-auto rounded-xl border border-yt-border/75 bg-[#0c1320] px-4 py-3 ${
            canEditWiki && editorOpen ? 'max-h-[40vh] sm:max-h-[46vh]' : 'min-h-0 flex-1'
          }`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {selectedGameplayPageContent}
          </ReactMarkdown>
        </div>

        {canEditWiki && editorOpen && (
          <div className="mt-4 rounded-xl border border-yt-border/80 bg-[#0b121d] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-yt-text-secondary">
                <Eye className="h-3.5 w-3.5" />
                {ui.editorPreview}
              </div>
              <div className="text-xs text-yt-text-secondary">{draftStatus}</div>
            </div>

            {draftLoading ? (
              <div className="flex items-center gap-2 text-sm text-yt-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                {ui.loadingDraft}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.09em] text-yt-text-secondary">{ui.icon}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWikiDraftIconPickerOpen((prev) => !prev)}
                        className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent"
                      >
                        <DraftIcon className="h-3.5 w-3.5 text-yt-accent" />
                        {wikiDraftIconPickerOpen ? ui.hideIcons : ui.chooseIcon}
                      </button>
                      <span className="text-xs text-yt-text-secondary">
                        {GAMEPLAY_ICON_LABEL_MAP[normalizeGameplayIconKey(wikiDraft.iconKey)] || ui.noIcon}
                      </span>
                    </div>
                    {wikiDraftIconPickerOpen && (
                      <div className="mt-2 space-y-2 rounded border border-yt-border/70 bg-[#0f1725] p-2.5">
                        <p className="text-[11px] text-yt-text-secondary">
                          {ui.iconSearchHint}
                        </p>
                        <input
                          type="text"
                          value={wikiDraftIconSearch}
                          onChange={(event) => setWikiDraftIconSearch(event.target.value)}
                          placeholder={ui.searchIcon}
                          className="w-full rounded border border-yt-border/80 bg-[#111a28] px-2.5 py-1.5 text-xs text-yt-text-primary outline-none focus:border-yt-accent"
                        />
                        <div className="max-h-56 overflow-y-auto pr-1">
                          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
                            {filteredDraftIcons.map(({ key, label, Icon }) => {
                              const selected = normalizeGameplayIconKey(wikiDraft.iconKey) === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  title={label}
                                  onClick={() => {
                                    setWikiDraft((prev) => ({ ...prev, iconKey: key }));
                                    setWikiDraftIconPickerOpen(false);
                                    setWikiDraftIconSearch('');
                                  }}
                                  className={`inline-flex h-9 items-center justify-center rounded border transition-colors ${
                                    selected
                                      ? 'border-yt-accent bg-yt-accent/20 text-yt-accent'
                                      : 'border-yt-border/80 bg-[#101827] text-yt-text-secondary hover:border-yt-accent/70 hover:text-yt-accent'
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </button>
                              );
                            })}
                          </div>
                          {filteredDraftIcons.length === 0 && (
                            <p className="px-1 py-2 text-xs text-yt-text-secondary">{ui.noIconsFound}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-yt-accent">{ui.englishBase}</p>
                  <input
                    type="text"
                    value={wikiDraft.titleEn}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, titleEn: event.target.value }))}
                    placeholder={ui.titlePlaceholder}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={3}
                    value={wikiDraft.summaryEn}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, summaryEn: event.target.value }))}
                    placeholder={ui.summaryPlaceholder}
                    maxLength={WIKI_SHORT_DESCRIPTION_MAX_LENGTH}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={10}
                    value={wikiDraft.contentEn}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, contentEn: event.target.value }))}
                    ref={bindMarkdownEditorRef('wikiDraft', 'contentEn')}
                    onFocus={() => syncMarkdownSelection('wikiDraft', 'contentEn')}
                    onClick={() => syncMarkdownSelection('wikiDraft', 'contentEn')}
                    onSelect={() => syncMarkdownSelection('wikiDraft', 'contentEn')}
                    onKeyUp={() => syncMarkdownSelection('wikiDraft', 'contentEn')}
                    onDragOver={handleMarkdownDragOver}
                    onDrop={(event) => handleMarkdownDrop(event, 'wikiDraft', 'contentEn')}
                    placeholder={ui.contentPlaceholder}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 font-mono text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />

                  <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.09em] text-yt-text-secondary">{ui.italianTranslation}</p>
                  <input
                    type="text"
                    value={wikiDraft.titleIt}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, titleIt: event.target.value }))}
                    placeholder={ui.titlePlaceholderIt}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={3}
                    value={wikiDraft.summaryIt}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, summaryIt: event.target.value }))}
                    placeholder={ui.summaryPlaceholderIt}
                    maxLength={WIKI_SHORT_DESCRIPTION_MAX_LENGTH}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={8}
                    value={wikiDraft.contentIt}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, contentIt: event.target.value }))}
                    ref={bindMarkdownEditorRef('wikiDraft', 'contentIt')}
                    onFocus={() => syncMarkdownSelection('wikiDraft', 'contentIt')}
                    onClick={() => syncMarkdownSelection('wikiDraft', 'contentIt')}
                    onSelect={() => syncMarkdownSelection('wikiDraft', 'contentIt')}
                    onKeyUp={() => syncMarkdownSelection('wikiDraft', 'contentIt')}
                    onDragOver={handleMarkdownDragOver}
                    onDrop={(event) => handleMarkdownDrop(event, 'wikiDraft', 'contentIt')}
                    placeholder={ui.contentPlaceholderIt}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 font-mono text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePublishGameplayArticle}
                      className="inline-flex items-center gap-1 rounded border border-emerald-500/45 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-emerald-300"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {ui.publish}
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent">
                      {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {ui.uploadMedia}
                      <input
                        ref={wikiMediaInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={(event) => handleUploadWikiMedia(Array.from(event.target.files || []))}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
                      className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                      {ui.close}
                    </button>
                  </div>
                </div>

                <div className="rounded border border-yt-border/80 bg-[#111a28] p-3">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-yt-accent">{ui.preview}</h4>
                  <h3 className="inline-flex items-center gap-2 text-lg font-extrabold uppercase tracking-[0.05em] text-yt-text-primary">
                    <DraftIcon className="h-4 w-4 text-yt-accent" />
                    {getDraftLocalizedField(wikiDraft, 'title', language) || ui.titleFallback}
                  </h3>
                  <p className="mb-3 mt-1 text-sm text-yt-text-secondary">
                    {getDraftLocalizedField(wikiDraft, 'summary', language) || ui.summaryFallback}
                  </p>
                  <div className="max-h-[420px] overflow-auto rounded border border-yt-border/70 bg-[#0c1320] px-3 py-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {getDraftLocalizedField(wikiDraft, 'content', language) || ui.emptyContentFallback}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  const renderShowroomContent = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black uppercase tracking-[0.08em] text-yt-text-primary">{ui.vehicles}</h2>
        <p className="mt-1 text-xs text-yt-text-secondary">{ui.vehiclesSubtitle}</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[64px,minmax(0,1fr)]">
        <aside className="h-fit self-start rounded-2xl border border-yt-border/80 bg-[#0f1723] p-1.5">
          <div className="flex items-center justify-center gap-2 lg:flex-col">
            {vehicleGroups.map((group) => {
              const categoryLabel = localizeText(group.category, language);
              const active = selectedVehicleGroup?.key === group.key;
              const CategoryIcon = VEHICLE_CATEGORY_ICON_BY_KEY[group.key] || Package;

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => handleVehicleCategoryFilterChange(group.key)}
                  title={categoryLabel}
                  aria-label={categoryLabel}
                  aria-pressed={active}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${
                    active
                      ? 'border-yt-accent/70 bg-yt-accent/15 text-yt-accent shadow-[0_0_0_1px_rgba(78,197,255,0.24)]'
                      : 'border-yt-border/80 bg-[#111a28] text-yt-text-secondary hover:border-yt-accent/45 hover:text-yt-accent'
                  }`}
                >
                  <CategoryIcon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </aside>

        {!selectedVehicleGroup ? (
          <p className="flex items-center rounded-xl border border-yt-border/75 bg-[#0f1723] px-4 py-3 text-sm text-yt-text-secondary">
            {ui.noVehicles}
          </p>
        ) : (
          <article
            key={selectedVehicleGroup.key}
            className={`rounded-2xl border border-yt-border/80 bg-[#0f1723] p-4 transition-all duration-200 ease-out ${
              isVehicleCategoryContentVisible ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
            }`}
          >
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-[0.1em] text-yt-accent">
              {localizeText(selectedVehicleGroup.category, language)}
            </h3>
            <div className="max-h-[min(72vh,620px)] overflow-auto rounded-xl border border-yt-border/70">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-[#111b2a]">
                  <tr>
                    <th className="border border-yt-border/70 px-3 py-2 text-left font-bold uppercase tracking-[0.08em] text-yt-text-primary">
                      {ui.vehicleName}
                    </th>
                    <th className="border border-yt-border/70 px-3 py-2 text-left font-bold uppercase tracking-[0.08em] text-yt-text-primary">
                      {ui.vehicleImage}
                    </th>
                    <th className="border border-yt-border/70 px-3 py-2 text-left font-bold uppercase tracking-[0.08em] text-yt-text-primary">
                      {ui.vehicleDescription}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVehicleGroup.vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="bg-[#0f1723] align-top">
                      <td className="border border-yt-border/70 px-3 py-2 font-semibold text-yt-text-primary">
                        {vehicle.name}
                      </td>
                      <td className="border border-yt-border/70 px-3 py-2">
                        <img
                          src={vehicle.image}
                          alt={vehicle.name}
                          className="h-12 w-20 object-contain sm:h-14 sm:w-24"
                          loading="lazy"
                        />
                      </td>
                      <td className="border border-yt-border/70 px-3 py-2 leading-relaxed text-yt-text-secondary">
                        {localizeText(vehicle.description, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-6">
      <section className="rounded-3xl border border-yt-border/70 bg-yt-bg-secondary/85 p-5 shadow-[0_16px_34px_rgba(0,0,0,0.32)] backdrop-blur-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-yt-accent/35 bg-yt-accent/12 p-2">
              <Gamepad2 className="h-5 w-5 text-yt-accent" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-[0.08em] text-yt-text-primary">{ui.gameplay}</h2>
              <p className="text-sm text-yt-text-secondary">{ui.gameplaySubtitle}</p>
            </div>
          </div>
          {canEditWiki && (
            <button
              type="button"
              onClick={() => {
                if (newTopicOpen) {
                  setNewTopicOpen(false);
                  setNewTopicIconPickerOpen(false);
                  setNewTopicIconSearch('');
                  setNewTopicStatus('');
                  if (newTopicMediaInputRef.current) {
                    newTopicMediaInputRef.current.value = '';
                  }
                  return;
                }
                setNewTopicDraft(buildEmptyNewTopicDraft());
                setNewTopicIconPickerOpen(false);
                setNewTopicIconSearch('');
                setNewTopicStatus('');
                setNewTopicOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              {newTopicOpen ? ui.closeNewTopic : ui.newTopic}
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {gameplayItems.map(({ id, title, description, Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => handleSelectGameplayItem(id)}
              className={`rounded-2xl border bg-[#101926] p-4 text-left shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition-all ${
                selectedGameplayFeature?.id === id
                  ? 'border-yt-accent/60 ring-1 ring-yt-accent/35'
                  : 'border-yt-border/80 hover:border-yt-accent/45'
              }`}
            >
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-yt-border/80 bg-[#0b121d] px-2.5 py-1">
                <Icon className="h-4 w-4 text-yt-accent" />
                <h3 className="text-xs font-bold uppercase tracking-[0.09em] text-yt-accent">{title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-yt-text-secondary">{description}</p>
            </button>
          ))}
        </div>

        {canEditWiki && newTopicOpen && (
          <div className="mt-4 rounded-2xl border border-yt-border/80 bg-[#0f1723] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-yt-accent">{ui.createNewTopic}</h3>
              {newTopicStatus && (
                <span className="text-xs text-yt-text-secondary">{newTopicStatus}</span>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.09em] text-yt-text-secondary">{ui.icon}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTopicIconPickerOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent"
                  >
                    <NewTopicSelectedIcon className="h-3.5 w-3.5 text-yt-accent" />
                    {newTopicIconPickerOpen ? ui.hideIcons : ui.chooseIcon}
                  </button>
                  <span className="text-xs text-yt-text-secondary">
                    {GAMEPLAY_ICON_LABEL_MAP[normalizeGameplayIconKey(newTopicDraft.iconKey)] || ui.noIcon}
                  </span>
                </div>
                {newTopicIconPickerOpen && (
                  <div className="mt-2 space-y-2 rounded border border-yt-border/70 bg-[#0f1725] p-2.5">
                    <p className="text-[11px] text-yt-text-secondary">
                      {ui.iconSearchHint}
                    </p>
                    <input
                      type="text"
                      value={newTopicIconSearch}
                      onChange={(event) => setNewTopicIconSearch(event.target.value)}
                      placeholder={ui.searchIcon}
                      className="w-full rounded border border-yt-border/80 bg-[#111a28] px-2.5 py-1.5 text-xs text-yt-text-primary outline-none focus:border-yt-accent"
                    />
                    <div className="max-h-56 overflow-y-auto pr-1">
                      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
                        {filteredNewTopicIcons.map(({ key, label, Icon }) => {
                          const selected = normalizeGameplayIconKey(newTopicDraft.iconKey) === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              title={label}
                              onClick={() => {
                                setNewTopicDraft((prev) => ({ ...prev, iconKey: key }));
                                setNewTopicIconPickerOpen(false);
                                setNewTopicIconSearch('');
                              }}
                              className={`inline-flex h-9 items-center justify-center rounded border transition-colors ${
                                selected
                                  ? 'border-yt-accent bg-yt-accent/20 text-yt-accent'
                                  : 'border-yt-border/80 bg-[#101827] text-yt-text-secondary hover:border-yt-accent/70 hover:text-yt-accent'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          );
                        })}
                      </div>
                      {filteredNewTopicIcons.length === 0 && (
                        <p className="px-1 py-2 text-xs text-yt-text-secondary">{ui.noIconsFound}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-yt-accent">{ui.englishBase}</p>
              <input
                type="text"
                value={newTopicDraft.titleEn}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, titleEn: event.target.value }))}
                placeholder={ui.topicTitlePlaceholder}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={3}
                value={newTopicDraft.summaryEn}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, summaryEn: event.target.value }))}
                placeholder={ui.topicSummaryPlaceholder}
                maxLength={WIKI_SHORT_DESCRIPTION_MAX_LENGTH}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={8}
                value={newTopicDraft.contentEn}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, contentEn: event.target.value }))}
                ref={bindMarkdownEditorRef('newTopicDraft', 'contentEn')}
                onFocus={() => syncMarkdownSelection('newTopicDraft', 'contentEn')}
                onClick={() => syncMarkdownSelection('newTopicDraft', 'contentEn')}
                onSelect={() => syncMarkdownSelection('newTopicDraft', 'contentEn')}
                onKeyUp={() => syncMarkdownSelection('newTopicDraft', 'contentEn')}
                onDragOver={handleMarkdownDragOver}
                onDrop={(event) => handleMarkdownDrop(event, 'newTopicDraft', 'contentEn')}
                placeholder={ui.topicContentPlaceholder}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 font-mono text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />

              <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.09em] text-yt-text-secondary">{ui.italianTranslation}</p>
              <input
                type="text"
                value={newTopicDraft.titleIt}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, titleIt: event.target.value }))}
                placeholder={ui.topicTitlePlaceholderIt}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={3}
                value={newTopicDraft.summaryIt}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, summaryIt: event.target.value }))}
                placeholder={ui.topicSummaryPlaceholderIt}
                maxLength={WIKI_SHORT_DESCRIPTION_MAX_LENGTH}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={6}
                value={newTopicDraft.contentIt}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, contentIt: event.target.value }))}
                ref={bindMarkdownEditorRef('newTopicDraft', 'contentIt')}
                onFocus={() => syncMarkdownSelection('newTopicDraft', 'contentIt')}
                onClick={() => syncMarkdownSelection('newTopicDraft', 'contentIt')}
                onSelect={() => syncMarkdownSelection('newTopicDraft', 'contentIt')}
                onKeyUp={() => syncMarkdownSelection('newTopicDraft', 'contentIt')}
                onDragOver={handleMarkdownDragOver}
                onDrop={(event) => handleMarkdownDrop(event, 'newTopicDraft', 'contentIt')}
                placeholder={ui.topicContentPlaceholderIt}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 font-mono text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCreateGameplayTopic}
                  disabled={creatingTopic}
                  className="inline-flex items-center gap-1 rounded border border-emerald-500/45 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-emerald-300 disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {creatingTopic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {ui.createTopic}
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent">
                  {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {ui.uploadMedia}
                  <input
                    ref={newTopicMediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(event) => handleUploadNewTopicMedia(Array.from(event.target.files || []))}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNewTopicOpen(false);
                    setNewTopicIconPickerOpen(false);
                    setNewTopicIconSearch('');
                    setNewTopicStatus('');
                    setNewTopicDraft(buildEmptyNewTopicDraft());
                    if (newTopicMediaInputRef.current) {
                      newTopicMediaInputRef.current.value = '';
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                  {ui.cancel}
                </button>
              </div>
              <div className="rounded border border-yt-border/80 bg-[#111a28] p-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-yt-accent">{ui.preview}</h4>
                <h3 className="text-lg font-extrabold uppercase tracking-[0.05em] text-yt-text-primary">
                  {getDraftLocalizedField(newTopicDraft, 'title', language) || ui.titleFallback}
                </h3>
                <p className="mb-3 mt-1 text-sm text-yt-text-secondary">
                  {getDraftLocalizedField(newTopicDraft, 'summary', language) || ui.summaryFallback}
                </p>
                <div className="max-h-[340px] overflow-auto rounded border border-yt-border/70 bg-[#0c1320] px-3 py-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {getDraftLocalizedField(newTopicDraft, 'content', language) || ui.emptyContentFallback}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        )}

        {wikiLoading && (
          <div className="mt-4 rounded-xl border border-yt-border/80 bg-[#0e1520] px-3 py-2 text-sm text-yt-text-secondary">
            {ui.loadingArticles}
          </div>
        )}
        {wikiError && (
          <div className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {wikiError}
          </div>
        )}
      </section>

      {isGameplayArticleFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[275] flex items-center justify-center bg-[#03070fe0] p-3 transition-opacity duration-300 sm:p-5 ${
            isGameplayArticleFullscreenActive ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeGameplayArticleFullscreen}
        >
          <section
            className={`relative h-[min(92vh,1080px)] w-[min(1200px,96vw)] overflow-auto rounded-3xl border border-yt-border/85 bg-yt-bg-secondary/95 p-4 shadow-[0_26px_60px_rgba(0,0,0,0.62)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-6 ${
              isGameplayArticleFullscreenActive ? 'scale-100 opacity-100' : 'scale-[0.975] opacity-0'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            {renderGameplayArticleContent()}
          </section>
        </div>,
        document.body,
      )}

      <section className="relative overflow-hidden rounded-3xl border border-yt-border/70 bg-yt-bg-secondary/90 p-5 shadow-[0_20px_46px_rgba(0,0,0,0.38)]">
        <div className="relative">
          {renderShowroomContent()}
        </div>
      </section>
    </div>
  );
}
