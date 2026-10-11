import type { Candle } from './marketData';

export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = values[0];
  result.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

export function rsi(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function bollingerBands(closes: number[], period: number = 20, mult: number = 2): { upper: number; middle: number; lower: number } {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mean + mult * std, middle: mean, lower: mean - mult * std };
}

export function momentum(closes: number[], period: number = 10): number {
  if (closes.length < period + 1) return 0;
  return ((closes[closes.length - 1] - closes[closes.length - 1 - period]) / closes[closes.length - 1 - period]) * 100;
}

export function macd(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }
  const signalLine = ema(macdLine, 9);
  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signalLine[signalLine.length - 1];
  return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal };
}

export function volumeSpike(volumes: number[], period: number = 10): boolean {
  if (volumes.length < period + 1) return false;
  const avg = volumes.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period;
  return volumes[volumes.length - 1] > avg * 1.5;
}

export function williamsR(candles: Candle[], period: number = 14): number {
  if (candles.length < period) return -50;
  const slice = candles.slice(-period);
  const highestHigh = Math.max(...slice.map((c) => c.high));
  const lowestLow = Math.min(...slice.map((c) => c.low));
  const currentClose = candles[candles.length - 1].close;
  if (highestHigh === lowestLow) return -50;
  return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
}

export function stochRsi(closes: number[], rsiPeriod: number = 14, stochPeriod: number = 14): number {
  if (closes.length < rsiPeriod + stochPeriod) return 50;
  const rsiValues: number[] = [];
  for (let i = rsiPeriod; i <= closes.length; i++) {
    rsiValues.push(rsi(closes.slice(0, i), rsiPeriod));
  }
  const stochSlice = rsiValues.slice(-stochPeriod);
  const minRsi = Math.min(...stochSlice);
  const maxRsi = Math.max(...stochSlice);
  if (maxRsi === minRsi) return 50;
  return ((rsiValues[rsiValues.length - 1] - minRsi) / (maxRsi - minRsi)) * 100;
}
