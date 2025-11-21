import { supabase } from './supabase';

export const trendReportService = {
    /**
     * Request a trend report generation
     * Note: In a real app, this might trigger an edge function or just fetch pre-calculated data.
     * For now, we'll fetch the raw data that the report generator would use.
     */
    async generateReportData(publisherId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Fetch Audits
        const auditsPromise = supabase
            .from('site_audits')
            .select('*')
            .eq('publisher_id', publisherId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });

        // Fetch Alerts
        const alertsPromise = supabase
            .from('publisher_trend_alerts')
            .select('*')
            .eq('publisher_id', publisherId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

        const [auditsRes, alertsRes] = await Promise.all([auditsPromise, alertsPromise]);

        if (auditsRes.error) throw auditsRes.error;
        if (alertsRes.error) throw alertsRes.error;

        return {
            audits: auditsRes.data,
            alerts: alertsRes.data,
            period: {
                start: startDate.toISOString(),
                end: new Date().toISOString()
            }
        };
    }
};
