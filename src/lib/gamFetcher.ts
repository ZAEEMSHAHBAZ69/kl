import { supabaseIntegration } from './supabaseClient';
import { logger } from './logger';

interface GAMReportData {
  publisherId: string;
  date: string;
  revenue: number;
  ecpm: number;
  ctr: number;
  fillRate: number;
  impressions: number;
  clicks: number;
  [key: string]: any;
}

class GAMFetcher {
  async fetchNewPublishersData(limit: number = 100) {
    try {
      logger.info('Fetching data for new publishers from report_historical');

      const { data: newPublishers, error: pubError } = await supabaseIntegration.client
        .from('publishers')
        .select('id')
        .is('metrics_updated_at', null)
        .limit(limit);

      if (pubError) throw pubError;

      const publisherIds = newPublishers?.map((p: any) => p.id) || [];

      if (publisherIds.length === 0) {
        logger.info('No new publishers found');
        return [];
      }

      const { data: historicalData, error: histError } = await supabaseIntegration.client
        .from('report_historical')
        .select('*')
        .in('publisher_id', publisherIds);

      if (histError) throw histError;

      logger.info(`Retrieved ${historicalData?.length || 0} records for new publishers`, {
        publisherCount: publisherIds.length,
      });

      return historicalData || [];
    } catch (error) {
      logger.error('Error fetching new publishers data', error as Error);
      throw error;
    }
  }

  async fetchExistingPublishersData(dateRange?: { start: string; end: string }) {
    try {
      logger.info('Fetching data for existing publishers from report_dimensional', { dateRange });

      const { data: existingPublishers, error: pubError } = await supabaseIntegration.client
        .from('publishers')
        .select('id')
        .not('metrics_updated_at', 'is', null)
        .limit(1000);

      if (pubError) throw pubError;

      const publisherIds = existingPublishers?.map((p: any) => p.id) || [];

      if (publisherIds.length === 0) {
        logger.info('No existing publishers found');
        return [];
      }

      let query = supabaseIntegration.client
        .from('reports_dimensional')
        .select('*')
        .in('publisher_id', publisherIds);

      if (dateRange) {
        query = query
          .gte('date', dateRange.start)
          .lte('date', dateRange.end);
      }

      const { data: dimensionalData, error: dimError } = await query;

      if (dimError) throw dimError;

      logger.info(`Retrieved ${dimensionalData?.length || 0} records for existing publishers`, {
        publisherCount: publisherIds.length,
      });

      return dimensionalData || [];
    } catch (error) {
      logger.error('Error fetching existing publishers data', error as Error);
      throw error;
    }
  }

  async processGAMData(data: GAMReportData[]) {
    try {
      logger.info('Processing GAM data', { recordCount: data.length });

      const aggregated: Record<string, GAMReportData> = {};

      for (const record of data) {
        const key = record.publisherId;
        if (!aggregated[key]) {
          aggregated[key] = { ...record };
        } else {
          aggregated[key].revenue += record.revenue || 0;
          aggregated[key].impressions += record.impressions || 0;
          aggregated[key].clicks += record.clicks || 0;
        }
      }

      return Object.values(aggregated);
    } catch (error) {
      logger.error('Error processing GAM data', error as Error);
      throw error;
    }
  }

  async updatePublisherMetrics(publisherId: string, metrics: Partial<GAMReportData>) {
    try {
      const { error } = await supabaseIntegration.update('publishers', publisherId, {
        last_revenue: metrics.revenue,
        last_ecpm: metrics.ecpm,
        last_ctr: metrics.ctr,
        last_fill_rate: metrics.fillRate,
        metrics_updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      logger.debug(`Updated metrics for publisher ${publisherId}`, { metrics });
    } catch (error) {
      logger.error(`Error updating metrics for publisher ${publisherId}`, error as Error);
      throw error;
    }
  }
}

export const gamFetcher = new GAMFetcher();
