import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FinalizationRequest {
  cronJobName: string;
  executionDate: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { cronJobName, executionDate }: FinalizationRequest = await req.json();
    const requestId = crypto.randomUUID();

    console.log(`[${requestId}] Finalizing cron execution for ${cronJobName} on ${executionDate}`);

    const { data: progressRecords, error: progressError } = await supabase
      .from('cron_execution_progress')
      .select('*')
      .eq('cron_job_name', cronJobName)
      .eq('execution_date', executionDate);

    if (progressError) {
      throw new Error(`Failed to fetch progress records: ${progressError.message}`);
    }

    const totalPublishers = progressRecords?.length || 0;
    const completedPublishers = progressRecords?.filter(p => p.status === 'completed').length || 0;
    const failedPublishers = progressRecords?.filter(p => p.status === 'failed').length || 0;
    const processingPublishers = progressRecords?.filter(p => p.status === 'processing').length || 0;

    const totalSitesAudited = (progressRecords || []).reduce((sum, p) => sum + (p.sites_audited || 0), 0);
    const totalBatches = completedPublishers + failedPublishers;

    const startTime = (progressRecords || []).reduce((min, p) => {
      if (!p.started_at) return min;
      return min ? Math.min(new Date(min).getTime(), new Date(p.started_at).getTime()) : new Date(p.started_at).getTime();
    }, null);

    const endTime = new Date().getTime();
    const durationSeconds = startTime ? Math.round((endTime - new Date(startTime).getTime()) / 1000) : 0;

    const summaryJson = {
      cronJobName,
      executionDate,
      completedPublishers,
      failedPublishers,
      processingPublishers,
      totalPublishers,
      totalSitesAudited,
      totalBatches,
      durationSeconds,
      finalized_at: new Date().toISOString(),
      details: progressRecords?.map(p => ({
        publisher_id: p.publisher_id,
        sites_audited: p.sites_audited,
        status: p.status,
        error: p.error_message,
      })),
    };

    const { error: updateError } = await supabase
      .from('cron_execution_logs')
      .update({
        total_publishers: totalPublishers,
        total_sites_processed: totalSitesAudited,
        successful_batches: completedPublishers,
        failed_batches: failedPublishers,
        duration_seconds: durationSeconds,
        summary_json: summaryJson,
      })
      .eq('cron_job_name', cronJobName)
      .eq('execution_date', executionDate);

    if (updateError) {
      throw new Error(`Failed to update log: ${updateError.message}`);
    }

    console.log(`[${requestId}] Finalization complete: ${completedPublishers}/${totalPublishers} publishers completed, ${totalSitesAudited} sites audited in ${durationSeconds}s`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cron execution finalized',
        summary: {
          totalPublishers,
          completedPublishers,
          failedPublishers,
          processingPublishers,
          totalSitesAudited,
          durationSeconds,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error finalizing cron execution:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to finalize cron execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
