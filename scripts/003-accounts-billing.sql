-- Preparação de contas, envio em partes e pagamentos. Não ativa cobrança.
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS owner_key text;
CREATE INDEX IF NOT EXISTS uploads_owner_idx ON public.uploads(owner_key);
CREATE TABLE IF NOT EXISTS public.extraction_accounts (
 owner_key text PRIMARY KEY,
 claimed_by text,
 free_used boolean NOT NULL DEFAULT false,
 token_balance integer NOT NULL DEFAULT 0 CHECK(token_balance >= 0),
 stripe_customer_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.upload_sessions (
 id uuid PRIMARY KEY,
 owner_key text NOT NULL,
 filename text NOT NULL,
 custom_name text,
 file_size integer NOT NULL CHECK(file_size > 0 AND file_size <= 52428800),
 chunk_count integer NOT NULL CHECK(chunk_count BETWEEN 1 AND 17),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','completed','error')),
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour'
);
CREATE INDEX IF NOT EXISTS upload_sessions_expiry_idx ON public.upload_sessions(expires_at);
CREATE TABLE IF NOT EXISTS public.upload_chunks (
 session_id uuid NOT NULL REFERENCES public.upload_sessions(id) ON DELETE CASCADE,
 part integer NOT NULL CHECK(part >= 0),
 contents bytea NOT NULL CHECK(octet_length(contents) <= 3145728),
 PRIMARY KEY(session_id,part)
);
CREATE TABLE IF NOT EXISTS public.extraction_charges (
 id uuid PRIMARY KEY,
 owner_key text NOT NULL REFERENCES public.extraction_accounts(owner_key),
 source text NOT NULL CHECK(source IN ('free','tokens')),
 amount integer NOT NULL CHECK(amount >= 0),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','completed','refunded')),
 upload_id integer REFERENCES public.uploads(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.billing_orders (
 id uuid PRIMARY KEY,
 owner_key text NOT NULL REFERENCES public.extraction_accounts(owner_key),
 kind text NOT NULL CHECK(kind IN ('tokens','subscription')),
 price_id text NOT NULL,
 tokens integer NOT NULL CHECK(tokens > 0),
 stripe_session_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.billing_grants (
 source_id text PRIMARY KEY,
 owner_key text NOT NULL REFERENCES public.extraction_accounts(owner_key),
 tokens integer NOT NULL CHECK(tokens > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.stripe_events (
 id text PRIMARY KEY,
 type text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.extraction_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.extraction_accounts, public.upload_sessions, public.upload_chunks, public.extraction_charges, public.billing_orders, public.billing_grants, public.stripe_events FROM anon, authenticated;

ALTER TABLE public.extraction_accounts ADD COLUMN IF NOT EXISTS claimed_by text;
CREATE INDEX IF NOT EXISTS extraction_charges_owner_idx ON public.extraction_charges(owner_key,state,created_at);
CREATE INDEX IF NOT EXISTS billing_orders_owner_idx ON public.billing_orders(owner_key,kind,created_at DESC);
CREATE INDEX IF NOT EXISTS upload_sessions_owner_idx ON public.upload_sessions(owner_key,state);
