/**
 * Static configuration for the landing page campaigns.
 *
 * This file is intentionally simple to edit:
 * - Add / remove entries in the `CAMPAIGNS` array to change available campaigns.
 * - `pointerAnchor` / `pointerSide` / `highlightColor` drive globe pointer arms.
 * - `showPointer: false` hides the arm for a campaign (globe click still works).
 * - `globeRegions` (legacy) — see `globeRegionSpecs.js` for theater polygon specs.
 * - `tacticalMapId` links a HIDC campaign to its tactical map (see `tacticalMaps.js`).
 *   When the map is `enabled`, "OPEN MAP" opens the flat tactical view directly.
 * - `openTarget` for non-HIDC routes:
 *     'lidc' -> LIDC section (/lidc)
 *     null   -> button disabled ("coming soon").
 * - `description` supports two locales (en/it); each is a list of sections
 *   rendered in the right-hand info card. A section may have an optional
 *   `title` heading and a `body` paragraph.
 */

import { GLOBE_REGION_SPECS } from './globeRegionSpecs';
import { getTacticalMapByCampaignId } from './tacticalMaps';

export const CAMPAIGNS = [
  {
    id: 'hidc-modern-syria',
    type: 'HIDC',
    label: 'HIDC - MODERN SYRIA',
    theaterName: 'MODERN SYRIA',
    title: 'HIDC - High Intensity Dynamic Campaign',
    highlightColor: '#FF6B01',
    pointerAnchor: { lat: 35.0, lng: 38.5 },
    pointerSide: 'right',
    tacticalMapId: 'hidc-modern-syria',
    description: {
      en: [
        {
          title: 'What is a Dynamic Campaign',
          body: 'A dynamic campaign is a persistent war scenario that continues to evolve over time based on player actions and the system\'s response. Unlike a standard mission, there is no fixed sequence of events written from start to finish. The battlefield truly changes: every activity has concrete effects on the overall progress of the campaign.',
        },
        {
          title: 'Persistency',
          body: 'One of the most important elements is persistence. The campaign does not restart from zero every time the server is rebooted, but keeps the state reached in the previous session. This is made possible by a proprietary mission-saving script, developed specifically to preserve the evolution of the conflict from one session to the next. Because of this, the frontline, units, territorial control, and overall operational situation remain consistent over time.',
        },
        {
          title: 'Dynamic Weather and Time',
          body: 'To make the experience even more dynamic, mission conditions can also change between sessions. Elements such as weather and time of day may vary over time, creating different operational scenarios and forcing players to adapt to new conditions each time they join.',
        },
      ],
      it: [
        {
          title: 'Cos\'è una Campagna Dinamica',
          body: 'Una campagna dinamica è uno scenario di guerra persistente che continua a evolvere nel tempo in base alle azioni dei giocatori e alla risposta del sistema. A differenza di una missione standard, non esiste una sequenza fissa di eventi scritta dall\'inizio alla fine. Il campo di battaglia cambia davvero: ogni attività ha effetti concreti sull\'andamento complessivo della campagna.',
        },
        {
          title: 'Persistenza',
          body: 'Uno degli elementi più importanti è la persistenza. La campagna non riparte da zero a ogni riavvio del server, ma mantiene lo stato raggiunto nella sessione precedente. Questo è reso possibile da uno script proprietario di salvataggio missione, sviluppato appositamente per preservare l\'evoluzione del conflitto da una sessione all\'altra. Per questo motivo la linea del fronte, le unità, il controllo territoriale e la situazione operativa restano coerenti nel tempo.',
        },
        {
          title: 'Meteo e Orario Dinamici',
          body: 'Per rendere l\'esperienza ancora più dinamica, anche le condizioni della missione possono cambiare tra una sessione e l\'altra. Elementi come il meteo e l\'ora del giorno possono variare nel tempo, creando scenari operativi diversi e costringendo i giocatori ad adattarsi a nuove condizioni ogni volta che entrano.',
        },
      ],
    },
  },
  {
    id: 'hidc-cw84-germany',
    type: 'HIDC',
    label: 'HIDC - CW84 GERMANY',
    theaterName: 'CW84 GERMANY',
    title: 'HIDC - High Intensity Dynamic Campaign',
    highlightColor: '#4ec5ff',
    pointerAnchor: { lat: 51.2, lng: 10.5 },
    pointerSide: 'left',
    showPointer: false,
    tacticalMapId: 'hidc-cw84-germany',
    description: {
      en: [
        {
          title: 'Cold War 1984 - Germany',
          body: 'A high intensity dynamic campaign set on the Inner German Border at the height of the Cold War. NATO and Warsaw Pact forces clash across the Fulda Gap in a persistent, ever-evolving theater.',
        },
        {
          body: 'This campaign is coming soon and is not yet playable.',
        },
      ],
      it: [
        {
          title: 'Guerra Fredda 1984 - Germania',
          body: 'Una campagna dinamica ad alta intensità ambientata sul confine interno tedesco all\'apice della Guerra Fredda. Le forze NATO e del Patto di Varsavia si scontrano lungo il Fulda Gap in un teatro persistente e in continua evoluzione.',
        },
        {
          body: 'Questa campagna sarà disponibile a breve e non è ancora giocabile.',
        },
      ],
    },
  },
  {
    id: 'hidc-2000-balkans',
    type: 'HIDC',
    label: 'HIDC - 2000 BALKANS',
    theaterName: '2000 BALKANS',
    title: 'HIDC - High Intensity Dynamic Campaign',
    highlightColor: '#8bd450',
    pointerAnchor: { lat: 44.0, lng: 20.5 },
    pointerSide: 'left',
    showPointer: false,
    tacticalMapId: 'hidc-2000-balkans',
    description: {
      en: [
        {
          title: 'The Balkans - Year 2000',
          body: 'A high intensity dynamic campaign across the Balkan theater at the turn of the millennium. Contested airspace, dense air defenses and a shifting frontline define this persistent scenario.',
        },
        {
          body: 'This campaign is coming soon and is not yet playable.',
        },
      ],
      it: [
        {
          title: 'I Balcani - Anno 2000',
          body: 'Una campagna dinamica ad alta intensità nel teatro balcanico all\'alba del nuovo millennio. Spazio aereo conteso, difese aeree fitte e una linea del fronte mutevole caratterizzano questo scenario persistente.',
        },
        {
          body: 'Questa campagna sarà disponibile a breve e non è ancora giocabile.',
        },
      ],
    },
  },
  {
    id: 'lidc-persian-gulf',
    type: 'LIDC',
    label: 'LIDC - PERSIAN GULF',
    theaterName: 'PERSIAN GULF',
    title: 'LIDC - Low Intensity Dynamic Campaign',
    highlightColor: '#FFD500',
    pointerAnchor: { lat: 26.5, lng: 51.0 },
    pointerSide: 'right',
    showPointer: false,
    openTarget: null,
    description: {
      en: [
        {
          title: 'Low Intensity - Persian Gulf',
          body: 'A low intensity dynamic campaign in the Persian Gulf. Squadron-driven operations, asymmetric threats and slow-burn escalation shape a persistent theater built around player squadrons.',
        },
        {
          body: 'This campaign is coming soon and is not yet playable.',
        },
      ],
      it: [
        {
          title: 'Bassa Intensità - Golfo Persico',
          body: 'Una campagna dinamica a bassa intensità nel Golfo Persico. Operazioni guidate dalle squadriglie, minacce asimmetriche ed escalation graduale danno forma a un teatro persistente costruito attorno alle squadriglie dei giocatori.',
        },
        {
          body: 'Questa campagna sarà disponibile a breve e non è ancora giocabile.',
        },
      ],
    },
  },
  {
    id: 'lidc-afghanistan',
    type: 'LIDC',
    label: 'LIDC - AFGHANISTAN',
    theaterName: 'AFGHANISTAN',
    title: 'LIDC - Low Intensity Dynamic Campaign',
    highlightColor: '#FFD500',
    pointerAnchor: { lat: 34.5, lng: 66.0 },
    pointerSide: 'right',
    openTarget: 'lidc',
    description: {
      en: [
        {
          title: 'Low Intensity - Afghanistan',
          body: 'A low intensity dynamic campaign over Afghanistan. Counter-insurgency, close air support and persistent squadron logistics define the daily operations of this theater.',
        },
        {
          title: 'Squadron Driven',
          body: 'Manage your squadron, build your deck of assets and take part in a persistent conflict where every sortie contributes to the overall campaign progress.',
        },
      ],
      it: [
        {
          title: 'Bassa Intensità - Afghanistan',
          body: 'Una campagna dinamica a bassa intensità sull\'Afghanistan. Controinsurrezione, supporto aereo ravvicinato e logistica persistente delle squadriglie definiscono le operazioni quotidiane di questo teatro.',
        },
        {
          title: 'Guidata dalle Squadriglie',
          body: 'Gestisci la tua squadriglia, costruisci il tuo parco di assetti e prendi parte a un conflitto persistente in cui ogni sortita contribuisce all\'avanzamento complessivo della campagna.',
        },
      ],
    },
  },
];

export const DEFAULT_CAMPAIGN_ID = CAMPAIGNS[0].id;

export function getCampaignById(id) {
  return CAMPAIGNS.find((campaign) => campaign.id === id) || null;
}

export function getCampaignNavTarget(campaign) {
  const map = getTacticalMapByCampaignId(campaign.tacticalMapId);
  if (map?.enabled) return { type: 'hidc', tacticalMapId: campaign.id };
  if (campaign.openTarget === 'lidc') return { type: 'lidc' };
  return { type: 'landing', campaignId: campaign.id };
}

/**
 * Map of ISO_A2 region code -> campaign (full countries only).
 */
export function buildRegionCampaignMap() {
  const map = new Map();
  CAMPAIGNS.forEach((campaign) => {
    const spec = GLOBE_REGION_SPECS[campaign.id];
    (spec?.countries || []).forEach((code) => {
      map.set(String(code).toUpperCase(), campaign);
    });
  });
  return map;
}
