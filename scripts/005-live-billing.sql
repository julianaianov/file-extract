BEGIN;
-- Existing balances and customers remain in the test wallet.
ALTER TABLE public.extraction_accounts ADD COLUMN IF NOT EXISTS live_token_balance integer NOT NULL DEFAULT 0 CHECK(live_token_balance >= 0);
ALTER TABLE public.extraction_accounts ADD COLUMN IF NOT EXISTS live_stripe_customer_id text UNIQUE;
ALTER TABLE public.extraction_charges ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'test' CHECK(billing_mode IN ('test','live'));
ALTER TABLE public.billing_orders ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'test' CHECK(billing_mode IN ('test','live'));
ALTER TABLE public.billing_grants ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'test' CHECK(billing_mode IN ('test','live'));
CREATE INDEX IF NOT EXISTS billing_orders_mode_idx ON public.billing_orders(owner_key,billing_mode,kind,created_at DESC);
COMMIT;
