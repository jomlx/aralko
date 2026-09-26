-- Rate Limiter shared state (single row, ID=1 always)
CREATE TABLE IF NOT EXISTS public.rate_limit_state (
  id INT PRIMARY KEY DEFAULT 1,
  last_call_at TIMESTAMP WITH TIME ZONE DEFAULT ''1970-01-01 00:00:00+00''::timestamptz,
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.rate_limit_state (id, last_call_at)
  VALUES (1, ''1970-01-01 00:00:00+00'') ON CONFLICT DO NOTHING;

ALTER TABLE public.rate_limit_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Service role only" ON public.rate_limit_state;
END $$;
CREATE POLICY "Service role only" ON public.rate_limit_state USING (true);

-- Returns ms caller must sleep before calling AI; lock released before sleep/AI call
CREATE OR REPLACE FUNCTION public.acquire_rate_limit_slot(min_interval_ms INT DEFAULT 2000)
RETURNS INT AS $$
DECLARE
  last_ts TIMESTAMP WITH TIME ZONE;
  elapsed_ms BIGINT;
  wait_ms INT;
BEGIN
  SELECT last_call_at INTO last_ts FROM public.rate_limit_state WHERE id = 1 FOR UPDATE;
  elapsed_ms := EXTRACT(EPOCH FROM (now() - last_ts)) * 1000;
  wait_ms := GREATEST(0, min_interval_ms - elapsed_ms::INT);
  UPDATE public.rate_limit_state
    SET last_call_at = CASE
      WHEN elapsed_ms >= min_interval_ms THEN now()
      ELSE last_call_at + (min_interval_ms || '' milliseconds'')::INTERVAL
    END
    WHERE id = 1;
  RETURN wait_ms;
END;
$$ LANGUAGE plpgsql;
