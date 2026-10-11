import type { Candle } from './marketData';
import { ema, rsi, bollingerBands, momentum, macd, volumeSpike, williamsR, stochRsi } from './indicators';

export type Signal = 'UP' | 'DOWN' | 'WAIT';

export interface Prediction {
  signal: Signal;
  confidence: number;
  reasons: { indicator: string; direction: 'bullish' | 'bearish' | 'neutral'; detail: string }[];
  indicators: {
    rsi: number;
    emaFast: number;
    emaSlow: number;
    macdHist: number;
    momentum: number;
    williamsR: number;
    stochRsi: number;
    bbUpper: number;
    bbMiddle: number;
    bbLower: number;
    volumeSpike: boolean;
  };
}

export function predict(candles: Candle[]): Prediction {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const price = closes[closes.length - 1];

  const emaFastArr = ema(closes, 5);
  const emaSlowArr = ema(closes, 10);
  const emaFast = emaFastArr[emaFastArr.length - 1];
  const emaSlow = emaSlowArr[emaSlowArr.length - 1];

  const rsiVal = rsi(closes, 14);
  const macdRes = macd(closes);
  const mom = momentum(closes, 5);
  const bb = bollingerBands(closes, 20, 2);
  const wr = williamsR(candles, 14);
  const stoch = stochRsi(closes);
  const volSpike = volumeSpike(volumes, 10);

  const reasons: Prediction['reasons'] = [];
  let bullScore = 0;
  let bearScore = 0;

  // EMA crossover
  const prevEmaFast = emaFastArr[emaFastArr.length - 2];
  const prevEmaSlow = emaSlowArr[emaSlowArr.length - 2];
  if (prevEmaFast <= prevEmaSlow && emaFast > emaSlow) {
    bullScore += 3;
    reasons.push({ indicator: 'EMA 5/10', direction: 'bullish', detail: 'Croisement haussier : EMA5 passe au-dessus EMA10' });
  } else if (prevEmaFast >= prevEmaSlow && emaFast < emaSlow) {
    bearScore += 3;
    reasons.push({ indicator: 'EMA 5/10', direction: 'bearish', detail: 'Croisement baissier : EMA5 passe sous EMA10' });
  } else if (emaFast > emaSlow) {
    bullScore += 1;
    reasons.push({ indicator: 'EMA 5/10', direction: 'bullish', detail: 'EMA5 au-dessus EMA10 (tendance haussière)' });
  } else {
    bearScore += 1;
    reasons.push({ indicator: 'EMA 5/10', direction: 'bearish', detail: 'EMA5 sous EMA10 (tendance baissière)' });
  }

  // RSI — momentum confirmation on 1-min (high = bullish momentum, low = bearish)
  if (rsiVal > 70) {
    bullScore += 2;
    reasons.push({ indicator: 'RSI 14', direction: 'bullish', detail: `RSI à ${rsiVal.toFixed(1)} — momentum haussier très fort` });
  } else if (rsiVal < 30) {
    bearScore += 2;
    reasons.push({ indicator: 'RSI 14', direction: 'bearish', detail: `RSI à ${rsiVal.toFixed(1)} — momentum baissier très fort` });
  } else if (rsiVal > 55) {
    bullScore += 2;
    reasons.push({ indicator: 'RSI 14', direction: 'bullish', detail: `RSI à ${rsiVal.toFixed(1)} — momentum haussier confirmé` });
  } else if (rsiVal < 45) {
    bearScore += 2;
    reasons.push({ indicator: 'RSI 14', direction: 'bearish', detail: `RSI à ${rsiVal.toFixed(1)} — momentum baissier confirmé` });
  } else {
    reasons.push({ indicator: 'RSI 14', direction: 'neutral', detail: `RSI à ${rsiVal.toFixed(1)} — zone neutre` });
  }

  // MACD histogram
  if (macdRes.histogram > 0.0001) {
    bullScore += 2;
    reasons.push({ indicator: 'MACD', direction: 'bullish', detail: 'Histogramme MACD positif — pression acheteuse' });
  } else if (macdRes.histogram < -0.0001) {
    bearScore += 2;
    reasons.push({ indicator: 'MACD', direction: 'bearish', detail: 'Histogramme MACD négatif — pression vendeuse' });
  } else {
    reasons.push({ indicator: 'MACD', direction: 'neutral', detail: 'Histogramme MACD proche de zéro — indécis' });
  }

  // Momentum
  if (mom > 0.05) {
    bullScore += 1;
    reasons.push({ indicator: 'Momentum', direction: 'bullish', detail: `Momentum ${mom.toFixed(2)}% — prix en accélération haussière` });
  } else if (mom < -0.05) {
    bearScore += 1;
    reasons.push({ indicator: 'Momentum', direction: 'bearish', detail: `Momentum ${mom.toFixed(2)}% — prix en décélération` });
  } else {
    reasons.push({ indicator: 'Momentum', direction: 'neutral', detail: `Momentum ${mom.toFixed(2)}% — indécis` });
  }

  // Bollinger position — momentum confirmation on 1-min (upper band = price rising = bullish)
  if (price >= bb.upper) {
    bullScore += 2;
    reasons.push({ indicator: 'Bollinger', direction: 'bullish', detail: 'Prix sur bande supérieure — momentum haussier fort' });
  } else if (price <= bb.lower) {
    bearScore += 2;
    reasons.push({ indicator: 'Bollinger', direction: 'bearish', detail: 'Prix sur bande inférieure — momentum baissier fort' });
  } else if (price > bb.middle) {
    bullScore += 1;
    reasons.push({ indicator: 'Bollinger', direction: 'bullish', detail: 'Prix au-dessus de la moyenne — tendance haussière' });
  } else if (price < bb.middle) {
    bearScore += 1;
    reasons.push({ indicator: 'Bollinger', direction: 'bearish', detail: 'Prix en-dessous de la moyenne — tendance baissière' });
  } else {
    reasons.push({ indicator: 'Bollinger', direction: 'neutral', detail: "Prix sur la moyenne — indécis" });
  }

  // Williams %R — momentum confirmation on 1-min (overbought = price rising = bullish)
  if (wr > -20) {
    bullScore += 1;
    reasons.push({ indicator: 'Williams %R', direction: 'bullish', detail: `${wr.toFixed(1)} — momentum haussier fort` });
  } else if (wr < -80) {
    bearScore += 1;
    reasons.push({ indicator: 'Williams %R', direction: 'bearish', detail: `${wr.toFixed(1)} — momentum baissier fort` });
  } else if (wr > -50) {
    bullScore += 1;
    reasons.push({ indicator: 'Williams %R', direction: 'bullish', detail: `${wr.toFixed(1)} — légère tendance haussière` });
  } else if (wr < -50) {
    bearScore += 1;
    reasons.push({ indicator: 'Williams %R', direction: 'bearish', detail: `${wr.toFixed(1)} — légère tendance baissière` });
  } else {
    reasons.push({ indicator: 'Williams %R', direction: 'neutral', detail: `${wr.toFixed(1)} — zone neutre` });
  }

  // Stochastic RSI — momentum confirmation on 1-min (high = price rising = bullish)
  if (stoch > 80) {
    bullScore += 1;
    reasons.push({ indicator: 'Stoch RSI', direction: 'bullish', detail: `${stoch.toFixed(1)} — momentum haussier fort` });
  } else if (stoch < 20) {
    bearScore += 1;
    reasons.push({ indicator: 'Stoch RSI', direction: 'bearish', detail: `${stoch.toFixed(1)} — momentum baissier fort` });
  } else if (stoch > 50) {
    bullScore += 1;
    reasons.push({ indicator: 'Stoch RSI', direction: 'bullish', detail: `${stoch.toFixed(1)} — tendance haussière` });
  } else if (stoch < 50) {
    bearScore += 1;
    reasons.push({ indicator: 'Stoch RSI', direction: 'bearish', detail: `${stoch.toFixed(1)} — tendance baissière` });
  } else {
    reasons.push({ indicator: 'Stoch RSI', direction: 'neutral', detail: `${stoch.toFixed(1)} — neutre` });
  }

  // Volume spike
  if (volSpike) {
    reasons.push({ indicator: 'Volume', direction: bullScore > bearScore ? 'bullish' : 'bearish', detail: 'Pic de volume — mouvement confirmé' });
    if (bullScore > bearScore) bullScore += 1;
    else bearScore += 1;
  } else {
    reasons.push({ indicator: 'Volume', direction: 'neutral', detail: 'Volume normal' });
  }

  // Exhaustion detection: count how many indicators are in extreme territory.
  // On 1-min charts, when too many oscillators are pegged at their extremes,
  // the move is likely exhausted and about to reverse.
  const extremeBull = (rsiVal > 75 ? 1 : 0) + (wr > -15 ? 1 : 0) + (stoch > 85 ? 1 : 0) + (price >= bb.upper ? 1 : 0);
  const extremeBear = (rsiVal < 25 ? 1 : 0) + (wr < -85 ? 1 : 0) + (stoch < 15 ? 1 : 0) + (price <= bb.lower ? 1 : 0);

  // Fresh crossover detection: EMA crossover just happened (stronger signal than steady-state)
  const freshBullCross = prevEmaFast <= prevEmaSlow && emaFast > emaSlow;
  const freshBearCross = prevEmaFast >= prevEmaSlow && emaFast < emaSlow;

  const totalScore = bullScore + bearScore;
  const maxPossibleScore = 13;
  let signal: Signal = 'WAIT';
  let confidence = 0;

  if (totalScore > 0) {
    const bullPercent = (bullScore / totalScore) * 100;
    const agreementRatio = totalScore / maxPossibleScore;

    if (bullPercent >= 65) {
      signal = 'UP';
      confidence = Math.round(bullPercent * (0.55 + 0.35 * agreementRatio));
      if (freshBullCross) {
        confidence = Math.min(100, confidence + 8);
        reasons.push({ indicator: 'Signal frais', direction: 'bullish', detail: 'Croisement EMA frais — mouvement naissant, meilleure probabilité' });
      }
      if (extremeBull >= 3) {
        confidence = Math.round(confidence * 0.55);
        reasons.push({ indicator: 'Epuisement', direction: 'neutral', detail: `${extremeBull} indicateurs en zone extrême haussière — risque de retournement` });
      }
    } else if (bullPercent <= 35) {
      signal = 'DOWN';
      confidence = Math.round((100 - bullPercent) * (0.55 + 0.35 * agreementRatio));
      if (freshBearCross) {
        confidence = Math.min(100, confidence + 8);
        reasons.push({ indicator: 'Signal frais', direction: 'bearish', detail: 'Croisement EMA frais — mouvement naissant, meilleure probabilité' });
      }
      if (extremeBear >= 3) {
        confidence = Math.round(confidence * 0.55);
        reasons.push({ indicator: 'Epuisement', direction: 'neutral', detail: `${extremeBear} indicateurs en zone extrême baissière — risque de retournement` });
      }
    } else {
      signal = 'WAIT';
      confidence = Math.round(Math.max(bullPercent, 100 - bullPercent) * (0.55 + 0.35 * agreementRatio));
    }
  }

  return {
    signal,
    confidence,
    reasons,
    indicators: {
      rsi: rsiVal,
      emaFast,
      emaSlow,
      macdHist: macdRes.histogram,
      momentum: mom,
      williamsR: wr,
      stochRsi: stoch,
      bbUpper: bb.upper,
      bbMiddle: bb.middle,
      bbLower: bb.lower,
      volumeSpike: volSpike,
    },
  };
}
