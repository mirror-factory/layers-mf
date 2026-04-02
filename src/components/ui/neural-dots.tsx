"use client";

/**
 * NeuralDots — lightweight SVG particle animation.
 * Looks like connecting neurons/synapses. Pure SVG animations, zero JS overhead.
 */
export function NeuralDots({
  size = 48,
  dotCount = 8,
  className = "",
}: {
  size?: number;
  dotCount?: number;
  className?: string;
}) {
  // Auto-scale dot count based on size if not specified
  const effectiveDots = dotCount ?? (size < 30 ? 5 : size < 50 ? 8 : size < 80 ? 12 : 16);
  const dots = Array.from({ length: effectiveDots }, (_, i) => i);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;

  // Create multiple orbit layers for depth
  const layers = [
    { radius: r * 0.35, count: Math.max(3, Math.floor(effectiveDots * 0.3)), dotSize: size * 0.02 + 0.5 },
    { radius: r * 0.65, count: Math.max(4, Math.floor(effectiveDots * 0.4)), dotSize: size * 0.025 + 0.5 },
    { radius: r * 0.9, count: Math.max(3, Math.floor(effectiveDots * 0.3)), dotSize: size * 0.018 + 0.3 },
  ];

  let dotIndex = 0;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background glow */}
        <defs>
          <radialGradient id={`glow-${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill={`url(#glow-${size})`} />

        {/* Layers of dots with connections */}
        {layers.map((layer, li) => {
          const layerDots = Array.from({ length: layer.count }, (_, i) => {
            const angle = (i / layer.count) * Math.PI * 2;
            const x = cx + Math.cos(angle) * layer.radius;
            const y = cy + Math.sin(angle) * layer.radius;
            return { x, y, idx: dotIndex++ };
          });

          return (
            <g key={li}>
              {/* Connections within layer */}
              {layerDots.map((d, i) => {
                const next = layerDots[(i + 1) % layerDots.length];
                const skip = layerDots[(i + 2) % layerDots.length];
                return (
                  <g key={d.idx}>
                    <line x1={d.x} y1={d.y} x2={next.x} y2={next.y} stroke="#34d399" strokeWidth={0.4} opacity={0.15}>
                      <animate attributeName="opacity" values="0.08;0.25;0.08" dur={`${2 + d.idx * 0.2}s`} repeatCount="indefinite" />
                    </line>
                    {layer.count > 3 && (
                      <line x1={d.x} y1={d.y} x2={skip.x} y2={skip.y} stroke="#34d399" strokeWidth={0.2} opacity={0.08}>
                        <animate attributeName="opacity" values="0.03;0.15;0.03" dur={`${3 + d.idx * 0.3}s`} repeatCount="indefinite" />
                      </line>
                    )}
                    {/* Connection to center */}
                    <line x1={d.x} y1={d.y} x2={cx} y2={cy} stroke="#34d399" strokeWidth={0.2} opacity={0.06}>
                      <animate attributeName="opacity" values="0.03;0.12;0.03" dur={`${2.5 + d.idx * 0.25}s`} repeatCount="indefinite" />
                    </line>
                  </g>
                );
              })}

              {/* Cross-layer connections (inner to outer) */}
              {li < layers.length - 1 && layerDots.map((d, i) => {
                const nextLayer = layers[li + 1];
                const nextAngle = (i / nextLayer.count) * Math.PI * 2;
                const nx = cx + Math.cos(nextAngle) * nextLayer.radius;
                const ny = cy + Math.sin(nextAngle) * nextLayer.radius;
                return (
                  <line key={`cross-${d.idx}`} x1={d.x} y1={d.y} x2={nx} y2={ny} stroke="#34d399" strokeWidth={0.15} opacity={0.05}>
                    <animate attributeName="opacity" values="0.02;0.1;0.02" dur={`${3.5 + d.idx * 0.2}s`} repeatCount="indefinite" />
                  </line>
                );
              })}

              {/* Dots */}
              {layerDots.map((d) => (
                <circle key={d.idx} cx={d.x} cy={d.y} r={layer.dotSize} fill="#34d399" opacity={0.5}>
                  <animate attributeName="opacity" values="0.25;0.75;0.25" dur={`${1.5 + d.idx * 0.3}s`} repeatCount="indefinite" />
                  <animate attributeName="r" values={`${layer.dotSize};${layer.dotSize * 1.4};${layer.dotSize}`} dur={`${2 + d.idx * 0.2}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
          );
        })}

        {/* Center pulse */}
        <circle cx={cx} cy={cy} r={size * 0.035} fill="#34d399" opacity={0.6}>
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
          <animate attributeName="r" values={`${size * 0.025};${size * 0.045};${size * 0.025}`} dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
