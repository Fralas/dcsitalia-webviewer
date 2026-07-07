import { useEffect, useMemo, useState } from 'react';
import { StarsBackground } from '../ui/stars-background';
import HexGlobe from './HexGlobe';
import NoeEventsCard from './NoeEventsCard';
import CampaignInfoCard from './CampaignInfoCard';
import NoeEventAdminModal from './NoeEventAdminModal';
import { DEFAULT_CAMPAIGN_ID, getCampaignById } from '../../config/campaigns';
import { canManageNoe } from '../../config/featureAccess';
import { useUser } from '../../contexts/UserContext';
import * as api from '../../services/api';
import './LandingPage.css';

const DISCORD_URL = import.meta.env.VITE_DISCORD_INVITE_URL || 'https://discord.gg/dcsitalia';

export default function LandingPage({ language = 'en', onOpenCampaign }) {
  const { user } = useUser();
  const canManage = canManageNoe(user?.id);

  const [selectedCampaignId, setSelectedCampaignId] = useState(DEFAULT_CAMPAIGN_ID);
  const [events, setEvents] = useState([]);
  const [adminOpen, setAdminOpen] = useState(false);

  const selectedCampaign = getCampaignById(selectedCampaignId);

  const loadEvents = async () => {
    try {
      const res = await api.getNoeEvents();
      setEvents(Array.isArray(res?.events) ? res.events : []);
    } catch (error) {
      console.warn('Failed to load NOE events:', error);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const campaignEvent = useMemo(() => {
    const now = Date.now();
    const list = events
      .filter((event) => event.campaignId === selectedCampaignId && event.missionDate)
      .sort((a, b) => String(a.missionDate).localeCompare(String(b.missionDate)));
    if (!list.length) return null;
    const upcoming = list.find((event) => {
      const time = new Date(event.missionDate).getTime();
      return Number.isFinite(time) && time >= now - 24 * 60 * 60 * 1000;
    });
    return upcoming || list[list.length - 1];
  }, [events, selectedCampaignId]);

  return (
    <div className="landing">
      <div className="landing__stars">
        <StarsBackground
          starDensity={0.00182}
          allStarsTwinkle
          twinkleProbability={0.65}
          className="pointer-events-none"
        />
      </div>

      <div className="landing__globe">
        <HexGlobe
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={setSelectedCampaignId}
        />
      </div>

      <div className="landing__left">
        <NoeEventsCard
          event={campaignEvent}
          language={language}
          canManage={canManage}
          onManage={() => setAdminOpen(true)}
          discordUrl={DISCORD_URL}
        />
      </div>

      <div className="landing__right">
        <CampaignInfoCard
          campaign={selectedCampaign}
          language={language}
          onOpenCampaign={onOpenCampaign}
        />
      </div>

      {canManage && adminOpen && (
        <NoeEventAdminModal
          events={events}
          language={language}
          onClose={() => setAdminOpen(false)}
          onSaved={loadEvents}
        />
      )}
    </div>
  );
}
