-- =============================================================
-- Diagnose: "Shop wallet" shows the same number as "USD ready"
-- after admin only intended to change withdrawable USD.
-- =============================================================

-- 1) Confirm columns exist and whether wallet_balance is GENERATED (mirrors usd_balance).
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  is_generated,
  generation_expression
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('wallet_balance', 'usd_balance')
ORDER BY column_name;

-- 2) List triggers on public.users (could copy usd_balance → wallet_balance).
SELECT tgname AS trigger_name, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'users'
  AND NOT t.tgisinternal;

-- 3) Inspect one user row raw (replace id).
-- SELECT id, wallet_balance, usd_balance FROM public.users WHERE id = 'YOUR-UUID-HERE';

-- Fix direction (human checks required):
-- - If wallet_balance is GENERATED ALWAYS AS (...usd_balance...): drop and re-add as a
--   plain numeric column (see add_wallet_balance.sql), then set wallet_balance defaults.
-- - If admin PHP updates both columns: change admin to update ONLY usd_balance for
--   "USD ready / withdrawal" adjustments, and ONLY wallet_balance for "fund shop" deposits.
