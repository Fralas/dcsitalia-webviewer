import { CAMPAIGNS } from '../../config/campaigns';

export default function CampaignSwitcher({ selectedCampaignId, onSelect }) {
  return (
    <div className="landing-switcher" role="tablist" aria-label="Campaigns">
      {CAMPAIGNS.map((campaign) => {
        const isActive = campaign.id === selectedCampaignId;
        return (
          <button
            key={campaign.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`landing-switcher__btn${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(campaign.id)}
          >
            {campaign.label}
          </button>
        );
      })}
    </div>
  );
}
