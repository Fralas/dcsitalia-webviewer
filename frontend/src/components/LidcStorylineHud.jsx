import './LidcStorylineHud.css';

function HudKey({ children }) {
  return <kbd className="lidc-storyline-hud-key">{children}</kbd>;
}

function HudKeys({ keys = 'E' }) {
  const keyList = String(keys)
    .split('+')
    .map((key) => key.trim())
    .filter(Boolean);

  return (
    <div className="lidc-storyline-hud-keys" aria-hidden="true">
      {keyList.map((key) => (
        <HudKey key={key}>{key}</HudKey>
      ))}
    </div>
  );
}

function InteractPromptBar({ label, keys = 'E' }) {
  return (
    <div className="lidc-storyline-hud-bar is-interact">
      <HudKeys keys={keys} />
      <span className="lidc-storyline-hud-text">{label}</span>
    </div>
  );
}

function HudSegment({ segment, showSeparator = false }) {
  return (
    <span className="lidc-storyline-hud-segment">
      {showSeparator && <span className="lidc-storyline-hud-sep" aria-hidden="true" />}
      <HudKey>{segment.key}</HudKey>
      <span className="lidc-storyline-hud-text">{segment.label}</span>
    </span>
  );
}

export function LidcStorylineInteractPrompt({ label, keys = 'E' }) {
  return (
    <div className="lidc-storyline-hud" role="status" aria-live="polite">
      <InteractPromptBar label={label} keys={keys} />
    </div>
  );
}

export function LidcStorylineControlsHint({ segments, fadeOut = false }) {
  if (!Array.isArray(segments) || segments.length === 0) return null;

  return (
    <div className={`lidc-storyline-hud ${fadeOut ? 'is-fading-out' : ''}`} aria-hidden="true">
      <div className="lidc-storyline-hud-bar is-controls">
        {segments.map((segment, index) => (
          <HudSegment key={`${segment.key}-${segment.label}`} segment={segment} showSeparator={index > 0} />
        ))}
      </div>
    </div>
  );
}

export function LidcStorylineHudNotice({ primaryKey = 'Esc', primaryLabel, secondary, fadeOut = false }) {
  return (
    <div
      className={`lidc-storyline-hud lidc-storyline-hud--stack ${fadeOut ? 'is-fading' : ''}`}
      role="status"
      aria-live="polite"
    >
      <InteractPromptBar keys={primaryKey} label={primaryLabel} />
      {secondary ? <p className="lidc-storyline-hud-sub">{secondary}</p> : null}
    </div>
  );
}
