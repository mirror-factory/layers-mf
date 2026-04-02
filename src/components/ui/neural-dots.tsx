"use client";

/**
 * NeuralDots — lightweight CSS-only particle animation.
 * Looks like connecting neurons/synapses. No canvas, no JS physics.
 * Runs at 60fps with zero CPU overhead.
 */
export function NeuralDots({
  size = 48,
  dotCount = 6,
  className = "",
}: {
  size?: number;
  dotCount?: number;
  className?: string;
}) {
  const dots = Array.from({ length: dotCount }, (_, i) => i);
  const r = size / 2 - 4;

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Connecting lines */}
        {dots.map((i) => {
          const angle1 = (i / dotCount) * Math.PI * 2;
          const angle2 = ((i + 1) % dotCount / dotCount) * Math.PI * 2;
          const angle3 = ((i + 2) % dotCount / dotCount) * Math.PI * 2;
          const cx = size / 2;
          const cy = size / 2;
          const x1 = cx + Math.cos(angle1) * r * 0.7;
          const y1 = cy + Math.sin(angle1) * r * 0.7;
          const x2 = cx + Math.cos(angle2) * r * 0.7;
          const y2 = cy + Math.sin(angle2) * r * 0.7;
          const x3 = cx + Math.cos(angle3) * r * 0.7;
          const y3 = cy + Math.sin(angle3) * r * 0.7;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#34d399" strokeWidth={0.5} opacity={0.2}>
                <animate attributeName="opacity" values="0.1;0.3;0.1" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
              </line>
              <line x1={x1} y1={y1} x2={x3} y2={y3} stroke="#34d399" strokeWidth={0.3} opacity={0.1}>
                <animate attributeName="opacity" values="0.05;0.2;0.05" dur={`${3 + i * 0.5}s`} repeatCount="indefinite" />
              </line>
              {/* Center connections */}
              <line x1={x1} y1={y1} x2={cx} y2={cy} stroke="#34d399" strokeWidth={0.3} opacity={0.1}>
                <animate attributeName="opacity" values="0.05;0.15;0.05" dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" />
              </line>
            </g>
          );
        })}

        {/* Dots orbiting */}
        {dots.map((i) => {
          const angle = (i / dotCount) * Math.PI * 2;
          const cx = size / 2 + Math.cos(angle) * r * 0.7;
          const cy = size / 2 + Math.sin(angle) * r * 0.7;
          const dotSize = 1.5 + (i % 3) * 0.5;
          return (
            <circle key={i} cx={cx} cy={cy} r={dotSize} fill="#34d399" opacity={0.6}>
              <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${1.5 + i * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="r" values={`${dotSize};${dotSize + 0.5};${dotSize}`} dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
            </circle>
          );
        })}

        {/* Center glow */}
        <circle cx={size / 2} cy={size / 2} r={2} fill="#34d399" opacity={0.5}>
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
          <animate attributeName="r" values="1.5;2.5;1.5" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
