import { useMemo } from 'react';
import type { Candle } from '@/lib/marketData';

interface MiniChartProps {
  candles: Candle[];
  height?: number;
}

export function MiniChart({ candles, height = 200 }: MiniChartProps) {
  const displayCandles = candles.slice(-40);

  const { min, max, chartHeight } = useMemo(() => {
    if (displayCandles.length === 0) return { min: 0, max: 0, chartHeight: 0 };
    const lows = displayCandles.map((c) => c.low);
    const highs = displayCandles.map((c) => c.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding, chartHeight: height };
  }, [displayCandles, height]);

  if (displayCandles.length === 0) {
    return (
      <div className="bg-[#11151c] rounded-2xl border border-gray-800/60 p-4 flex items-center justify-center" style={{ height }}>
        <p className="text-gray-600 text-sm">Chargement du graphique...</p>
      </div>
    );
  }

  const range = max - min || 1;
  const candleWidth = Math.max(4, Math.floor((100 / displayCandles.length) * 0.7));
  const gap = Math.max(2, Math.floor((100 / displayCandles.length) * 0.3));

  return (
    <div className="bg-[#11151c] rounded-2xl border border-gray-800/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          Graphique 1m · 40 dernieres bougies
        </h3>
        <span className="text-gray-500 text-xs">temps reel</span>
      </div>
      <div className="relative w-full" style={{ height: chartHeight }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ height: chartHeight }}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#1a1f2e" strokeWidth="0.3" />
          ))}

          {/* Candles */}
          {displayCandles.map((c, i) => {
            const xPos = (i / displayCandles.length) * 100;
            const candleW = (candleWidth / (candleWidth + gap)) * (100 / displayCandles.length) * 0.8;
            const isGreen = c.close >= c.open;
            const highY = 100 - ((c.high - min) / range) * 100;
            const lowY = 100 - ((c.low - min) / range) * 100;
            const openY = 100 - ((c.open - min) / range) * 100;
            const closeY = 100 - ((c.close - min) / range) * 100;
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(closeY - openY), 0.5);
            const color = isGreen ? '#10b981' : '#ef4444';

            return (
              <g key={i}>
                <line
                  x1={xPos + candleW / 2}
                  y1={highY}
                  x2={xPos + candleW / 2}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="0.4"
                />
                <rect
                  x={xPos}
                  y={bodyTop}
                  width={candleW}
                  height={bodyHeight}
                  fill={color}
                  opacity={0.9}
                />
              </g>
            );
          })}

          {/* Current price line */}
          {(() => {
            const lastCandle = displayCandles[displayCandles.length - 1];
            const priceY = 100 - ((lastCandle.close - min) / range) * 100;
            return (
              <>
                <line
                  x1="0" y1={priceY} x2="100" y2={priceY}
                  stroke="#38bdf8" strokeWidth="0.3" strokeDasharray="2,1" opacity="0.5"
                />
                <circle cx="100" cy={priceY} r="0.8" fill="#38bdf8" />
              </>
            );
          })()}
        </svg>

        {/* Price labels */}
        <div className="absolute right-1 top-0 text-[10px] text-gray-600 font-mono">
          {max.toFixed(max < 10 ? 5 : 2)}
        </div>
        <div className="absolute right-1 bottom-0 text-[10px] text-gray-600 font-mono">
          {min.toFixed(min < 10 ? 5 : 2)}
        </div>
        <div className="absolute left-1 top-0 text-[10px] text-gray-600 font-mono">
          {displayCandles.length} bougies
        </div>
      </div>
    </div>
  );
}
