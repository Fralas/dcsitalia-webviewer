import { getCampaignById } from '../../config/campaigns';
import { getTacticalMapByCampaignId } from '../../config/tacticalMaps';

const LIDC_AFGHANISTAN_ID = 'lidc-afghanistan';
const HIDC_SYRIA_CONTENT_ID = 'hidc-modern-syria';

const LABELS = {
  en: {
    openMap: 'OPEN MAP',
    goToStory: 'Go to the story',
    comingSoon: 'COMING SOON',
    selectCampaign: 'SELECT CAMPAIGN',
  },
  it: {
    openMap: 'APRI MAPPA',
    goToStory: 'Vai alla storia',
    comingSoon: 'PROSSIMAMENTE',
    selectCampaign: 'SELEZIONA CAMPAGNA',
  },
};

const OVERVIEW_CARD = {
  en: {
    title: 'Campaign Overview',
    theaterName: '',
    sections: [
      {
        heading: 'HIDC — High Intensity Dynamic Campaign',
        tone: 'hidc',
        paragraphs: [
          'It recreates a large-scale symmetrical war between two conventional forces with comparable technology, organization, and combat capabilities. Both sides can deploy modern aircraft, armored units, advanced air defenses, logistics networks, and command infrastructure.',
          'Players face a highly contested battlespace with layered SAM networks, fighter patrols, protected strategic targets, and an evolving frontline. Air superiority, SEAD/DEAD, interdiction, logistics disruption, and ground support are essential to campaign progress.',
          'HIDC is built for players seeking a demanding, high-threat environment where teamwork, planning, and execution determine survival and impact.',
        ],
      },
      {
        heading: 'LIDC — Low Intensity Dynamic Campaign',
        tone: 'lidc',
        paragraphs: [
          'It recreates an asymmetrical conflict against an insurgent force that relies on numbers, dispersion, mobility, concealment, and unconventional tactics. Instead of a clear frontline, the enemy operates through small cells, hidden supply routes, ambushes, raids, and dispersed positions.',
          'Logistics, reconnaissance, intelligence gathering, and asset preservation are critical. Aircraft, vehicles, weapons, and supplies are limited, making every commitment important. Finding the enemy is often as decisive as destroying it.',
          'LIDC offers a slower, tactical experience focused on counter-insurgency, resource management, patrols, convoy protection, CAS, and dynamic ground activity, where even small missions can affect campaign stability.',
        ],
      },
    ],
  },
  it: {
    title: 'Panoramica Campagne',
    theaterName: '',
    sections: [
      {
        heading: 'HIDC — High Intensity Dynamic Campaign',
        tone: 'hidc',
        paragraphs: [
          'Ricrea una guerra simmetrica su larga scala tra due forze convenzionali con tecnologia, organizzazione e capacita di combattimento comparabili. Entrambe le parti possono impiegare velivoli moderni, unita corazzate, difese aeree avanzate, reti logistiche e infrastrutture di comando.',
          'I giocatori affrontano uno spazio di battaglia altamente conteso, con reti SAM stratificate, pattuglie caccia, obiettivi strategici protetti e una linea del fronte in continua evoluzione. Superiorita aerea, SEAD/DEAD, interdizione, interruzione logistica e supporto alle forze di terra sono essenziali per il progresso della campagna.',
          'HIDC e pensata per giocatori che cercano un ambiente impegnativo e ad alta minaccia, dove lavoro di squadra, pianificazione ed esecuzione determinano sopravvivenza e impatto operativo.',
        ],
      },
      {
        heading: 'LIDC — Low Intensity Dynamic Campaign',
        tone: 'lidc',
        paragraphs: [
          'Ricrea un conflitto asimmetrico contro una forza insurrezionale che fa leva su numeri, dispersione, mobilita, occultamento e tattiche non convenzionali. Invece di una linea del fronte definita, il nemico opera tramite piccole cellule, rotte di rifornimento nascoste, imboscate, raid e posizioni disperse.',
          'Logistica, ricognizione, raccolta informazioni e preservazione degli asset sono critiche. Velivoli, veicoli, armi e rifornimenti sono limitati: ogni impiego conta. Individuare il nemico e spesso importante quanto distruggerlo.',
          'LIDC offre un\'esperienza piu lenta e tattica, focalizzata su contro-insurrezione, gestione risorse, pattugliamenti, protezione convogli, CAS e attivita di terra dinamica, dove anche missioni piccole possono influire sulla stabilita della campagna.',
        ],
      },
    ],
  },
};

export default function CampaignInfoCard({ campaign, language = 'en', onOpenCampaign }) {
  const L = LABELS[language] || LABELS.en;
  const isOverview = !campaign;
  const overview = OVERVIEW_CARD[language] || OVERVIEW_CARD.en;
  const descriptionSource = campaign?.id === LIDC_AFGHANISTAN_ID
    ? getCampaignById(HIDC_SYRIA_CONTENT_ID)
    : campaign;
  const sections = isOverview
    ? overview.sections
    : (descriptionSource?.description?.[language] || descriptionSource?.description?.en || []);
  const tacticalMap = campaign?.tacticalMapId
    ? getTacticalMapByCampaignId(campaign.tacticalMapId)
    : null;
  const canOpenTactical = Boolean(tacticalMap?.enabled);
  const canOpenLidc = campaign?.openTarget === 'lidc';
  const canOpen = !isOverview && (canOpenTactical || canOpenLidc);

  const handleOpen = () => {
    if (!canOpen) return;
    if (canOpenTactical) {
      onOpenCampaign?.({ type: 'hidc', tacticalMapId: campaign.tacticalMapId });
      return;
    }
    if (canOpenLidc) {
      onOpenCampaign?.({ type: 'lidc', openStoryline: true });
    }
  };

  const accentColor = campaign?.highlightColor || '#FF8C00';

  return (
    <section
      className="info-card"
      aria-label={campaign?.title || overview.title}
      style={isOverview ? undefined : { '--info-card-accent': accentColor }}
    >
      <div className="info-card__scroll">
        {!isOverview && (
          <>
            <div className="info-card__title">{campaign.title}</div>
            <h2 className="info-card__theater">{campaign.theaterName}</h2>
          </>
        )}

        <div className="info-card__body">
          {sections.map((section, index) => (
            <div className="info-card__section" key={index}>
              {isOverview ? (
                <>
                  <h3 className={`info-card__heading info-card__heading--${section.tone}`}>
                    {section.heading}
                  </h3>
                  {section.paragraphs.map((text, paragraphIndex) => (
                    <p className="info-card__text" key={paragraphIndex}>{text}</p>
                  ))}
                </>
              ) : (
                <>
                  {section.title && <h3 className="info-card__heading">{section.title}</h3>}
                  {section.body && <p className="info-card__text">{section.body}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={`info-card__cta ${isOverview ? 'info-card__cta--overview' : ''}`}
        disabled={!canOpen}
        onClick={handleOpen}
      >
        {isOverview
          ? L.selectCampaign
          : (canOpen ? (canOpenLidc ? L.goToStory : L.openMap) : L.comingSoon)}
      </button>
    </section>
  );
}
