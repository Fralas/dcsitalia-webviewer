/**
 * Flat ring chart: segments [{ value, color }], label in the middle. Grey ring when empty.
 */
export default function Donut({ segments = [], value, label, size = 148, stroke = 12 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const parts = segments.filter((s) => Number(s.value) > 0);
  const sum = parts.reduce((acc, s) => acc + Number(s.value), 0);
  const gap = parts.length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <div className="pf-donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${value} ${label}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#262626" strokeWidth={stroke} />
          {sum > 0 && parts.map((segment, index) => {
            const len = (Number(segment.value) / sum) * c;
            const circle = (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={segment.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0.5, len - gap)} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return circle;
          })}
        </g>
      </svg>
      <div className="pf-donut__center">
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
