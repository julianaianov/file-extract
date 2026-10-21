BEGIN;
ALTER TABLE public.upload_sessions DROP CONSTRAINT IF EXISTS upload_sessions_file_size_check;
ALTER TABLE public.upload_sessions ADD CONSTRAINT upload_sessions_file_size_check CHECK(file_size > 0 AND file_size <= 262144000);
ALTER TABLE public.upload_sessions DROP CONSTRAINT IF EXISTS upload_sessions_chunk_count_check;
ALTER TABLE public.upload_sessions ADD CONSTRAINT upload_sessions_chunk_count_check CHECK(chunk_count BETWEEN 1 AND 84);
CREATE TABLE IF NOT EXISTS public.file_content_parts (
 path text NOT NULL REFERENCES public.file_contents(path) ON DELETE CASCADE,
 part integer NOT NULL CHECK(part >= 0),
 contents bytea NOT NULL CHECK(octet_length(contents) <= 3145728),
 PRIMARY KEY(path,part)
);
ALTER TABLE public.file_content_parts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.file_content_parts FROM anon, authenticated;
COMMIT;
