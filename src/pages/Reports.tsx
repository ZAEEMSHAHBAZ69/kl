import { useState, useEffect } from 'react';
import { Download, RefreshCw, BarChart2, Globe, Smartphone, Wifi, Monitor, X } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import DateRangePicker from '../components/DateRangePicker';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotification } from '../components/NotificationContainer';
import { formatCurrency, getExchangeRate } from '../lib/currencyService';
import { ReportRefreshService } from '../lib/reportRefreshService';

interface MetricCardProps {
  title: string;
  value: string;
  color?: string;
}

function MetricCard({ title, value, color = 'text-[#48a77f]' }: MetricCardProps) {
  return (
    <div className="bg-[#161616] rounded-lg p-6 border border-[#2C2C2C]">
      <p className="text-gray-400 text-sm mb-2">{title}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

interface ReportDimension {
  id: string;
  name: string;
  icon: any;
}

interface MCMParent {
  id: string;
  name: string;
}

interface Partner {
  id: string;
  name: string;
}

interface Publisher {
  id: string;
  name: string;
  partner_id: string | null;
  mcm_parent_id: string | null;
  currency_code?: string;
}

export default function Reports() {
  const { appUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [dateRange, setDateRange] = useState({ start: today, end: today });
  const [selectedParentNetwork, setSelectedParentNetwork] = useState('all');
  const [selectedPartner, setSelectedPartner] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [activeDimension, setActiveDimension] = useState('overview');
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [mcmParents, setMcmParents] = useState<MCMParent[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [publisherCurrencies, setPublisherCurrencies] = useState<Map<string, string>>(new Map());

  const dimensions: ReportDimension[] = [
    { id: 'overview', name: 'Overview', icon: BarChart2 },
    { id: 'site_name', name: 'Site', icon: Globe },
    { id: 'country_name', name: 'Country', icon: Globe },
    { id: 'device_category_name', name: 'Device Category', icon: Monitor },
    { id: 'browser_name', name: 'Browser', icon: Monitor },
    { id: 'operating_system_name', name: 'Operating System', icon: Monitor },
    { id: 'mobile_app_name', name: 'Traffic Source', icon: Smartphone },
    { id: 'carrier_name', name: 'Carrier', icon: Wifi },
  ];

  const handleDimensionToggle = (dimensionId: string) => {
    if (dimensionId === 'overview') {
      setActiveDimension('overview');
      setSelectedDimensions([]);
      return;
    }

    setActiveDimension('multi');
    setSelectedDimensions(prev => {
      if (prev.includes(dimensionId)) {
        const updated = prev.filter(d => d !== dimensionId);
        if (updated.length === 0) {
          setActiveDimension('overview');
        }
        return updated;
      } else {
        return [...prev, dimensionId];
      }
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [mcmResponse, partnersResponse, publishersResponse] = await Promise.all([
          supabase.from('mcm_parents').select('id, name').order('name'),
          supabase.from('app_users').select('id, name, full_name, company_name, email').eq('role', 'partner').order('full_name'),
          supabase.from('publishers').select('id, name, partner_id, mcm_parent_id, currency_code').order('name')
        ]);

        if (mcmResponse.data) {
          setMcmParents(mcmResponse.data);
        }

        if (partnersResponse.data) {
          const mappedPartners = partnersResponse.data.map(p => ({
            id: p.id,
            name: p.name || p.full_name || p.company_name || p.email
          }));
          setPartners(mappedPartners);
        }

        if (publishersResponse.data) {
          setPublishers(publishersResponse.data);
          const currencyMap = new Map<string, string>();
          publishersResponse.data.forEach(pub => {
            currencyMap.set(pub.id, pub.currency_code || 'USD');
          });
          setPublisherCurrencies(currencyMap);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchReportData();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [dateRange, selectedParentNetwork, selectedPartner, selectedAccount, activeDimension, selectedDimensions]);

  const fetchReportData = async () => {
    try {
      setMetricsLoading(true);

      const isMultiDimensional = activeDimension === 'multi' && selectedDimensions.length > 0;
      const tableName = (activeDimension === 'overview' || !isMultiDimensional) && selectedDimensions.length === 0
        ? 'reports_daily'
        : 'reports_dimensional';

      const startDate = new Date(dateRange.start.getTime() - (dateRange.start.getTimezoneOffset() * 60000))
        .toISOString().split('T')[0];
      const endDate = new Date(dateRange.end.getTime() - (dateRange.end.getTimezoneOffset() * 60000))
        .toISOString().split('T')[0];

      const todayDate = new Date().toISOString().split('T')[0];

      console.log('Fetching report data:', { tableName, activeDimension, selectedDimensions, startDate, endDate, todayDate });

      let query = supabase
        .from(tableName)
        .select(`
          *,
          publishers (
            id,
            name,
            domain,
            partner_id,
            mcm_parent_id,
            currency_code
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching report data:', error);
        return;
      }

      console.log(`Fetched ${data?.length || 0} records from ${tableName}`);

      if (!data || data.length === 0) {
        setReportData([]);
        return;
      }

      if (isMultiDimensional) {
        const multiDimData = processMultiDimensionalData(data);
        setReportData(multiDimData);
      } else {
        const singleDimData = processSingleDimensionData(data);
        setReportData(singleDimData);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setMetricsLoading(false);
    }
  };

  const processMultiDimensionalData = (data: any[]) => {
    const groupedData = new Map<string, any>();

    data.forEach((report: any) => {
      const publisher = report.publishers;
      if (!publisher) return;

      if (selectedParentNetwork !== 'all' && publisher.mcm_parent_id !== selectedParentNetwork) return;
      if (isPartnerUser && publisher.partner_id !== currentPartnerUserId) return;
      if (!isPartnerUser && selectedPartner !== 'all' && publisher.partner_id !== selectedPartner) return;
      if (selectedAccount !== 'all' && publisher.id !== selectedAccount) return;

      const dimensionValues: string[] = [];
      const dimensionData: Record<string, string> = {};

      selectedDimensions.forEach(dimId => {
        const value = report[dimId] || 'N/A';
        const cleanValue = (value === 'Unknown' || value === '(Not applicable)' || value === '(unknown)') ? 'N/A' : value;
        dimensionValues.push(cleanValue);
        dimensionData[dimId] = cleanValue;
      });

      const groupKey = `${publisher.id}_${dimensionValues.join('_')}`;

      if (!groupedData.has(groupKey)) {
        groupedData.set(groupKey, {
          account: publisher.name || publisher.domain,
          publisherId: publisher.id,
          currencyCode: publisher.currency_code || 'USD',
          dimensionData,
          revenue: 0,
          impressions: 0,
          clicks: 0,
          adRequests: 0,
          viewability: 0,
          ecpm: 0,
          ctr: 0,
          count: 0,
        });
      }

      const group = groupedData.get(groupKey)!;
      group.revenue += parseFloat(report.revenue) || 0;
      group.impressions += parseInt(report.impressions) || 0;
      group.clicks += parseInt(report.clicks) || 0;
      group.adRequests += parseInt(report.ad_requests) || 0;
      group.viewability += parseFloat(report.viewability) || 0;
      group.ecpm += parseFloat(report.ecpm) || 0;
      group.ctr += parseFloat(report.ctr) || 0;
      group.count++;
    });

    return Array.from(groupedData.values()).map(item => ({
      ...item,
      ctr: item.count > 0 ? item.ctr / item.count : 0,
      ecpm: item.count > 0 ? item.ecpm / item.count : 0,
      viewability: item.count > 0 ? item.viewability / item.count : 0,
    }));
  };

  const processSingleDimensionData = (data: any[]) => {
    const groupedData = data.reduce((acc: any, report: any) => {
      const publisher = report.publishers;
      if (!publisher) return acc;

      if (selectedParentNetwork !== 'all' && publisher.mcm_parent_id !== selectedParentNetwork) return acc;
      if (isPartnerUser && publisher.partner_id !== currentPartnerUserId) return acc;
      if (!isPartnerUser && selectedPartner !== 'all' && publisher.partner_id !== selectedPartner) return acc;
      if (selectedAccount !== 'all' && publisher.id !== selectedAccount) return acc;

      const displayName = publisher.name || publisher.domain;
      const key = publisher.id;

      if (!acc[key]) {
        acc[key] = {
          account: displayName,
          publisherId: publisher.id,
          currencyCode: publisher.currency_code || 'USD',
          revenue: 0,
          impressions: 0,
          clicks: 0,
          adRequests: 0,
          ctr: 0,
          ecpm: 0,
          viewability: 0,
          count: 0,
        };
      }

      acc[key].revenue += parseFloat(report.revenue) || 0;
      acc[key].impressions += parseInt(report.impressions) || 0;
      acc[key].clicks += parseInt(report.clicks) || 0;
      acc[key].adRequests += parseInt(report.ad_requests) || 0;
      acc[key].viewability += parseFloat(report.viewability) || 0;
      acc[key].ecpm += parseFloat(report.ecpm) || 0;
      acc[key].ctr += parseFloat(report.ctr) || 0;
      acc[key].count++;

      return acc;
    }, {});

    return Object.values(groupedData).map((item: any) => ({
      ...item,
      ctr: item.count > 0 ? item.ctr / item.count : 0,
      ecpm: item.count > 0 ? item.ecpm / item.count : 0,
      viewability: item.count > 0 ? item.viewability / item.count : 0,
    }));
  };

  const isPartnerUser = appUser?.role === 'partner';
  const currentPartnerUserId = isPartnerUser ? appUser?.id : null;

  const parentNetworkOptions = [
    { value: 'all', label: 'All Parent Networks' },
    ...mcmParents.map(parent => ({ value: parent.id, label: parent.name }))
  ];

  const partnerOptions = [
    { value: 'all', label: 'All Partners' },
    ...partners.map(partner => ({ value: partner.id, label: partner.name }))
  ];

  const filteredPublishers = publishers.filter(pub => {
    if (selectedParentNetwork !== 'all' && pub.mcm_parent_id !== selectedParentNetwork) {
      return false;
    }

    if (isPartnerUser && pub.partner_id !== currentPartnerUserId) {
      return false;
    }

    if (!isPartnerUser && selectedPartner !== 'all' && pub.partner_id !== selectedPartner) {
      return false;
    }

    return true;
  });

  const accountOptions = [
    { value: 'all', label: 'All Accounts' },
    ...filteredPublishers.map(pub => ({ value: pub.id, label: pub.name }))
  ];

  const calculateMetrics = async () => {
    if (reportData.length === 0) {
      return {
        totalRevenue: '$0.00',
        totalImpressions: '0',
        totalClicks: '0',
        totalAdRequests: '0',
        avgEcpm: '$0.00',
      };
    }

    const totals = {
      impressions: 0,
      clicks: 0,
      adRequests: 0,
    };

    reportData.forEach(row => {
      totals.impressions += row.impressions || 0;
      totals.clicks += row.clicks || 0;
      totals.adRequests += row.adRequests || 0;
    });

    let totalRevenueUSD = 0;

    try {
      // Convert each row's revenue to USD
      for (const row of reportData) {
        const currency = row.currencyCode || 'USD';
        const rate = await getExchangeRate(currency);
        totalRevenueUSD += (row.revenue || 0) * rate;
      }
    } catch (error) {
      console.error('Error converting currencies:', error);
      totalRevenueUSD = reportData.reduce((sum, row) => sum + (row.revenue || 0), 0);
    }

    const avgEcpmUSD = totals.impressions > 0 ? (totalRevenueUSD / totals.impressions) * 1000 : 0;

    return {
      totalRevenue: formatCurrency(totalRevenueUSD, 'USD'),
      totalImpressions: totals.impressions.toLocaleString(),
      totalClicks: totals.clicks.toLocaleString(),
      totalAdRequests: totals.adRequests.toLocaleString(),
      avgEcpm: formatCurrency(avgEcpmUSD, 'USD'),
    };
  };

  const [metrics, setMetrics] = useState({
    totalRevenue: '$0.00',
    totalImpressions: '0',
    totalClicks: '0',
    totalAdRequests: '0',
    avgEcpm: '$0.00',
  });

  useEffect(() => {
    const updateMetrics = async () => {
      const calculatedMetrics = await calculateMetrics();
      setMetrics(calculatedMetrics);
    };
    updateMetrics();
  }, [reportData, selectedAccount]);

  const { totalRevenue, totalImpressions, totalClicks, totalAdRequests, avgEcpm } = metrics;

  const currencies = new Set(reportData.map(row => row.currencyCode || 'USD'));
  const isMultiCurrency = currencies.size > 1;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      showInfo('Refreshing', 'Triggering GAM report worker to fetch latest data for all publishers...');

      const result = await ReportRefreshService.triggerReportRefresh();

      if (result.success) {
        showSuccess('Report Refresh Started', 'GAM report worker has been triggered. Data will be updated shortly.');

        setTimeout(() => {
          fetchReportData();
        }, 3000);
      } else {
        showError('Refresh Failed', result.error || 'Failed to trigger report refresh.');
      }
    } catch (error) {
      console.error('Error triggering report update:', error);
      showError('Update Error', 'Error triggering report update. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    console.log('Exporting CSV...');
  };

  const handleApplyFilters = () => {
    // TODO: Implement filter logic
    console.log('Applying filters...');
  };

  return (
    <div className="space-y-6">
      {/* Data Freshness Alert */}
      <div className="bg-gradient-to-r from-[#48a77f]/10 via-[#48a77f]/5 to-transparent border-l-4 border-[#48a77f] rounded-lg p-4 mb-4">
        <div className="flex items-start space-x-3">
          <RefreshCw className="w-5 h-5 text-[#48a77f] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Data Freshness Notice</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Today's data reflects metrics from approximately <span className="font-semibold text-[#48a77f]">6 hours ago</span>.
              Historical data is updated daily. Use the <span className="font-semibold text-[#48a77f]">Refresh button</span> below
              to fetch the latest metrics right now.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Detailed Reports</h1>
          <p className="text-gray-400">Analyze performance metrics and trends</p>
        </div>
        <div className="flex items-center space-x-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 bg-[#161616] hover:bg-[#2C2C2C] text-white px-4 py-2 rounded-lg transition-colors border border-[#2C2C2C]"
          >
            <Download className="w-5 h-5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-[#161616] rounded-lg p-6 border border-[#2C2C2C]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white mb-2">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Filter by Parent Network
            </label>
            <CustomSelect
              options={parentNetworkOptions}
              value={selectedParentNetwork}
              onChange={setSelectedParentNetwork}
              placeholder="All Parent Networks"
            />
          </div>

          {!isPartnerUser && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Filter by Partner
              </label>
              <CustomSelect
                options={partnerOptions}
                value={selectedPartner}
                onChange={setSelectedPartner}
                placeholder="All Partners"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Filter by Account
            </label>
            <CustomSelect
              options={accountOptions}
              value={selectedAccount}
              onChange={setSelectedAccount}
              placeholder="All Accounts"
            />
          </div>
        </div>
      </div>

      {/* Report Dimensions */}
      <div className="bg-[#161616] rounded-lg p-6 border border-[#2C2C2C]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Report Dimensions</h2>
            <p className="text-sm text-gray-400">
              Select Overview for account-level data, or select multiple dimensions to analyze combinations (e.g., Country + Device + Carrier).
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-2 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {dimensions.map((dimension) => {
            const isOverview = dimension.id === 'overview';
            const isSelected = isOverview
              ? activeDimension === 'overview'
              : selectedDimensions.includes(dimension.id);

            return (
              <button
                key={dimension.id}
                onClick={() => handleDimensionToggle(dimension.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors border ${isSelected
                    ? 'bg-[#48a77f] text-white border-[#48a77f]'
                    : 'bg-[#1E1E1E] text-gray-400 border-[#2C2C2C] hover:border-[#48a77f] hover:text-white'
                  }`}
              >
                <dimension.icon className="w-4 h-4" />
                <span className="text-sm">{dimension.name}</span>
                {!isOverview && isSelected && (
                  <X className="w-3 h-3 ml-1" />
                )}
              </button>
            );
          })}
        </div>

        {selectedDimensions.length > 0 && (
          <div className="mt-4 p-3 bg-[#1E1E1E] rounded-lg border border-[#2C2C2C]">
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-[#48a77f]">Multi-dimensional analysis active:</span>
              {' '}Showing combinations of {selectedDimensions.map(d => dimensions.find(dim => dim.id === d)?.name).join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {metricsLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-[#161616] rounded-lg p-6 border border-[#2C2C2C] animate-pulse">
                <div className="h-4 bg-[#2C2C2C] rounded w-2/3 mb-3"></div>
                <div className="h-9 bg-[#2C2C2C] rounded w-1/2"></div>
              </div>
            ))}
          </>
        ) : (
          <>
            <MetricCard title="Total Revenue" value={totalRevenue} />
            <MetricCard title="Total Ad Requests" value={totalAdRequests} />
            <MetricCard title="Total Impressions" value={totalImpressions} />
            <MetricCard title="Total Clicks" value={totalClicks} />
            <MetricCard title="Avg eCPM" value={avgEcpm} />
          </>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-[#161616] rounded-lg border border-[#2C2C2C] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2C2C2C]">
                <th className="text-left p-4 text-sm font-semibold text-gray-300">
                  <div className="flex items-center space-x-1">
                    <span>Account</span>
                    <span className="text-gray-500">↕</span>
                  </div>
                </th>
                <th className="text-right p-4 text-sm font-semibold text-gray-300">
                  <div className="flex items-center justify-end space-x-1">
                    <span>Revenue</span>
                    <span className="text-gray-500">↓</span>
                  </div>
                </th>
                <th className="text-right p-4 text-sm font-semibold text-gray-300">
                  <div className="flex items-center justify-end space-x-1">
                    <span>Ad Requests</span>
                    <span className="text-gray-500">↕</span>
                  </div>
                </th>
                <th className="text-right p-4 text-sm font-semibold text-gray-300">
                  <div className="flex items-center justify-end space-x-1">
                    <span>Impressions</span>
                    <span className="text-gray-500">↕</span>
                  </div>
                </th>
                <th className="text-right p-4 text-sm font-semibold text-gray-300">
                  <div className="flex items-center justify-end space-x-1">
                    <span>eCPM</span>
                    <span className="text-gray-500">↕</span>
                  </div>
                </th>
                <th className="text-right p-4 text-sm font-semibold text-gray-300">
                  <div className="flex items-center justify-end space-x-1">
                    <span>Clicks</span>
                    <span className="text-gray-500">↕</span>
                  </div>
                </th>
                <th className="text-right p-4 text-sm font-semibold text-gray-300">
                  <div className="flex items-center justify-end space-x-1">
                    <span>CTR</span>
                    <span className="text-gray-500">↕</span>
                  </div>
                </th>
                <th className="text-right p-4 text-sm font-semibold text-gray-300">
                  <div className="flex items-center justify-end space-x-1">
                    <span>Viewability</span>
                    <span className="text-gray-500">↕</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {metricsLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    Loading report data...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    No report data available for the selected date range and filters.
                  </td>
                </tr>
              ) : (
                <>
                  {reportData.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b border-[#2C2C2C] hover:bg-[#1E1E1E] transition-colors"
                    >
                      <td className="p-4 text-sm text-white">
                        <div className="space-y-1">
                          <div className="font-semibold text-[#48a77f]">{row.account}</div>
                          {row.dimensionData && (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(row.dimensionData).map(([dimId, value]: [string, any]) => {
                                const dimName = dimensions.find(d => d.id === dimId)?.name || dimId;
                                return (
                                  <span
                                    key={dimId}
                                    className="inline-flex items-center px-2 py-1 rounded bg-[#2C2C2C] text-xs text-gray-300"
                                  >
                                    <span className="text-gray-500">{dimName}:</span>
                                    <span className="ml-1 text-white">{value}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-white text-right">
                        {formatCurrency(row.revenue || 0, row.currencyCode || 'USD')}
                        {isMultiCurrency && row.currencyCode && (
                          <span className="ml-1 text-xs text-gray-400">{row.currencyCode}</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-white text-right">{(row.adRequests || 0).toLocaleString()}</td>
                      <td className="p-4 text-sm text-white text-right">{row.impressions.toLocaleString()}</td>
                      <td className="p-4 text-sm text-white text-right">
                        {formatCurrency(row.ecpm || 0, row.currencyCode || 'USD')}
                        {isMultiCurrency && row.currencyCode && (
                          <span className="ml-1 text-xs text-gray-400">{row.currencyCode}</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-white text-right">{row.clicks.toLocaleString()}</td>
                      <td className="p-4 text-sm text-white text-right">{row.ctr.toFixed(2)}%</td>
                      <td className="p-4 text-sm text-white text-right">{(row.viewability * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                  {reportData.length > 0 && (
                    <tr className="bg-[#1E1E1E] font-semibold">
                      <td className="p-4 text-sm text-white">Total</td>
                      <td className="p-4 text-sm text-[#48a77f] text-right">{totalRevenue}</td>
                      <td className="p-4 text-sm text-white text-right">{totalAdRequests}</td>
                      <td className="p-4 text-sm text-white text-right">{totalImpressions}</td>
                      <td className="p-4 text-sm text-white text-right">{avgEcpm}</td>
                      <td className="p-4 text-sm text-white text-right">{totalClicks}</td>
                      <td className="p-4 text-sm text-white text-right">
                        {reportData.reduce((sum, r) => sum + r.impressions, 0) > 0
                          ? ((reportData.reduce((sum, r) => sum + r.clicks, 0) / reportData.reduce((sum, r) => sum + r.impressions, 0)) * 100).toFixed(2)
                          : '0.00'}%
                      </td>
                      <td className="p-4 text-sm text-white text-right">
                        {reportData.length > 0
                          ? ((reportData.reduce((sum, r) => sum + r.viewability, 0) / reportData.length) * 100).toFixed(2)
                          : '0.00'}%
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center text-sm text-gray-500 py-4">
        {activeDimension === 'overview'
          ? 'Showing overview grouped by Account'
          : selectedDimensions.length > 1
            ? `Showing multi-dimensional analysis: ${selectedDimensions.map(d => dimensions.find(dim => dim.id === d)?.name).join(' + ')}`
            : 'Select dimensions to analyze'}
      </div>
    </div>
  );
}
