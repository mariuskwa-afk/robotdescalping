/*
# Archive existing bot predictions and reset counter

1. New Tables
- `bot_predictions_archive` — exact copy of bot_predictions schema for historical storage
  - id (uuid, primary key)
  - symbol (text)
  - signal (text)
  - confidence (int)
  - price_at_prediction (numeric)
  - price_at_expiry (numeric, nullable)
  - result (text)
  - reasons (text, nullable)
  - created_at (timestamptz)
  - expired_at (timestamptz, nullable)
  - archived_at (timestamptz, defaults to now()) — marks when the row was moved to archive
2. Security
- Enable RLS on bot_predictions_archive
- Allow anon + authenticated CRUD (single-tenant, no auth)
3. Data Move
- Copy all 32 rows from bot_predictions into bot_predictions_archive
- Truncate bot_predictions to reset the counter to 0
4. Important Notes
- The archive table preserves all original data including timestamps
- bot_predictions is emptied so new trades start fresh
*/

CREATE TABLE IF NOT EXISTS bot_predictions_archive (
  id uuid PRIMARY KEY,
  symbol text NOT NULL,
  signal text NOT NULL,
  confidence int NOT NULL,
  price_at_prediction numeric NOT NULL,
  price_at_expiry numeric,
  result text NOT NULL DEFAULT 'PENDING',
  reasons text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expired_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bot_predictions_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_archive" ON bot_predictions_archive;
CREATE POLICY "anon_select_archive" ON bot_predictions_archive FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_archive" ON bot_predictions_archive;
CREATE POLICY "anon_insert_archive" ON bot_predictions_archive FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_archive" ON bot_predictions_archive;
CREATE POLICY "anon_update_archive" ON bot_predictions_archive FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_archive" ON bot_predictions_archive;
CREATE POLICY "anon_delete_archive" ON bot_predictions_archive FOR DELETE
TO anon, authenticated USING (true);

INSERT INTO bot_predictions_archive (id, symbol, signal, confidence, price_at_prediction, price_at_expiry, result, reasons, created_at, expired_at)
SELECT id, symbol, signal, confidence, price_at_prediction, price_at_expiry, result, reasons, created_at, expired_at
FROM bot_predictions;

TRUNCATE TABLE bot_predictions;
