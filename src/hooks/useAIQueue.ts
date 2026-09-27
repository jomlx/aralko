import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type JobType = 'flashcards' | 'quiz' | 'reviewer' | 'test';

export function useAIQueue() {
  const [jobStatus, setJobStatus] = useState<Record<string, 'pending'|'processing'|'completed'|'failed'>>({});
  const [jobErrors, setJobErrors] = useState<Record<string, string>>({});

  // Reset stuck jobs defensively on mount (this replaces a true pg_cron for simplicity without backend access)
  useEffect(() => {
    supabase.rpc('reset_stuck_ai_jobs').then(({ error }) => {
      if (error) console.warn(error);
    });
  }, []);

  const enqueueJob = useCallback(async (activityId: number, jobType: JobType, inputData: any = {}) => {
    const tempJobId = `${activityId}-${jobType}`;
    setJobStatus(prev => ({ ...prev, [tempJobId]: 'pending' }));
    setJobErrors(prev => ({ ...prev, [tempJobId]: '' }));

    try {
      // 1. Check if a job already exists that is pending or processing
      const { data: existingJobs, error: checkError } = await supabase
        .from('ai_jobs')
        .select('*')
        .eq('activity_id', activityId)
        .eq('job_type', jobType)
        .in('status', ['pending', 'processing']);

      if (checkError) {
        if (checkError.code === 'PGRST205' || checkError.code === '42P01') {
           throw new Error("The 'ai_jobs' table does not exist in your Supabase database. Please run the phase4_ai_jobs.sql script in your Supabase SQL editor.");
        }
      }

      if (existingJobs && existingJobs.length > 0) {
        // Wait for the existing job instead of creating a duplicate
        const job = existingJobs[0];
        return waitForJob(job.id, tempJobId);
      }

      // 2. Insert new job
      const { data: newJob, error: insertError } = await supabase
        .from('ai_jobs')
        .insert({
          activity_id: activityId,
          job_type: jobType,
          input_data: inputData
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === 'PGRST205' || insertError.code === '42P01') {
           throw new Error("The 'ai_jobs' table does not exist in your Supabase database. Please run the phase4_ai_jobs.sql script in your Supabase SQL editor.");
        }
        throw insertError;
      }

      // 3. Trigger worker
      supabase.functions.invoke('process-ai-jobs').catch(e => console.warn('Worker invoke failed (might already be running):', e));

      // 4. Wait for completion
      return waitForJob(newJob.id, tempJobId);
    } catch (err: any) {
      setJobStatus(prev => ({ ...prev, [tempJobId]: 'failed' }));
      setJobErrors(prev => ({ ...prev, [tempJobId]: err.message }));
      throw err;
    }
  }, []);

  const waitForJob = (dbJobId: string, uiJobId: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      // Setup Realtime subscription
      const channel = supabase
        .channel(`job-${dbJobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'ai_jobs',
            filter: `id=eq.${dbJobId}`
          },
          (payload) => {
            const status = payload.new.status;
            setJobStatus(prev => ({ ...prev, [uiJobId]: status }));

            if (status === 'completed') {
              supabase.removeChannel(channel);
              resolve(payload.new.result_data);
            } else if (status === 'failed') {
              supabase.removeChannel(channel);
              setJobErrors(prev => ({ ...prev, [uiJobId]: payload.new.error_message || 'Unknown error' }));
              reject(new Error(payload.new.error_message || 'Job failed'));
            }
          }
        )
        .subscribe();

      // Check current status in case it finished before we subscribed
      supabase
        .from('ai_jobs')
        .select('*')
        .eq('id', dbJobId)
        .single()
        .then(({ data }) => {
          if (data) {
            setJobStatus(prev => ({ ...prev, [uiJobId]: data.status }));
            if (data.status === 'completed') {
              supabase.removeChannel(channel);
              resolve(data.result_data);
            } else if (data.status === 'failed') {
              supabase.removeChannel(channel);
              setJobErrors(prev => ({ ...prev, [uiJobId]: data.error_message || 'Unknown error' }));
              reject(new Error(data.error_message || 'Job failed'));
            }
          }
        });
    });
  };

  return {
    enqueueJob,
    jobStatus,
    jobErrors
  };
}
