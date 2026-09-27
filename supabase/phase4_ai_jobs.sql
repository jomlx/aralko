-- Create Enum for job status
CREATE TYPE ai_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create Enum for job type
CREATE TYPE ai_job_type AS ENUM ('flashcards', 'quiz', 'reviewer', 'test');

-- Create the ai_jobs table
CREATE TABLE ai_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  activity_id bigint REFERENCES activities(id) ON DELETE CASCADE,
  job_type ai_job_type NOT NULL,
  status ai_job_status DEFAULT 'pending',
  input_data JSONB NOT NULL,
  result_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: We do not enable RLS strictly yet because the app currently relies on 'default-user' and anon access.
-- We will enable RLS, but if auth.uid() is null, we can check a custom claim or just fall back to letting anon read.
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- If auth is added later, this policy will work. Until then, we add a bypass for testing or anon.
CREATE POLICY "Users can access their own jobs" 
  ON ai_jobs FOR ALL 
  USING (true) WITH CHECK (true);

-- Grant privileges to anon and authenticated
GRANT ALL ON TABLE ai_jobs TO anon, authenticated;

-- Trigger to automatically update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION set_updated_at_ai_jobs()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_jobs_updated_at
BEFORE UPDATE ON ai_jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at_ai_jobs();

-- RPC for atomic claiming of jobs with concurrency control
CREATE OR REPLACE FUNCTION claim_next_ai_job(max_concurrent INTEGER)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  activity_id INTEGER,
  job_type ai_job_type,
  input_data JSONB
) AS $$
DECLARE
  current_processing INTEGER;
  job_record RECORD;
BEGIN
  -- Check current concurrency
  SELECT count(*) INTO current_processing 
  FROM ai_jobs 
  WHERE status = 'processing';
  
  IF current_processing >= max_concurrent THEN
    RETURN; -- Exceeds max concurrency, do not claim
  END IF;

  -- Atomically claim a pending job
  UPDATE ai_jobs
  SET status = 'processing', updated_at = NOW()
  WHERE ai_jobs.id = (
    SELECT j.id
    FROM ai_jobs j
    WHERE j.status = 'pending'
    ORDER BY j.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING ai_jobs.id, ai_jobs.user_id, ai_jobs.activity_id, ai_jobs.job_type, ai_jobs.input_data INTO job_record;

  IF job_record.id IS NOT NULL THEN
    id := job_record.id;
    user_id := job_record.user_id;
    activity_id := job_record.activity_id;
    job_type := job_record.job_type;
    input_data := job_record.input_data;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create an extension for network requests if needed, but since we are not fully configuring 
-- pg_net here (it requires project-specific setup), we'll rely on the frontend to trigger the worker
-- and the worker's internal self-triggering loop.
-- However, we can add a simple function to reset stuck jobs (e.g., stuck in 'processing' for > 5 mins)
CREATE OR REPLACE FUNCTION reset_stuck_ai_jobs()
RETURNS void AS $$
BEGIN
  UPDATE ai_jobs
  SET status = 'pending'
  WHERE status = 'processing' 
    AND updated_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;
