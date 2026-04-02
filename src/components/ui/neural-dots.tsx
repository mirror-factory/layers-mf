"use client";

/**
 * NeuralDots — fluid SVG neural network animation.
 *
 * active=true: dots swirl fast, connections fire rapidly (AI is thinking)
 * active=false: dots float slowly, connections pulse gently (idle/done)
 */
export function NeuralDots({
  size = 48,
  dotCount = 12,
  active = false,
  className = "",
}: {
  size?: number;
  dotCount?: number;
  active?: boolean;
  className?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  // Speed multiplier: active = fast swirling, idle = slow floating
  const speed = active ? 0.4 : 1.0;

  // Generate dots in fibonacci spiral
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const dots: { x: number; y: number; dotSize: number; idx: number }[] = [];

  for (let i = 0; i < dotCount; i++) {
    const t = i / dotCount;
    const angle = i * goldenAngle;
    const dist = r * (0.2 + t * 0.75);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const dotSize = (size * 0.02) + (1 - t) * (size * 0.015);
    dots.push({ x, y, dotSize: Math.max(0.8, dotSize), idx: i });
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id={`ng-${size}-${dotCount}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity={active ? "0.06" : "0.03"} />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle background glow — slightly brighter when active */}
        <circle cx={cx} cy={cy} r={r} fill={`url(#ng-${size}-${dotCount})`}>
          <animate
            attributeName="opacity"
            values={active ? "0.8;1;0.8" : "0.5;0.7;0.5"}
            dur={`${3 * speed}s`}
            repeatCount="indefinite"
          />
        </circle>

        {/* Connections */}
        {dots.map((d, i) => {
          const next = dots[(i + 1) % dotCount];
          const skip = dots[(i + 2) % dotCount];
          const cross = dots[(i + Math.floor(dotCount / 3)) % dotCount];
          const baseDelay = i * 0.1 * speed;
          return (
            <g key={`c-${i}`}>
              {/* Adjacent connection */}
              <line x1={d.x} y1={d.y} x2={next.x} y2={next.y}
                stroke="#34d399" strokeWidth={0.3} opacity={0}>
                <animate attributeName="opacity"
                  values={active ? "0.05;0.35;0.1;0.3;0.05" : "0;0.15;0.05;0.12;0"}
                  dur={`${(1.5 + i * 0.15) * speed}s`}
                  begin={`${baseDelay}s`}
                  repeatCount="indefinite" />
              </line>
              {/* Skip connection */}
              <line x1={d.x} y1={d.y} x2={skip.x} y2={skip.y}
                stroke="#34d399" strokeWidth={0.2} opacity={0}>
                <animate attributeName="opacity"
                  values={active ? "0.03;0.25;0.03" : "0;0.08;0"}
                  dur={`${(2 + i * 0.2) * speed}s`}
                  begin={`${baseDelay + 0.2}s`}
                  repeatCount="indefinite" />
              </line>
              {/* Cross connection */}
              <line x1={d.x} y1={d.y} x2={cross.x} y2={cross.y}
                stroke="#34d399" strokeWidth={0.15} opacity={0}>
                <animate attributeName="opacity"
                  values={active ? "0.02;0.2;0.02" : "0;0.05;0"}
                  dur={`${(2.5 + i * 0.15) * speed}s`}
                  begin={`${baseDelay + 0.3}s`}
                  repeatCount="indefinite" />
              </line>
              {/* Center connection */}
              <line x1={d.x} y1={d.y} x2={cx} y2={cy}
                stroke="#34d399" strokeWidth={0.15} opacity={0}>
                <animate attributeName="opacity"
                  values={active ? "0.02;0.15;0.02" : "0;0.04;0"}
                  dur={`${(2 + i * 0.2) * speed}s`}
                  begin={`${baseDelay}s`}
                  repeatCount="indefinite" />
              </line>
            </g>
          );
        })}

        {/* Dots */}
        {dots.map((d) => {
          const baseDelay = d.idx * 0.08 * speed;
          return (
            <g key={`d-${d.idx}`}>
              {/* Glow */}
              <circle cx={d.x} cy={d.y} r={d.dotSize * 2.5} fill="#34d399" opacity={0}>
                <animate attributeName="opacity"
                  values={active ? "0;0.12;0.03;0.1;0" : "0;0.04;0"}
                  dur={`${(1.2 + d.idx * 0.1) * speed}s`}
                  begin={`${baseDelay}s`}
                  repeatCount="indefinite" />
              </circle>
              {/* Core */}
              <circle cx={d.x} cy={d.y} r={d.dotSize} fill="#34d399"
                opacity={active ? 0.5 : 0.25}>
                <animate attributeName="opacity"
                  values={active ? "0.3;0.8;0.4;0.75;0.3" : "0.15;0.4;0.2;0.35;0.15"}
                  dur={`${(1.5 + d.idx * 0.12) * speed}s`}
                  begin={`${baseDelay}s`}
                  repeatCount="indefinite" />
                <animate attributeName="r"
                  values={`${d.dotSize * 0.7};${d.dotSize * (active ? 1.4 : 1.15)};${d.dotSize * 0.8};${d.dotSize * (active ? 1.3 : 1.1)};${d.dotSize * 0.7}`}
                  dur={`${(1.8 + d.idx * 0.1) * speed}s`}
                  begin={`${baseDelay}s`}
                  repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* Center node */}
        <circle cx={cx} cy={cy} r={size * 0.035} fill="#34d399"
          opacity={active ? 0.7 : 0.35}>
          <animate attributeName="opacity"
            values={active ? "0.5;0.9;0.6;0.85;0.5" : "0.2;0.45;0.25;0.4;0.2"}
            dur={`${2.5 * speed}s`}
            repeatCount="indefinite" />
          <animate attributeName="r"
            values={`${size * 0.025};${size * (active ? 0.055 : 0.04)};${size * 0.03};${size * (active ? 0.05 : 0.038)};${size * 0.025}`}
            dur={`${3 * speed}s`}
            repeatCount="indefinite" />
        </circle>
        {/* Center ring pulse */}
        <circle cx={cx} cy={cy} r={size * 0.06} fill="none"
          stroke="#34d399" strokeWidth={0.3} opacity={0}>
          <animate attributeName="opacity"
            values={active ? "0;0.2;0" : "0;0.06;0"}
            dur={`${2 * speed}s`}
            repeatCount="indefinite" />
          <animate attributeName="r"
            values={`${size * 0.04};${size * (active ? 0.12 : 0.08)};${size * 0.04}`}
            dur={`${2 * speed}s`}
            repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
