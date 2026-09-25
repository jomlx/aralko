-- 1. Create a storage bucket for uploaded materials
INSERT INTO storage.buckets (id, name, public) 
VALUES ('learning_materials', 'learning_materials', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create the unified Cache table
CREATE TABLE IF NOT EXISTS public.file_cache (
    file_hash TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    storage_path TEXT NOT NULL,
    flashcards_result JSONB,
    quiz_result JSONB,
    reviewer_result JSONB,
    test_result JSONB
);

-- 3. Create the Job Queue table
CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.job_type AS ENUM ('flashcards', 'quiz', 'reviewer', 'test');

CREATE TABLE IF NOT EXISTS public.job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_hash TEXT NOT NULL REFERENCES public.file_cache(file_hash) ON DELETE CASCADE,
    job_type public.job_type NOT NULL,
    status public.job_status DEFAULT 'pending'::public.job_status,
    personal_api_key TEXT, -- Optionally stored if the user provided one
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Secure the tables (RLS)
ALTER TABLE public.file_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for this prototype architecture
CREATE POLICY "Allow public read file_cache" ON public.file_cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert file_cache" ON public.file_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update file_cache" ON public.file_cache FOR UPDATE USING (true);

CREATE POLICY "Allow public read job_queue" ON public.job_queue FOR SELECT USING (true);
CREATE POLICY "Allow public insert job_queue" ON public.job_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update job_queue" ON public.job_queue FOR UPDATE USING (true);

-- 5. Function for Atomic Queue Processing (Worker picking up a job)
CREATE OR REPLACE FUNCTION public.claim_next_job(worker_id TEXT)
RETURNS SETOF public.job_queue AS $$
DECLARE
    next_job_id UUID;
BEGIN
    -- Select the oldest pending job and lock it
    SELECT id INTO next_job_id
    FROM public.job_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF next_job_id IS NOT NULL THEN
        -- Mark it as processing
        UPDATE public.job_queue
        SET status = 'processing', updated_at = NOW()
        WHERE id = next_job_id;
        
        -- Return the claimed job
        RETURN QUERY SELECT * FROM public.job_queue WHERE id = next_job_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
