import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, Bell, BellOff, Brain, ChartCandlestick,
  CircleDot, History, Loader2, MinusCircle, Percent, Play, Square,
  TrendingDown, TrendingUp, AlertTriangle, Zap, Target, BarChart3
} from 'lucide-react';
import { fetchKlines, fetchTicker, ASSET_GROUPS } from '@/lib/marketData';
import type { Candle } from '@/lib/marketData';
import { predict } from '@/lib/predictor';
import type { Prediction, Signal } from '@/lib/predictor';
import { supabase } from '@/lib/supabase';
import { PredictionHistory } from '@/components/PredictionHistory';
import { MiniChart } from '@/components/MiniChart';
import { playUpSignal, playDownSignal, playWin, playLoss, unlockAudio } from '@/lib/sound';

interface PredictionRecord {
  id: string;
  symbol: string;
  signal: string;
  confidence: number;
  price_at_prediction: number;
  price_at_expiry: number | null;
  result: string;
  created_at: string;
}

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [changePercent, setChangePercent] = useState(0);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PredictionRecord[]>([]);
  const [globalStats, setGlobalStats] = useState({ wins: 0, losses: 0, draws: 0, total: 0 });
  const [activeTab, setActiveTab] = useState<'predictor' | 'history' | 'about'>('predictor');
  const [countdown, setCountdown] = useState(60);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTrade, setActiveTrade] = useState(false);
  const [tradeSignal, setTradeSignal] = useState<Signal>('WAIT');
  const [tradeConfidence, setTradeConfidence] = useState(0);
  const countdownRef = useRef<number>(0);
  const tradeExpiryRef = useRef<number>(0);
  const activeTradeRef = useRef(false);
  const predictionRef = useRef<Prediction | null>(null);
  const tradeSnapshotRef = useRef<Prediction | null>(null);
  const savePredictionRef = useRef<() => void>(() => {});
  const resolvePredictionRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const lastPredictionRef = useRef<PredictionRecord | null>(null);
  const prevSignalRef = useRef<string>('');
  const prevResultRef = useRef<string>('');
  const resolvingRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [klines, ticker] = await Promise.all([
        fetchKlines(symbol, '1m', 100),
        fetchTicker(symbol),
      ]);
      setCandles(klines);
      setCurrentPrice(ticker.price);
      setChangePercent(ticker.changePercent);
      const pred = predict(klines);
      setPrediction(pred);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const loadHistory = useCallback(async () => {
    const [histRes, statsRes] = await Promise.all([
      supabase
        .from('bot_predictions')
        .select('id, symbol, signal, confidence, price_at_prediction, price_at_expiry, result, created_at')
        .eq('symbol', symbol)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('bot_predictions')
        .select('result')
        .eq('symbol', symbol)
        .in('result', ['WIN', 'LOSS', 'DRAW']),
    ]);
    if (histRes.data) setHistory(histRes.data as PredictionRecord[]);
    if (statsRes.data) {
      const records = statsRes.data as { result: string }[];
      const wins = records.filter((r) => r.result === 'WIN').length;
      const losses = records.filter((r) => r.result === 'LOSS').length;
      const draws = records.filter((r) => r.result === 'DRAW').length;
      setGlobalStats({ wins, losses, draws, total: wins + losses });
    }
  }, [symbol]);

  useEffect(() => {
    void loadData();
    void loadHistory();
    const interval = setInterval(() => {
      void loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadData, loadHistory]);

  // Sound alerts on signal change (70%+ confidence)
  useEffect(() => {
    if (!soundEnabled || !prediction) return;
    const currentSignal = prediction.signal;
    const prevSignal = prevSignalRef.current;
    if (currentSignal !== prevSignal && currentSignal !== 'WAIT' && prediction.confidence >= 70) {
      unlockAudio();
      if (currentSignal === 'UP') playUpSignal();
      else if (currentSignal === 'DOWN') playDownSignal();
    }
    prevSignalRef.current = currentSignal;
  }, [prediction, soundEnabled]);

  // Sound alert on result change (WIN/LOSS)
  useEffect(() => {
    if (!soundEnabled || history.length === 0) return;
    const latestResult = history[0]?.result;
    if (latestResult && latestResult !== 'PENDING' && latestResult !== prevResultRef.current) {
      if (latestResult === 'WIN') playWin();
      else if (latestResult === 'LOSS') playLoss();
    }
    prevResultRef.current = latestResult || '';
  }, [history, soundEnabled]);

  // Live trading loop — interval created once when Live turns on, survives all data refreshes
  useEffect(() => {
    if (!isLive) {
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
        countdownRef.current = 0;
      }
      activeTradeRef.current = false;
      setActiveTrade(false);
      return;
    }

    countdownRef.current = window.setInterval(() => {
      if (!activeTradeRef.current && !resolvingRef.current) {
        const pred = predictionRef.current;
        if (pred && pred.signal !== 'WAIT' && pred.confidence >= 70) {
          activeTradeRef.current = true;
          setActiveTrade(true);
          setTradeSignal(pred.signal);
          setTradeConfidence(pred.confidence);
          tradeSnapshotRef.current = pred;
          tradeExpiryRef.current = Date.now() + 60_000;
          setCountdown(60);
          void savePredictionRef.current();
        }
      } else {
        const remaining = Math.max(0, Math.ceil((tradeExpiryRef.current - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining === 0) {
          activeTradeRef.current = false;
          setActiveTrade(false);
          setTradeSignal('WAIT');
          setTradeConfidence(0);
          resolvingRef.current = true;
          void resolvePredictionRef.current().finally(() => { resolvingRef.current = false; });
        }
      }
    }, 250);

    return () => {
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
        countdownRef.current = 0;
      }
    };
  }, [isLive]);

  const savePrediction = useCallback(async () => {
    const snap = tradeSnapshotRef.current;
    if (!snap || snap.signal === 'WAIT') return;
    const record = {
      symbol,
      signal: snap.signal,
      confidence: snap.confidence,
      price_at_prediction: currentPrice,
      result: 'PENDING',
      reasons: JSON.stringify(snap.reasons),
    };
    const { data } = await supabase.from('bot_predictions').insert(record).select().maybeSingle();
    if (data) lastPredictionRef.current = data as PredictionRecord;
    void loadHistory();
  }, [symbol, currentPrice, loadHistory]);

  const resolvePrediction = useCallback(async () => {
    const pending = lastPredictionRef.current;
    if (!pending) return;
    const ticker = await fetchTicker(symbol);
    const expiryPrice = ticker.price;
    const isUp = pending.signal === 'UP';
    const entryPrice = Number(pending.price_at_prediction);
    const priceDiff = expiryPrice - entryPrice;
    let result: string;
    if (Math.abs(priceDiff) < entryPrice * 0.00001) {
      result = 'DRAW';
    } else {
      const isWin = (isUp && priceDiff > 0) || (!isUp && priceDiff < 0);
      result = isWin ? 'WIN' : 'LOSS';
    }

    await supabase
      .from('bot_predictions')
      .update({ price_at_expiry: expiryPrice, result, expired_at: new Date().toISOString() })
      .eq('id', pending.id);

    if (lastPredictionRef.current?.id === pending.id) {
      lastPredictionRef.current = null;
    }
    void loadHistory();
  }, [symbol, loadHistory]);

  // Keep refs in sync so the live interval always sees latest values
  predictionRef.current = prediction;
  savePredictionRef.current = savePrediction;
  resolvePredictionRef.current = resolvePrediction;

  const wins = globalStats.wins;
  const losses = globalStats.losses;
  const draws = globalStats.draws;
  const total = globalStats.total;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-200">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-[#0d1117] sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Crypto Predictor 1M</h1>
              <p className="text-xs text-gray-500">Prediction haut/bas · options 1 minute</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (!soundEnabled) unlockAudio(); setSoundEnabled(!soundEnabled); }}
              className={`p-2 rounded-lg border transition-all ${
                soundEnabled
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20'
                  : 'bg-[#11151c] text-gray-600 border-gray-700 hover:text-gray-400'
              }`}
              title={soundEnabled ? 'Son active' : 'Son coupe'}
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <select
              value={symbol}
              onChange={(e) => { if (!activeTrade) { setSymbol(e.target.value); setLoading(true); } }}
              disabled={activeTrade}
              className={`bg-[#11151c] border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors ${activeTrade ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {ASSET_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.symbols.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={() => {
                if (isLive) {
                  setIsLive(false);
                } else {
                  setIsLive(true);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isLive
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                  : 'bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-cyan-500'
              }`}
            >
              {isLive ? <><Square className="w-4 h-4" /> Stop</> : <><Play className="w-4 h-4" /> Live</>}
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-gray-800/60 bg-[#0d1117] sticky top-[65px] z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1">
            {[
              { id: 'predictor' as const, label: 'Prediction', icon: Brain },
              { id: 'history' as const, label: 'Historique', icon: History },
              { id: 'about' as const, label: 'A propos', icon: AlertTriangle },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                    activeTab === tab.id ? 'border-sky-500 text-sky-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* PREDICTOR TAB */}
        {activeTab === 'predictor' && (
          <div className="space-y-6">
            {/* Price bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <PriceCard label="Prix actuel" value={loading ? '...' : formatPrice(currentPrice, symbol)} icon={CircleDot} tone="sky" />
              <PriceCard label="Variation 24h" value={`${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`} icon={changePercent >= 0 ? TrendingUp : TrendingDown} tone={changePercent >= 0 ? 'emerald' : 'red'} />
              <PriceCard label="Win rate" value={`${winRate}%`} icon={Percent} tone="amber" />
              <PriceCard label="Signaux totaux" value={String(total)} icon={BarChart3} tone="purple" />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Trade in progress — stays visible until the 60s expire */}
            {activeTrade && (
              <div className={`rounded-3xl border-2 p-6 sm:p-8 transition-all duration-500 ${
                tradeSignal === 'UP'
                  ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border-emerald-500/40'
                  : 'bg-gradient-to-br from-red-500/15 to-red-600/5 border-red-500/40'
              }`}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {tradeSignal === 'UP'
                      ? <ArrowUpCircle className="w-14 h-14 text-emerald-400 animate-pulse" strokeWidth={1.5} />
                      : <ArrowDownCircle className="w-14 h-14 text-red-400 animate-pulse" strokeWidth={1.5} />}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Trade en cours</p>
                      <p className={`text-3xl font-black ${tradeSignal === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tradeSignal === 'UP' ? 'HAUT' : 'BAS'}
                      </p>
                      <p className={`text-sm font-semibold ${tradeSignal === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tradeConfidence}% confiance
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expiration</p>
                    <p className="text-4xl font-bold text-amber-400 tabular-nums">{countdown}s</p>
                  </div>
                </div>
              </div>
            )}

            {/* Main signal display — live prediction (changes every refresh) */}
            <div className={`rounded-3xl border-2 p-8 sm:p-12 transition-all duration-500 ${
              prediction?.signal === 'UP'
                ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border-emerald-500/40'
                : prediction?.signal === 'DOWN'
                ? 'bg-gradient-to-br from-red-500/15 to-red-600/5 border-red-500/40'
                : 'bg-[#11151c] border-gray-800/60'
            }`}>
              <div className="flex flex-col items-center text-center">
                {loading ? (
                  <Loader2 className="w-16 h-16 text-gray-600 animate-spin" />
                ) : prediction?.signal === 'UP' ? (
                  <ArrowUpCircle className="w-20 h-20 text-emerald-400 mb-4 animate-pulse" strokeWidth={1.5} />
                ) : prediction?.signal === 'DOWN' ? (
                  <ArrowDownCircle className="w-20 h-20 text-red-400 mb-4 animate-pulse" strokeWidth={1.5} />
                ) : (
                  <MinusCircle className="w-20 h-20 text-gray-600 mb-4" strokeWidth={1.5} />
                )}

                <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">
                  {activeTrade ? 'Signal en direct' : 'Signal'}
                </p>
                {prediction?.signal === 'UP' && <p className="text-5xl sm:text-6xl font-black text-emerald-400">HAUT</p>}
                {prediction?.signal === 'DOWN' && <p className="text-5xl sm:text-6xl font-black text-red-400">BAS</p>}
                {prediction?.signal === 'WAIT' && <p className="text-5xl sm:text-6xl font-black text-gray-600">ATTENDRE</p>}
                {loading && <p className="text-5xl sm:text-6xl font-black text-gray-700">...</p>}

                {prediction && prediction.signal !== 'WAIT' && (
                  <div className="mt-6 flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Confiance</p>
                      <p className={`text-3xl font-bold ${prediction.signal === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>{prediction.confidence}%</p>
                    </div>
                  </div>
                )}

                {/* Confidence bar */}
                {prediction && prediction.signal !== 'WAIT' && (
                  <div className="mt-6 w-full max-w-md">
                    <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${prediction.signal === 'UP' ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${prediction.confidence}%` }}
                      />
                    </div>
                  </div>
                )}

                {activeTrade && prediction?.signal === 'WAIT' && (
                  <p className="mt-4 text-xs text-gray-500">Le signal en direct a change, mais le trade en cours reste actif jusqu'a son expiration.</p>
                )}
              </div>
            </div>

            {/* Indicator breakdown */}
            {prediction && (
              <div className="bg-[#11151c] rounded-2xl border border-gray-800/60 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <ChartCandlestick className="w-5 h-5 text-sky-400" />
                  Analyse des indicateurs
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {prediction.reasons.map((r, i) => (
                    <IndicatorRow key={i} indicator={r.indicator} detail={r.detail} direction={r.direction} />
                  ))}
                </div>
              </div>
            )}

            {/* Live candlestick chart */}
            <MiniChart candles={candles} height={220} />

            {/* Quick stats */}
            <div className="grid sm:grid-cols-3 gap-4">
              <MiniStat label="Wins" value={wins} icon={TrendingUp} color="text-emerald-400" />
              <MiniStat label="Losses" value={losses} icon={TrendingDown} color="text-red-400" />
              <MiniStat label="Win rate" value={`${winRate}%`} icon={Target} color="text-amber-400" />
            </div>
          </div>
        )}
        {activeTab === 'history' && (
          <PredictionHistory history={history} wins={wins} losses={losses} draws={draws} winRate={winRate} />
        )}

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            <div className="bg-[#11151c] rounded-2xl border border-gray-800/60 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-sky-400" />
                Comment ca marche ?
              </h2>
              <div className="space-y-4 text-sm text-gray-400 leading-relaxed">
                <p>
                  Cet outil analyse en temps reel les prix de plusieurs cryptomonnaies (via l'API Binance)
                  et calcule une probabilite de direction sur la prochaine minute. Il combine 7 indicateurs
                  techniques court terme : EMA 5/10 (croisement), RSI 14, MACD, Momentum, Bollinger Bands,
                  Williams %R, et Stochastic RSI.
                </p>
                <p>
                  Quand au moins 65% des indicateurs pointent dans la meme direction, un signal <strong className="text-emerald-400">HAUT</strong> ou
                  <strong className="text-red-400"> BAS</strong> est affiche avec un score de confiance. Sinon, le signal reste <strong className="text-gray-300">ATTENDRE</strong>.
                </p>
                <p>
                  Cliquez sur <strong className="text-sky-400">Live</strong> pour demarrer le suivi. Chaque signal est sauvegarde et
                  verifie 60 secondes plus tard pour calculer le taux de reussite reel.
                </p>
                <p>
                  Une <strong className="text-sky-400">alerte sonore</strong> retentit quand un signal atteint 70%+ de confiance (activez-la avec l'icone cloche en haut a droite).
                  Un <strong className="text-sky-400">graphique en bougies</strong> affiche les 40 dernieres minutes de prix en temps reel.
                </p>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex gap-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-amber-400 font-semibold text-sm mb-2">Avertissement</h3>
                <ul className="text-gray-400 text-sm leading-relaxed space-y-1.5">
                  <li>Aucune prediction n'est garantie a 100%. Le marche peut faire le contraire du signal a tout moment.</li>
                  <li>Les options binaires 1 minute sont extrrement risquees et la plupart des traders perdent de l'argent.</li>
                  <li>Cet outil est un outil d'aide a la decision, pas un robot de trading automatique.</li>
                  <li>Utilisez un compte demo pour tester la fiabilite avant tout trade reel.</li>
                  <li>Ne tradez jamais avec de l'argent que vous ne pouvez pas vous permettre de perdre.</li>
                </ul>
              </div>
            </div>

            <div className="bg-[#11151c] rounded-2xl border border-gray-800/60 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Conseils pour maximiser les chances
              </h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex gap-2"><CircleDot className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" /> Ne tradez que les signaux avec 70%+ de confiance</li>
                <li className="flex gap-2"><CircleDot className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" /> Evitez les moments de faible volatilite (signaux ATTENDRE)</li>
                <li className="flex gap-2"><CircleDot className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" /> Suivez le win rate : s'il tombe sous 55%, arretez et reanalysez</li>
                <li className="flex gap-2"><CircleDot className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" /> Les premieres minutes apres une news economique sont imprevisibles</li>
                <li className="flex gap-2"><CircleDot className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" /> L'outil doit rester ouvert a cote de votre plateforme de trading</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800/60 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-gray-600 text-xs">
            Crypto Predictor 1M · Outil d'analyse technique · Aucun garantie de resultat · Le trading comporte des risques
          </p>
        </div>
      </footer>
    </div>
  );
}

function formatPrice(price: number, symbol: string): string {
  const isForex = symbol.includes('/');
  if (isForex) return price.toFixed(symbol.includes('JPY') ? 3 : 5);
  return `${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function PriceCard({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: typeof CircleDot; tone: 'sky' | 'emerald' | 'red' | 'amber' | 'purple';
}) {
  const tones = {
    sky: 'from-sky-500/10 to-sky-500/5 border-sky-500/20 text-sky-400',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    red: 'from-red-500/10 to-red-500/5 border-red-500/20 text-red-400',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-400',
  };
  return (
    <div className={`bg-gradient-to-br ${tones[tone]} rounded-2xl border p-4`}>
      <Icon className="w-5 h-5 mb-2" />
      <p className="text-gray-500 text-xs mb-0.5">{label}</p>
      <p className="text-white font-bold text-lg">{value}</p>
    </div>
  );
}

function IndicatorRow({ indicator, detail, direction }: {
  indicator: string; detail: string; direction: 'bullish' | 'bearish' | 'neutral';
}) {
  const colors = {
    bullish: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    bearish: 'text-red-400 bg-red-500/10 border-red-500/20',
    neutral: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  };
  const icons = {
    bullish: <TrendingUp className="w-4 h-4" />,
    bearish: <TrendingDown className="w-4 h-4" />,
    neutral: <MinusCircle className="w-4 h-4" />,
  };
  return (
    <div className={`rounded-xl border p-3 flex items-start gap-3 ${colors[direction]}`}>
      <div className="mt-0.5">{icons[direction]}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-200">{indicator}</p>
        <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: typeof TrendingUp; color: string;
}) {
  return (
    <div className="bg-[#11151c] rounded-xl border border-gray-800/60 p-4 flex items-center gap-3">
      <Icon className={`w-5 h-5 ${color}`} />
      <div>
        <p className="text-gray-500 text-xs">{label}</p>
        <p className={`font-bold text-xl ${color}`}>{value}</p>
      </div>
    </div>
  );
}
