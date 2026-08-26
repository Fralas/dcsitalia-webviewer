import { ParticleWave } from '@/components/ui/particle-wave';
import bannerImg from '../../img/DCS_ITALIA_ICON.png';
import './BootSplash.css';

export default function BootSplash({
  fading = false,
  preview = false,
  status = '',
  hint = '',
  replayLabel = 'Replay',
  closeLabel = 'Close',
  onReplay,
  onClose,
}) {
  return (
    <div
      className={`boot-splash${fading ? ' boot-splash--out' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!fading}
    >
      <div className="boot-splash__wave" aria-hidden="true">
        <ParticleWave />
      </div>
      <div className="boot-splash__veil" aria-hidden="true" />

      <div className="boot-splash__hud">
        <div className="boot-splash__brand">
          <img src={bannerImg} alt="" className="boot-splash__mark" />
          <div className="boot-splash__callsign">
            <span className="boot-splash__kicker">DYNAMIC CAMPAIGN</span>
            <h1 className="boot-splash__title">DCS ITALIA</h1>
          </div>
        </div>

        <div className="boot-splash__status">
          <p className="boot-splash__line">{status}</p>
          {hint ? <p className="boot-splash__hint">{hint}</p> : null}
          <div className="boot-splash__track" aria-hidden="true">
            <span className="boot-splash__bar" />
          </div>
          {preview ? (
            <div className="boot-splash__actions">
              <button type="button" className="boot-splash__btn" onClick={onReplay}>
                {replayLabel}
              </button>
              <button type="button" className="boot-splash__btn boot-splash__btn--ghost" onClick={onClose}>
                {closeLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
