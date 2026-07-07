import { getTacticalMapByCampaignId } from '../../config/tacticalMaps';

const LABELS = {
  en: { openMap: 'OPEN MAP', comingSoon: 'COMING SOON' },
  it: { openMap: 'APRI MAPPA', comingSoon: 'PROSSIMAMENTE' },
};

export default function CampaignInfoCard({ campaign, language = 'en', onOpenCampaign }) {
  if (!campaign) return null;

  const L = LABELS[language] || LABELS.en;
  const sections = campaign.description?.[language] || campaign.description?.en || [];
  const tacticalMap = campaign.tacticalMapId
    ? getTacticalMapByCampaignId(campaign.tacticalMapId)
    : null;
  const canOpenTactical = Boolean(tacticalMap?.enabled);
  const canOpenLidc = campaign.openTarget === 'lidc';
  const canOpen = canOpenTactical || canOpenLidc;

  const handleOpen = () => {
    if (!canOpen) return;
    if (canOpenTactical) {
      onOpenCampaign?.({ type: 'hidc', tacticalMapId: campaign.tacticalMapId });
      return;
    }
    if (canOpenLidc) {
      onOpenCampaign?.({ type: 'lidc' });
    }
  };

  return (
    <section className="info-card" aria-label={campaign.title}>
      <div className="info-card__scroll">
        <div className="info-card__title">{campaign.title}</div>
        <h2 className="info-card__theater">{campaign.theaterName}</h2>

        <div className="info-card__body">
          {sections.map((section, index) => (
            <div className="info-card__section" key={index}>
              {section.title && <h3 className="info-card__heading">{section.title}</h3>}
              {section.body && <p className="info-card__text">{section.body}</p>}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="info-card__cta"
        disabled={!canOpen}
        onClick={handleOpen}
      >
        {canOpen ? L.openMap : L.comingSoon}
      </button>
    </section>
  );
}
