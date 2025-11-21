import { supabase } from './supabase';

export interface Alert {
    id: string;
    publisherId: string;
    publisherName: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    status: 'active' | 'acknowledged' | 'resolved' | 'notified';
    createdAt: string;
    metadata?: any;
}

export const alertManagementService = {
    /**
     * Fetch active alerts
     */
    async getActiveAlerts(): Promise<Alert[]> {
        const { data, error } = await supabase
            .from('publisher_trend_alerts')
            .select(`
        *,
        publishers (name)
      `)
            .in('status', ['active', 'notified']) // Show both active and those that have sent notifications
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching alerts:', error);
            return [];
        }

        return data.map(item => ({
            id: item.id,
            publisherId: item.publisher_id,
            publisherName: item.publishers?.name || 'Unknown',
            type: item.alert_type,
            severity: item.severity,
            message: item.message,
            status: item.status,
            createdAt: item.created_at,
            metadata: item.metadata
        }));
    },

    /**
     * Acknowledge an alert
     * @param alertId 
     */
    async acknowledgeAlert(alertId: string) {
        const { error } = await supabase
            .from('publisher_trend_alerts')
            .update({ status: 'acknowledged' })
            .eq('id', alertId);

        if (error) throw error;
    },

    /**
     * Resolve an alert
     * @param alertId 
     */
    async resolveAlert(alertId: string) {
        const { error } = await supabase
            .from('publisher_trend_alerts')
            .update({ status: 'resolved' })
            .eq('id', alertId);

        if (error) throw error;
    }
};
