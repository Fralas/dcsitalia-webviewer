import { CAMPAIGNS, getCampaignNavTarget } from '../config/campaigns';

const COMING_SOON_TAB_IDS = new Set([
  'hidc-cw84-germany',
  'hidc-2000-balkans',
  'lidc-persian-gulf',
]);

export default function CampaignHeaderTabs({
  activeCampaignId,
  onSelectCampaign,
  canAccessLidc = false,
}) {
  return (
    <nav className="app-header__tabs" aria-label="Campaigns">
      {CAMPAIGNS.map((campaign) => {
        const target = getCampaignNavTarget(campaign);
        const isNavigable = target.type === 'hidc'
          || (target.type === 'lidc' && canAccessLidc);
        const isLidcLocked = target.type === 'lidc' && !canAccessLidc;
        const isActive = campaign.id === activeCampaignId;
        const hasComingSoon = COMING_SOON_TAB_IDS.has(campaign.id);

        return (
          <button
            key={campaign.id}
            type="button"
            className={[
              'app-header__tab',
              hasComingSoon ? 'has-subtitle' : '',
              isActive ? 'is-active' : '',
              !isNavigable ? 'is-disabled' : '',
            ].filter(Boolean).join(' ')}
            aria-current={isActive ? 'page' : undefined}
            aria-disabled={!isNavigable ? 'true' : undefined}
            disabled={isLidcLocked}
            onClick={() => {
              if (isLidcLocked) return;
              onSelectCampaign(campaign);
            }}
          >
            <span className="app-header__tab-label">{campaign.label}</span>
            {hasComingSoon && (
              <span className="app-header__tab-subtitle">COMING SOON</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
