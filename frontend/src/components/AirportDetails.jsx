import { ArrowLeft, Plane } from 'lucide-react';
import AirportCard from './AirportCard';
import { t } from '../utils/locale';

export default function AirportDetails({ airport, missions, onMissionsUpdate, onBack }) {
  if (!airport) {
    return (
      <div className="bg-yt-bg-secondary rounded-lg p-8 text-center border border-yt-border">
        <Plane className="w-12 h-12 text-yt-text-secondary mx-auto mb-3 opacity-50" />
        <p className="text-base text-yt-text-primary font-medium">{t('airportDetails.emptyTitle')}</p>
        <p className="text-xs text-yt-text-secondary mt-1">{t('airportDetails.emptySubtitle')}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary rounded text-sm font-medium transition-all"
        >
          {t('airportDetails.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-yt-text-primary">{airport.displayName || airport.name}</h2>
          <p className="text-xs text-yt-text-secondary">{t('airportDetails.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-2 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary rounded text-sm font-medium transition-all flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('airportDetails.back')}
        </button>
      </div>

      <AirportCard
        airport={airport}
        missions={missions}
        onMissionsUpdate={onMissionsUpdate}
        shouldExpand
        expandToken={1}
        forceExpanded
        showOrders={false}
      />
    </div>
  );
}
