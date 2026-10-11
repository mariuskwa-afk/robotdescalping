/*
# Create predictions tracking table

1. New Tables
- `bot_predictions`: stores each 1-minute prediction made by the binary options predictor tool.
- `id`: uuid primary key.
- `symbol`: trading symbol (e.g. BTCUSDT).
- `signal`: direction predicted — UP, DOWN, or WAIT.
- `confidence`: confidence percentage (0-100).
- `price_at_prediction`: asset price when the prediction was made.
- `price_at_expiry`: asset price 60 seconds later (filled when the candle closes).
- `result`: WIN, LOSS, or PENDING — whether the prediction was correct.
- `reasons`: JSON array of indicator reasons (stored as text for simplicity).
- `created_at`: timestamp when prediction was made.
- `expired_at`: timestamp when the 1-minute candle closed.

2. Security
- Row-level security enabled.
- Single-user, no-sign-in tool: anon + authenticated can read and write the intentionally shared prediction log.
- Four separate CRUD policies.

3. Important Notes
- This table tracks prediction accuracy over time so the user can see real performance stats.
- Results are determined by comparing price_at_prediction vs price_at_expiry.
*/

CREATE TABLE IF NOT EXISTS public.bot_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  signal text NOT NULL DEFAULT 'WAIT',
  confidence integer NOT NULL DEFAULT 0,
  price_at_prediction numeric NOT NULL DEFAULT 0,
  price_at_expiry numeric,
  result text NOT NULL DEFAULT 'PENDING',
  reasons text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expired_at timestamptz
);

ALTER TABLE public.bot_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "predictor can read predictions" ON public.bot_predictions;
CREATE POLICY "predictor can read predictions"
  ON public.bot_predictions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "predictor can insert predictions" ON public.bot_predictions;
CREATE POLICY "predictor can insert predictions"
  ON public.bot_predictions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "predictor can update predictions" ON public.bot_predictions;
CREATE POLICY "predictor can update predictions"
  ON public.bot_predictions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "predictor can delete predictions" ON public.bot_predictions;
CREATE POLICY "predictor can delete predictions"
  ON public.bot_predictions FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_bot_predictions_created ON public.bot_predictions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_predictions_result ON public.bot_predictions (result);
