BEGIN;
-- Existing notices stay in the panel; only future notices enter the email queue.
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS email_pending boolean NOT NULL DEFAULT false;
ALTER TABLE public.admin_notifications ALTER COLUMN email_pending SET DEFAULT true;
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS email_attempts integer NOT NULL DEFAULT 0 CHECK(email_attempts >= 0);
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS email_available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS email_lease_until timestamptz;
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS email_error text;
CREATE INDEX IF NOT EXISTS admin_notification_email_queue_idx ON public.admin_notifications(email_available_at) WHERE email_pending AND email_sent_at IS NULL;
COMMIT;
