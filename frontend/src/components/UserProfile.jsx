import { useMemo } from 'react';
import { Plane, User as UserIcon, CheckCircle } from 'lucide-react';
import { aircraftCategories } from '../config/aircraftCatalog';
import { useUser } from '../contexts/UserContext';

function StatCard({ label, value }) {
  return (
    <div className="bg-yt-bg-tertiary border border-yt-border rounded-lg p-4 text-center">
      <div className="text-3xl font-bold text-yt-text-primary">{value}</div>
      <div className="text-xs text-yt-text-secondary uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

export default function UserProfile() {
  const { user, profile, updateProfile } = useUser();

  const selectedAircraft = profile?.selectedAircraft || [];
  const stats = profile?.stats || { missionsCompleted: 0, ordersCompleted: 0 };

  const selectedSet = useMemo(() => new Set(selectedAircraft), [selectedAircraft]);

  const handleToggleAircraft = (aircraftName) => {
    updateProfile(prev => {
      const nextSelected = new Set(prev.selectedAircraft);
      if (nextSelected.has(aircraftName)) {
        nextSelected.delete(aircraftName);
      } else {
        nextSelected.add(aircraftName);
      }

      return {
        ...prev,
        selectedAircraft: Array.from(nextSelected),
      };
    });
  };

  if (!user) {
    return (
      <div className="bg-yt-bg-secondary border border-yt-border rounded-lg p-8 text-center">
        <UserIcon className="w-12 h-12 text-yt-text-secondary mx-auto mb-3" />
        <p className="text-base text-yt-text-primary font-medium">Accedi con Discord per vedere il profilo.</p>
        <p className="text-xs text-yt-text-secondary mt-1">Usa il pulsante di login in alto a destra.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yt-bg-secondary border border-yt-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yt-bg-tertiary flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-yt-text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-yt-text-primary">{user.globalName || user.username}</h2>
              <p className="text-xs text-yt-text-secondary">Profilo personale Discord</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
            <StatCard label="Missioni completate" value={stats.missionsCompleted} />
            <StatCard label="Ordini completati" value={stats.ordersCompleted} />
          </div>
        </div>
        <div className="mt-3 text-xs text-yt-text-secondary">
          Le statistiche aumentano quando confermi la riuscita di una missione.
        </div>
      </div>

      <div className="bg-yt-bg-secondary border border-yt-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plane className="w-5 h-5 text-yt-accent" />
          <h3 className="text-lg font-bold text-yt-text-primary">I miei aerei</h3>
          <span className="text-xs text-yt-text-secondary">
            {selectedAircraft.length} selezionati
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {aircraftCategories.map((category) => (
            <div key={category.title} className="border border-yt-border rounded-lg p-3 bg-yt-bg-tertiary/30">
              <div className="text-sm font-semibold text-yt-text-primary mb-2">{category.title}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {category.items.map((aircraft) => {
                  const isSelected = selectedSet.has(aircraft);
                  return (
                    <button
                      key={aircraft}
                      type="button"
                      onClick={() => handleToggleAircraft(aircraft)}
                      className={`px-3 py-2 rounded border text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
                        isSelected
                          ? 'bg-yt-accent/20 border-yt-accent text-yt-text-primary'
                          : 'bg-yt-bg-secondary border-yt-border text-yt-text-secondary hover:border-yt-accent/60'
                      }`}
                    >
                      <span className="truncate">{aircraft}</span>
                      {isSelected && <CheckCircle className="w-4 h-4 text-yt-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
