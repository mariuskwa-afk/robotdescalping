/*
# Create bot trade statistics storage

1. New Tables
- `bot_trade_stats`: one current snapshot for the personal BTCUSD bot monitor.
- `id`: stable single-row identifier.
- `wins`: count of closed winning trades.
- `losses`: count of closed losing trades.
- `active_positions`: number of currently open positions.
- `net_profit`: cumulative net result reported by MT5.
- `balance`: latest account balance reported by MT5.
- `equity`: latest account equity reported by MT5.
- `last_trade_at`: timestamp of the most recent completed trade.
- `updated_at`: timestamp of the latest imported snapshot.

2. Security
- Row-level security is enabled.
- This is a single-user, no-sign-in monitor, so the anonymous browser role can read and write the intentionally shared single snapshot.
- Four separate CRUD policies are created for predictable access control.

3. Important Notes
- The table stores a snapshot imported from the MT5 export file; it does not execute trades.
- The fixed identifier prevents the dashboard from creating multiple competing snapshots.
*/

CREATE TABLE IF NOT EXISTS public.bot_trade_stats (
  id text PRIMARY KEY DEFAULT 'personal-btcusd-bot',
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  active_positions integer NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  equity numeric NOT NULL DEFAULT 0,
  last_trade_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_trade_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitor can read bot stats" ON public.bot_trade_stats;
CREATE POLICY "monitor can read bot stats"
  ON public.bot_trade_stats FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "monitor can insert bot stats" ON public.bot_trade_stats;
CREATE POLICY "monitor can insert bot stats"
  ON public.bot_trade_stats FOR INSERT
  TO anon, authenticated
  WITH CHECK (id = 'personal-btcusd-bot');

DROP POLICY IF EXISTS "monitor can update bot stats" ON public.bot_trade_stats;
CREATE POLICY "monitor can update bot stats"
  ON public.bot_trade_stats FOR UPDATE
  TO anon, authenticated
  USING (id = 'personal-btcusd-bot')
  WITH CHECK (id = 'personal-btcusd-bot');

DROP POLICY IF EXISTS "monitor can delete bot stats" ON public.bot_trade_stats;
CREATE POLICY "monitor can delete bot stats"
  ON public.bot_trade_stats FOR DELETE
  TO anon, authenticated
  USING (id = 'personal-btcusd-bot');

INSERT INTO public.bot_trade_stats (id)
VALUES ('personal-btcusd-bot')
ON CONFLICT (id) DO NOTHING;