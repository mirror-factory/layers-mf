"use client";

/**
 * NeuralDots — fluid SVG neural network animation.
 * Dense dots with flowing connections, orbiting at different speeds.
 */
export function NeuralDots({
  size = 48,
  dotCount = 12,
  className = "",
}: {
  size?: number;
  dotCount?: number;
  className?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  // Generate dots in a more organic pattern — fibonacci spiral + random
  const dots: { x: number; y: number; size: number; speed: number; delay: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < dotCount; i++) {
    const t = i / dotCount;
    const angle = i * goldenAngle;
    const dist = r * (0.2 + t * 0.75);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const dotSize = (size * 0.02) + (1 - t) * (size * 0.015);
    dots.push({
      x, y,
      size: Math.max(0.8, dotSize),
      speed: 1.5 + i * 0.2,
      delay: i * 0.15,
    });
  }

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id={`ng-${size}-${dotCount}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.1" />
            <stop offset="70%" stopColor="#34d399" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <circle cx={cx} cy={cy} r={r} fill={`url(#ng-${size}-${dotCount})`} />

        {/* Flowing connections — each dot connects to 2-3 nearest */}
        {dots.map((d, i) => {
          // Connect to next 2 dots (wrapping)
          const connections = [
            dots[(i + 1) % dotCount],
            dots[(i + 2) % dotCount],
            dots[(i + Math.floor(dotCount / 3)) % dotCount], // cross connection
          ];
          return (
            <g key={`c-${i}`}>
              {connections.map((target, ci) => (
                <line
                  key={ci}
                  x1={d.x} y1={d.y}
                  x2={target.x} y2={target.y}
                  stroke="#34d399"
                  strokeWidth={ci === 2 ? 0.2 : 0.3}
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    values="0;0.2;0.05;0.15;0"
                    dur={`${d.speed + ci * 0.5}s`}
                    begin={`${d.delay + ci * 0.3}s`}
                    repeatCount="indefinite"
                  />
                </line>
              ))}
              {/* Connection to center */}
              <line
                x1={d.x} y1={d.y} x2={cx} y2={cy}
                stroke="#34d399" strokeWidth={0.15} opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.08;0;0.06;0"
                  dur={`${d.speed * 1.5}s`}
                  begin={`${d.delay}s`}
                  repeatCount="indefinite"
                />
              </line>
            </g>
          );
        })}

        {/* Dots — pulsing at different rates */}
        {dots.map((d, i) => (
          <g key={`d-${i}`}>
            {/* Outer glow */}
            <circle cx={d.x} cy={d.y} r={d.size * 2} fill="#34d399" opacity={0}>
              <animate
                attributeName="opacity"
                values="0;0.08;0"
                dur={`${d.speed}s`}
                begin={`${d.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
            {/* Core dot */}
            <circle cx={d.x} cy={d.y} r={d.size} fill="#34d399" opacity={0.3}>
              <animate
                attributeName="opacity"
                values="0.2;0.7;0.3;0.6;0.2"
                dur={`${d.speed}s`}
                begin={`${d.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values={`${d.size * 0.7};${d.size * 1.2};${d.size * 0.8};${d.size * 1.1};${d.size * 0.7}`}
                dur={`${d.speed * 1.2}s`}
                begin={`${d.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}

        {/* Center node — larger, steadier */}
        <circle cx={cx} cy={cy} r={size * 0.04} fill="#34d399" opacity={0.7}>
          <animate attributeName="opacity" values="0.4;0.9;0.5;0.8;0.4" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="r" values={`${size * 0.03};${size * 0.05};${size * 0.035};${size * 0.048};${size * 0.03}`} dur="3s" repeatCount="indefinite" />
        </circle>
        {/* Center glow ring */}
        <circle cx={cx} cy={cy} r={size * 0.08} fill="none" stroke="#34d399" strokeWidth={0.3} opacity={0}>
          <animate attributeName="opacity" values="0;0.15;0" dur="3s" repeatCount="indefinite" />
          <animate attributeName="r" values={`${size * 0.05};${size * 0.1};${size * 0.05}`} dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
