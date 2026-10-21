BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_notifications (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_key text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('user.created','tokens.purchased','subscription.paid')),
 billing_mode text CHECK(billing_mode IN ('test','live')),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_notifications_recent_idx ON public.admin_notifications(created_at DESC);
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_notifications FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.notify_admin_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.admin_notifications(event_key,kind,payload)
 VALUES('user:'||NEW.id::text,'user.created',jsonb_build_object('user_id',NEW.id,'email',NEW.email))
 ON CONFLICT(event_key) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_admin_new_user() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS file_extract_admin_new_user ON auth.users;
CREATE TRIGGER file_extract_admin_new_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_user();
COMMIT;
