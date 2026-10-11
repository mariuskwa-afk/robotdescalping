export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type AssetType = 'crypto' | 'forex';

export interface AssetSymbol {
  value: string;
  label: string;
  type: AssetType;
}

const BINANCE_API = 'https://api.binance.com/api/v3';
const TWELVE_API = 'https://api.twelvedata.com';

function getTwelveDataKey(): string {
  return import.meta.env.VITE_TWELVE_DATA_API_KEY || '';
}

async function fetchCryptoKlines(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const url = `${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance erreur ${res.status}`);
  const raw = await res.json();
  return raw.map((k: unknown[]) => ({
    time: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

async function fetchCryptoTicker(symbol: string): Promise<{ price: number; changePercent: number }> {
  const url = `${BINANCE_API}/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ticker Binance erreur ${res.status}`);
  const data = await res.json();
  return {
    price: parseFloat(data.lastPrice),
    changePercent: parseFloat(data.priceChangePercent),
  };
}

async function fetchForexKlines(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const apiKey = getTwelveDataKey();
  if (!apiKey) throw new Error('Cle API Twelve Data manquante pour le forex');
  const tdInterval = interval === '1m' ? '1min' : interval;
  const url = `${TWELVE_API}/time_series?symbol=${symbol}&interval=${tdInterval}&outputsize=${limit}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Twelve Data erreur ${res.status}`);
  const data = await res.json();
  if (data.status === 'error' || !data.values) throw new Error(data.message || 'Donnees forex indisponibles');
  return data.values.map((v: { datetime: string; open: string; high: string; low: string; close: string }) => ({
    time: new Date(v.datetime).getTime(),
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
    volume: 0,
  })).reverse();
}

async function fetchForexTicker(symbol: string): Promise<{ price: number; changePercent: number }> {
  const apiKey = getTwelveDataKey();
  if (!apiKey) throw new Error('Cle API Twelve Data manquante pour le forex');
  const url = `${TWELVE_API}/price?symbol=${symbol}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Twelve Data erreur ${res.status}`);
  const data = await res.json();
  if (data.status === 'error' || !data.price) throw new Error(data.message || 'Prix forex indisponible');
  return { price: parseFloat(data.price), changePercent: 0 };
}

export async function fetchKlines(symbol: string, interval: string, limit: number = 100): Promise<Candle[]> {
  const asset = SYMBOLS.find((s) => s.value === symbol);
  if (asset?.type === 'forex') return fetchForexKlines(symbol, interval, limit);
  return fetchCryptoKlines(symbol, interval, limit);
}

export async function fetchTicker(symbol: string): Promise<{ price: number; changePercent: number }> {
  const asset = SYMBOLS.find((s) => s.value === symbol);
  if (asset?.type === 'forex') return fetchForexTicker(symbol);
  return fetchCryptoTicker(symbol);
}

export const SYMBOLS: AssetSymbol[] = [
  { value: 'BTCUSDT', label: 'BTC / USDT', type: 'crypto' },
  { value: 'ETHUSDT', label: 'ETH / USDT', type: 'crypto' },
  { value: 'BNBUSDT', label: 'BNB / USDT', type: 'crypto' },
  { value: 'SOLUSDT', label: 'SOL / USDT', type: 'crypto' },
  { value: 'XRPUSDT', label: 'XRP / USDT', type: 'crypto' },
  { value: 'DOGEUSDT', label: 'DOGE / USDT', type: 'crypto' },
  { value: 'EUR/USD', label: 'EUR / USD', type: 'forex' },
  { value: 'GBP/USD', label: 'GBP / USD', type: 'forex' },
  { value: 'USD/JPY', label: 'USD / JPY', type: 'forex' },
  { value: 'USD/CHF', label: 'USD / CHF', type: 'forex' },
  { value: 'AUD/USD', label: 'AUD / USD', type: 'forex' },
  { value: 'USD/CAD', label: 'USD / CAD', type: 'forex' },
  { value: 'NZD/USD', label: 'NZD / USD', type: 'forex' },
  { value: 'EUR/GBP', label: 'EUR / GBP', type: 'forex' },
  { value: 'EUR/JPY', label: 'EUR / JPY', type: 'forex' },
  { value: 'GBP/JPY', label: 'GBP / JPY', type: 'forex' },
];

export const ASSET_GROUPS = [
  {
    label: 'Cryptomonnaies',
    symbols: SYMBOLS.filter((s) => s.type === 'crypto'),
  },
  {
    label: 'Forex',
    symbols: SYMBOLS.filter((s) => s.type === 'forex'),
  },
];
