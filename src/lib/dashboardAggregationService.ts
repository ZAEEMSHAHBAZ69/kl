import { supabase } from './supabase';

export interface DashboardTrendData {
    date: string;
    riskScore: number;
    technicalHealth: number;
    adDensity: number;
}

export interface PublisherRiskProfile {
    publisherId: string;
    name: string;
    currentRiskScore: number;
    riskTrend: 'increasing' | 'decreasing' | 'stable';
    lastAuditDate: string;
}

export const dashboardAggregationService = {
    /**
     * Fetch historical trend data for a specific publisher
     * @param publisherId 
     * @param days 
     */
    async getPublisherTrends(publisherId: string, days: number = 30): Promise<DashboardTrendData[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await supabase
            .from('site_audits')
            .select('created_at, risk_score, technical_health_score, ad_density')
            .eq('publisher_id', publisherId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching publisher trends:', error);
            return [];
        }

        return data.map(item => ({
            date: item.created_at,
            riskScore: item.risk_score || 0,
            technicalHealth: item.technical_health_score || 0,
            adDensity: item.ad_density || 0
        }));
    },

    /**
     * Get a high-level risk profile for all publishers
     */
    async getAllPublisherRiskProfiles(): Promise<PublisherRiskProfile[]> {
        // This would ideally be a materialized view or a more complex query
        // For now, we fetch the latest audit for each publisher
        const { data, error } = await supabase
            .from('site_audits')
            .select(`
        publisher_id,
        risk_score,
        created_at,
        publishers (name)
      `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching risk profiles:', error);
            return [];
        }

        // Group by publisher and take the latest
        const latestAudits = new Map<string, any>();
        data.forEach(audit => {
            if (!latestAudits.has(audit.publisher_id)) {
                latestAudits.set(audit.publisher_id, audit);
            }
        });

        return Array.from(latestAudits.values()).map(audit => ({
            publisherId: audit.publisher_id,
            name: audit.publishers?.name || 'Unknown Publisher',
            currentRiskScore: audit.risk_score || 0,
            riskTrend: 'stable', // Placeholder - would need historical comparison
            lastAuditDate: audit.created_at
        }));
    },

    /**
     * Get recent cross-module comparison results
     */
    async getRecentComparisons(limit: number = 10) {
        const { data, error } = await supabase
            .from('module_comparison_results')
            .select(`
        *,
        publishers (name)
      `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching comparisons:', error);
            return [];
        }

        return data;
    }
};
