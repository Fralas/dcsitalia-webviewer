import { getPilotRank } from '../../config/pilotRanks';

// Flat tints, aligned with the profile palette (gold = profile accent).
const METALS = {
  steel: '#9a9a9a',
  bronze: '#c08a52',
  silver: '#d4d4d4',
  gold: '#ff8c00',
};

function Star({ cx, cy, r, fill }) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return <polygon points={points.join(' ')} fill={fill} />;
}

// Insignia block centered at (60, 74): stripes ("binari"), chevrons, greca + stars, roundel.
function InsigniaMark({ insignia, fill }) {
  const parts = [];
  if (insignia.roundel) {
    parts.push(
      <g key="roundel">
        <circle cx="60" cy="74" r="13" fill="#009246" />
        <circle cx="60" cy="74" r="8.6" fill="#f4f5f0" />
        <circle cx="60" cy="74" r="4.4" fill="#ce2b37" />
      </g>,
    );
  }
  if (insignia.chevrons) {
    for (let i = 0; i < insignia.chevrons; i += 1) {
      const y = 70 + i * 7;
      parts.push(<path key={`ch${i}`} d={`M44 ${y} L60 ${y + 9} L76 ${y}`} fill="none" stroke={fill} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />);
    }
  }
  const bars = [];
  for (let i = 0; i < (insignia.thick || 0); i += 1) bars.push(7);
  for (let i = 0; i < (insignia.thin || 0); i += 1) bars.push(3.6);
  if (bars.length > 0) {
    const gap = 3.4;
    const total = bars.reduce((sum, h) => sum + h, 0) + gap * (bars.length - 1);
    let y = 74 - total / 2;
    bars.forEach((h, i) => {
      parts.push(<rect key={`bar${i}`} x="40" y={y} width="40" height={h} rx="1.2" fill={fill} />);
      y += h + gap;
    });
  }
  if (insignia.greca) {
    // Greca (meander) band under the stars, as on general officers' insignia.
    parts.push(
      <path
        key="greca"
        d="M38 86 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6"
        fill="none"
        stroke={fill}
        strokeWidth="2.6"
        strokeLinejoin="miter"
      />,
    );
    const count = insignia.stars || 0;
    const spacing = 12;
    const start = 60 - ((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i += 1) {
      parts.push(<Star key={`st${i}`} cx={start + i * spacing} cy={69} r={5.4} fill={fill} />);
    }
  }
  return <>{parts}</>;
}

/**
 * Flat rank badge for a pilot level (0-100): thin ring, pilot wings, rank insignia, step ticks.
 * Single tint per rank family (steel / bronze / silver / gold), no gradients or glow.
 */
export default function RankInsignia({ level = 0, size = 96, className = '', title }) {
  const rank = getPilotRank(level);
  const color = METALS[rank.tier.metal] || METALS.gold;
  const { insignia } = rank.tier;

  // Step ticks along the lower arc (Capitano III of IX -> 3 lit ticks of 9).
  const ticks = [];
  if (rank.steps > 1) {
    const span = Math.PI * 0.62;
    for (let i = 0; i < rank.steps; i += 1) {
      const t = i / (rank.steps - 1);
      const angle = Math.PI / 2 + span / 2 - t * span;
      const x = 60 + 47 * Math.cos(angle);
      const y = 60 + 47 * Math.sin(angle);
      ticks.push(<circle key={i} cx={x} cy={y} r="2.2" fill={i < rank.step ? color : '#3c3c3c'} />);
    }
  }

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title || `${rank.fullName}, livello ${rank.level}`}
    >
      <circle cx="60" cy="60" r="55" fill="none" stroke={color} strokeWidth="2.5" />

      {/* Pilot wings */}
      <g fill={color}>
        <path d="M60 46 C50 40 36 37 18 38 C26 41 31 44 34 47 C27 47 22 48 17 50 C26 51 33 52 39 55 C33 55 29 56 25 58 C35 58 46 57 56 53 Z" />
        <path d="M60 46 C70 40 84 37 102 38 C94 41 89 44 86 47 C93 47 98 48 103 50 C94 51 87 52 81 55 C87 55 91 56 95 58 C85 58 74 57 64 53 Z" />
        <circle cx="60" cy="48" r="6.5" />
      </g>
      <circle cx="60" cy="48" r="3.2" fill="#0f0f0f" />

      {insignia.crown && (
        <path d="M49 30 l4 6 l7 -8 l7 8 l4 -6 l-2 10 h-18 z" fill={color} />
      )}

      <InsigniaMark insignia={insignia} fill={color} />
      {ticks}
    </svg>
  );
}
