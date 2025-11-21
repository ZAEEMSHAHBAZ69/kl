/* warehouse-style GAM report worker
   - uses @supabase/supabase-js client
   - upserts into reports_daily (summary) and reports_dimensional (warehouse row-per-record)
*/

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { JWT } from 'google-auth-library';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GAM_SERVICE_ACCOUNT_JSON = process.env.GAM_SERVICE_ACCOUNT_JSON;

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || '2000', 10);
const PUBLISHER_DELAY_MS = parseInt(process.env.PUBLISHER_DELAY_MS || '100', 10);
const RETRY_ATTEMPTS = parseInt(process.env.RETRY_ATTEMPTS || '3', 10);
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '1000', 10);
const RUN_INTERVAL_MS = parseInt(process.env.RUN_INTERVAL_MS || String(150 * 60 * 1000), 10);

const GAM_API_VERSION = 'v202508';
const GAM_REPORT_SERVICE_URL = `https://ads.google.com/apis/ads/publisher/${GAM_API_VERSION}/ReportService`;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GAM_SERVICE_ACCOUNT_JSON) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
console.log('✅ Supabase client initialized');

function createGAMClient() {
  try {
    const credentials = JSON.parse(GAM_SERVICE_ACCOUNT_JSON);

    let privateKey = credentials.private_key;
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const jwtClient = new JWT({
      email: credentials.client_email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/dfp'],
    });

    console.log('✅ GAM JWT client created');
    return jwtClient;
  } catch (error) {
    console.error('❌ Failed to create GAM client:', error.message);
    throw error;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function createAlert(publisherId, publisherName, networkCode, errorMessage) {
  try {
    console.log(`🚨 Creating alert for publisher: ${publisherName}`);

    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .insert({
        publisher_id: publisherId,
        type: 'api_error',
        severity: 'high',
        title: 'GAM Report Fetch Failed',
        message: `GAM report fetch failed for ${publisherName} (Network: ${networkCode}): ${errorMessage}`,
        status: 'active',
        details: {
          error_type: 'report_fetch_failure',
          network_code: networkCode,
          publisher_name: publisherName,
          error_message: errorMessage,
        },
      })
      .select()
      .maybeSingle();

    if (alertError) {
      console.error(`❌ Failed to create alert for ${publisherName}:`, alertError.message);
      return;
    }

    console.log(`✅ Alert created with ID: ${alert.id}`);

    // Skip email for "No data returned from GAM report" errors
    if (errorMessage && errorMessage.includes('No data returned from GAM report')) {
      console.log(`⏭️ Skipping email for "No data returned from GAM report" error`);
      return;
    }

    const emailUrl = `${SUPABASE_URL}/functions/v1/send-alert-email`;
    try {
      const emailResponse = await axios.post(
        emailUrl,
        { alertId: alert.id },
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      console.log(`✅ Alert email sent for ${publisherName}`);
    } catch (emailError) {
      console.error(`❌ Failed to send alert email: ${emailError.message}`);
    }
  } catch (error) {
    console.error(`❌ Error in createAlert:`, error.message);
  }
}

async function checkServiceKeyStatus(publisherId) {
  try {
    const checkUrl = `${SUPABASE_URL}/functions/v1/check-service-key-status`;
    const response = await axios.post(
      checkUrl,
      { publisherId },
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    console.log(`✅ Service key status checked for publisher ${publisherId}`);
  } catch (error) {
    console.error(`❌ Error checking service key status:`, error.message);
  }
}

async function makeSoapRequest(accessToken, networkCode, soapBody) {
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <ns1:RequestHeader soapenv:actor="http://schemas.xmlsoap.org/soap/actor/next" soapenv:mustUnderstand="0" xmlns:ns1="https://www.google.com/apis/ads/publisher/${GAM_API_VERSION}">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>GAM Report Worker</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    ${soapBody}
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const response = await axios.post(GAM_REPORT_SERVICE_URL, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
        'Authorization': `Bearer ${accessToken}`,
      },
      timeout: 120000,
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      console.error('  ➤ SOAP Error Response:', String(error.response.data).substring(0, 1000));
    }
    throw error;
  }
}

function parseXmlResponse(xmlString) {
  const reportJobIdMatch = xmlString.match(/<id>(\d+)<\/id>/);

  const statusMatch = xmlString.match(/<reportJobStatus>(\w+)<\/reportJobStatus>/) ||
    xmlString.match(/<(?:[^:>\s]+:)?rval[^>]*>(\w+)<\/(?:[^:>\s]+:)?rval>/) ||
    xmlString.match(/<(?:[^:>\s]+:)?reportJobStatus[^>]*>(\w+)<\/(?:[^:>\s]+:)?reportJobStatus>/);

  const downloadUrlMatch = xmlString.match(/<(?:[^:>\s]+:)?url[^>]*>(https?:\/\/[^<]+)<\/(?:[^:>\s]+:)?url>/) ||
    xmlString.match(/<(?:[^:>\s]+:)?downloadUrl[^>]*>(https?:\/\/[^<]+)<\/(?:[^:>\s]+:)?downloadUrl>/) ||
    xmlString.match(/<(?:[^:>\s]+:)?rval[^>]*>(https?:\/\/[^<]+)<\/(?:[^:>\s]+:)?rval>/);

  const altIdMatch = xmlString.match(/<(?:[^:>\s]+:)?id[^>]*>(\d+)<\/(?:[^:>\s]+:)?id>/);

  let downloadUrl = downloadUrlMatch ? downloadUrlMatch[1] : null;
  if (downloadUrl) {
    downloadUrl = downloadUrl
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  return {
    reportJobId: reportJobIdMatch ? reportJobIdMatch[1] : (altIdMatch ? altIdMatch[1] : null),
    status: statusMatch ? statusMatch[1] : null,
    downloadUrl,
  };
}

async function runReportJob(accessToken, networkCode, startDate, endDate = null) {
  if (!endDate) {
    endDate = startDate;
  }

  const [startYear, startMonth, startDay] = startDate.split('-').map(p => parseInt(p, 10));
  const [endYear, endMonth, endDay] = endDate.split('-').map(p => parseInt(p, 10));

  const soapBody = `
    <ns1:runReportJob xmlns:ns1="https://www.google.com/apis/ads/publisher/${GAM_API_VERSION}">
      <ns1:reportJob>
        <ns1:reportQuery>
          <ns1:dimensions>DATE</ns1:dimensions>
          <ns1:dimensions>COUNTRY_NAME</ns1:dimensions>
          <ns1:dimensions>CARRIER_NAME</ns1:dimensions>
          <ns1:dimensions>DEVICE_CATEGORY_NAME</ns1:dimensions>
          <ns1:dimensions>SITE_NAME</ns1:dimensions>
          <ns1:dimensions>BROWSER_NAME</ns1:dimensions>
          <ns1:dimensions>BROWSER_ID</ns1:dimensions>
          <ns1:dimensions>MOBILE_APP_NAME</ns1:dimensions>
          <ns1:dimensions>DEVICE_CATEGORY_ID</ns1:dimensions>
          <ns1:dimensions>OPERATING_SYSTEM_NAME</ns1:dimensions>
          <ns1:dimensions>OPERATING_SYSTEM_VERSION_ID</ns1:dimensions>
          <ns1:dimensions>COUNTRY_CRITERIA_ID</ns1:dimensions>
          <ns1:columns>AD_EXCHANGE_TOTAL_REQUESTS</ns1:columns>
          <ns1:columns>AD_EXCHANGE_MATCH_RATE</ns1:columns>
          <ns1:columns>AD_EXCHANGE_LINE_ITEM_LEVEL_IMPRESSIONS</ns1:columns>
          <ns1:columns>AD_EXCHANGE_LINE_ITEM_LEVEL_CLICKS</ns1:columns>
          <ns1:columns>AD_EXCHANGE_LINE_ITEM_LEVEL_CTR</ns1:columns>
          <ns1:columns>AD_EXCHANGE_LINE_ITEM_LEVEL_REVENUE</ns1:columns>
          <ns1:columns>AD_EXCHANGE_LINE_ITEM_LEVEL_AVERAGE_ECPM</ns1:columns>
          <ns1:columns>AD_EXCHANGE_TOTAL_REQUEST_ECPM</ns1:columns>
          <ns1:columns>AD_EXCHANGE_MATCHED_REQUEST_ECPM</ns1:columns>
          <ns1:columns>AD_EXCHANGE_ACTIVE_VIEW_MEASURABLE_IMPRESSIONS</ns1:columns>
          <ns1:columns>AD_EXCHANGE_ACTIVE_VIEW_VIEWABLE_IMPRESSIONS</ns1:columns>
          <ns1:columns>AD_EXCHANGE_ACTIVE_VIEW_VIEWABLE_IMPRESSIONS_RATE</ns1:columns>
          <ns1:startDate>
            <ns1:year>${startYear}</ns1:year>
            <ns1:month>${startMonth}</ns1:month>
            <ns1:day>${startDay}</ns1:day>
          </ns1:startDate>
          <ns1:endDate>
            <ns1:year>${endYear}</ns1:year>
            <ns1:month>${endMonth}</ns1:month>
            <ns1:day>${endDay}</ns1:day>
          </ns1:endDate>
          <ns1:dateRangeType>CUSTOM_DATE</ns1:dateRangeType>
        </ns1:reportQuery>
      </ns1:reportJob>
    </ns1:runReportJob>`;

  const response = await makeSoapRequest(accessToken, networkCode, soapBody);
  const parsed = parseXmlResponse(response);

  if (!parsed.reportJobId) {
    throw new Error('Failed to extract report job ID from response');
  }

  return parsed.reportJobId;
}

async function getReportJobStatus(accessToken, networkCode, reportJobId) {
  const soapBody = `
    <ns1:getReportJobStatus xmlns:ns1="https://www.google.com/apis/ads/publisher/${GAM_API_VERSION}">
      <ns1:reportJobId>${reportJobId}</ns1:reportJobId>
    </ns1:getReportJobStatus>`;

  const response = await makeSoapRequest(accessToken, networkCode, soapBody);
  const parsed = parseXmlResponse(response);

  if (parsed.status === null) {
    console.error('  ➤ Failed to parse status from response. Full response:', String(response).substring(0, 1000));
    throw new Error('Failed to parse report job status from GAM API response');
  }

  return parsed.status;
}

async function getReportDownloadUrl(accessToken, networkCode, reportJobId) {
  const soapBody = `
    <ns1:getReportDownloadURL xmlns:ns1="https://www.google.com/apis/ads/publisher/${GAM_API_VERSION}">
      <ns1:reportJobId>${reportJobId}</ns1:reportJobId>
      <ns1:exportFormat>CSV_DUMP</ns1:exportFormat>
    </ns1:getReportDownloadURL>`;

  const response = await makeSoapRequest(accessToken, networkCode, soapBody);
  const parsed = parseXmlResponse(response);

  if (!parsed.downloadUrl) {
    throw new Error('Failed to extract download URL from response');
  }

  return parsed.downloadUrl;
}

async function downloadAndParseReport(downloadUrl) {
  const response = await axios.get(downloadUrl, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  const decompressed = await gunzip(Buffer.from(response.data));
  const csvContent = decompressed.toString('utf-8');

  // Parse CSV with memory-efficient settings for large files (100+ accounts)
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  console.log(`  ➤ Parsed ${records.length} CSV records`);

  return records;
}

/**
 * Convert raw CSV records into aggregated warehouse-style rows.
 *
 * Each CSV row -> one dimensional row (country_name, carrier_name, device_category_name,
 * site_name, browser_name, browser_id, mobile_app_name, operating_system_name, operating_system_version_id, country_criteria_id, metrics...)
 *
 * Then group by composite key and sum metrics to produce final rows to upsert.
 */
function aggregateRecordsToWarehouseRows(records, publisherId) {
  const normalizeValue = (value) => {
    if (value === undefined || value === null) return 'Unknown';
    const s = String(value).trim();
    if (s === '' || s === '(not set)' || s.toLowerCase() === 'null' || s === '(Not applicable)') return 'Unknown';
    return s;
  };

  let uniqueSiteNames = new Set();

  // Helper to parse integers/floats safely
  const parseIntSafe = (v) => {
    if (v === undefined || v === null) return 0;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return 0;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  };
  const parseFloatSafe = (v) => {
    if (v === undefined || v === null) return 0;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return 0;
    const n = parseFloat(s);
    return Number.isNaN(n) ? 0 : n;
  };

  const map = new Map();

  for (const record of records) {
    // Extract metrics — GAM returns revenue in micros
    const adRequests = parseIntSafe(record['Column.AD_EXCHANGE_TOTAL_REQUESTS']) || 0;

    const matchRate = parseFloatSafe(record['Column.AD_EXCHANGE_MATCH_RATE']) || 0;

    // Calculate matched requests from match rate and total requests
    const matchedRequests = adRequests > 0 ? Math.round((matchRate / 100) * adRequests) : 0;

    const impressions = parseIntSafe(record['Column.AD_EXCHANGE_LINE_ITEM_LEVEL_IMPRESSIONS']) || 0;

    const clicks = parseIntSafe(record['Column.AD_EXCHANGE_LINE_ITEM_LEVEL_CLICKS']) || 0;

    const ctrFromGam = parseFloatSafe(record['Column.AD_EXCHANGE_LINE_ITEM_LEVEL_CTR']) || 0;

    // GAM returns revenue in micros of the publisher's network currency (NOT converted to USD)
    // Each publisher's revenue will be in their GAM account's configured currency
    const revenueMicros = parseFloatSafe(record['Column.AD_EXCHANGE_LINE_ITEM_LEVEL_REVENUE']) || 0;
    const revenue = Math.round((revenueMicros / 1e6) * 1e6) / 1e6;

    // optional average eCPM column (sometimes provided)
    const avgEcpmRaw = parseFloatSafe(record['Column.AD_EXCHANGE_LINE_ITEM_LEVEL_AVERAGE_ECPM']) || 0;

    const adRequestEcpm = parseFloatSafe(record['Column.AD_EXCHANGE_TOTAL_REQUEST_ECPM']) || 0;

    const matchedRequestEcpm = parseFloatSafe(record['Column.AD_EXCHANGE_MATCHED_REQUEST_ECPM']) || 0;

    const measurableImpressions = parseIntSafe(record['Column.AD_EXCHANGE_ACTIVE_VIEW_MEASURABLE_IMPRESSIONS']) || 0;

    const viewableImpressions = parseIntSafe(record['Column.AD_EXCHANGE_ACTIVE_VIEW_VIEWABLE_IMPRESSIONS']) || 0;

    // Extract viewability (returned as percentage, e.g., 75.5 means 75.5%)
    const viewabilityRate = parseFloatSafe(record['Column.AD_EXCHANGE_ACTIVE_VIEW_VIEWABLE_IMPRESSIONS_RATE']) || 0;

    // Delivery rate is essentially the match rate for Ad Exchange
    const deliveryRate = matchRate;

    // Extract dimensions (normalize to consistent names) - use Dimension prefix
    const dateFromRow = normalizeValue(record['Dimension.DATE']);

    const countryName = normalizeValue(record['Dimension.COUNTRY_NAME']);
    const countryCriteriaId = parseIntSafe(record['Dimension.COUNTRY_CRITERIA_ID']);

    const carrierName = normalizeValue(record['Dimension.CARRIER_NAME']);

    const deviceCategoryName = normalizeValue(record['Dimension.DEVICE_CATEGORY_NAME']);
    const deviceCategoryId = parseIntSafe(record['Dimension.DEVICE_CATEGORY_ID']);

    const siteName = normalizeValue(record['Dimension.SITE_NAME']);
    uniqueSiteNames.add(siteName);
    const browserName = normalizeValue(record['Dimension.BROWSER_NAME']);
    const browserId = 0;

    const mobileAppName = normalizeValue(record['Dimension.MOBILE_APP_NAME']);

    const operatingSystemName = normalizeValue('Unknown');
    const operatingSystemVersionId = parseIntSafe(record['Dimension.OPERATING_SYSTEM_VERSION_ID']);

    // Compose composite key to aggregate rows that belong to the same dimensional combination:
    const key = [
      publisherId,
      dateFromRow,
      countryName,
      carrierName,
      deviceCategoryName,
      siteName,
      browserName,
      mobileAppName,
      operatingSystemName,
    ].join('|');

    if (!map.has(key)) {
      map.set(key, {
        publisher_id: publisherId,
        date: dateFromRow,
        country_name: countryName,
        country_criteria_id: countryCriteriaId || null,
        carrier_name: carrierName,
        device_category_name: deviceCategoryName,
        device_category_id: deviceCategoryId || null,
        site_name: siteName,
        browser_name: browserName,
        browser_id: browserId || null,
        mobile_app_name: mobileAppName,
        operating_system_name: operatingSystemName,
        operating_system_version_id: operatingSystemVersionId || null,
        ad_requests: 0,
        matched_requests: 0,
        match_rate: 0,
        impressions: 0,
        clicks: 0,
        revenue: 0,
        ecpm: 0,
        ctr: 0,
        ad_request_ecpm: 0,
        mcm_auto_payment_revenue: 0,
        net_revenue: 0,
        measurable_impressions: 0,
        viewable_impressions: 0,
        viewability: 0,
        delivery_rate: 0,
        total_viewability_weighted: 0,
        total_match_rate_weighted: 0,
        total_delivery_rate_weighted: 0,
        updated_at: new Date().toISOString(),
      });
    }

    const row = map.get(key);
    row.ad_requests += adRequests;
    row.matched_requests += matchedRequests;
    row.impressions += impressions;
    row.clicks += clicks;
    row.revenue += revenue;
    row.measurable_impressions += measurableImpressions;
    row.viewable_impressions += viewableImpressions;
    // Weight rates by impressions for proper averaging
    row.total_viewability_weighted += viewabilityRate * impressions;
    row.total_match_rate_weighted += matchRate * adRequests;
    row.total_delivery_rate_weighted += deliveryRate * adRequests;
  }

  // finalize computed fields
  const rows = [];
  for (const [, r] of map) {
    r.ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
    r.ecpm = r.impressions > 0 ? (r.revenue / r.impressions) * 1000 : 0;
    r.ad_request_ecpm = r.ad_requests > 0 ? (r.revenue / r.ad_requests) * 1000 : 0;
    r.net_revenue = r.revenue;
    r.mcm_auto_payment_revenue = 0;
    r.viewability = r.impressions > 0 ? r.total_viewability_weighted / r.impressions : 0;
    r.match_rate = r.ad_requests > 0 ? r.total_match_rate_weighted / r.ad_requests : 0;
    r.delivery_rate = r.ad_requests > 0 ? r.total_delivery_rate_weighted / r.ad_requests : 0;
    // Remove helper fields before saving
    delete r.total_viewability_weighted;
    delete r.total_match_rate_weighted;
    delete r.total_delivery_rate_weighted;
    rows.push(r);
  }
  map.clear();

  if (uniqueSiteNames.size > 0) {
    console.log(`  ➤ SITE_NAME extraction verified: ${uniqueSiteNames.size} unique sites captured`);
    const siteList = Array.from(uniqueSiteNames).slice(0, 5).join(', ');
    console.log(`  ➤ Sample sites: ${siteList}${uniqueSiteNames.size > 5 ? ', ...' : ''}`);
  }

  return rows;
}

async function getNetworkInfo(accessToken, networkCode) {
  try {
    const url = `https://admanager.googleapis.com/v1/networks/${networkCode}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    if (response.data && response.data.currencyCode) {
      return response.data.currencyCode;
    }
    return 'USD';
  } catch (error) {
    console.warn(`  ➤ Failed to fetch network info for ${networkCode}:`, error.message);
    return (error.response?.status === 403) ? 'USD' : 'USD';
  }
}

async function fetchGAMReport(authClient, networkCode, publisherId, publisherName, startDate = null, endDate = null) {
  try {
    if (!startDate) {
      startDate = getTodayDate();
    }
    if (!endDate) {
      endDate = startDate;
    }

    const dateRangeStr = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
    console.log(`📊 Fetching GAM report for: ${publisherName} (Network: ${networkCode}) - Date range: ${dateRangeStr}`);

    await authClient.authorize();
    const accessToken = await authClient.getAccessToken();

    if (!accessToken || !accessToken.token) {
      throw new Error('Failed to obtain access token');
    }

    const currencyCode = await getNetworkInfo(accessToken.token, networkCode);
    console.log(`  ➤ Network currency: ${currencyCode}`);

    console.log(`  ➤ Creating report job for ${dateRangeStr}...`);
    const reportJobId = await runReportJob(accessToken.token, networkCode, startDate, endDate);
    console.log(`  ➤ Report job created: ${reportJobId}`);

    console.log(`  ➤ Polling for report completion...`);
    let status = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 90;

    while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
      await delay(10000);
      attempts++;
      try {
        status = await getReportJobStatus(accessToken.token, networkCode, reportJobId);
        console.log(`  ➤ Status: ${status} (attempt ${attempts}/${maxAttempts})`);
      } catch (err) {
        console.warn(`  ➤ Polling error (attempt ${attempts}):`, err.message);
      }
    }

    if (status !== 'COMPLETED') {
      throw new Error(`Report job failed with status: ${status}`);
    }

    console.log(`  ➤ Downloading report...`);
    const downloadUrl = await getReportDownloadUrl(accessToken.token, networkCode, reportJobId);
    console.log(`  ➤ Report download URL: ${downloadUrl}`);

    console.log(`  ➤ Parsing report data...`);
    const records = await downloadAndParseReport(downloadUrl);

    if (!records || records.length === 0) {
      console.log('  ➤ No data returned from GAM report. Creating zero-value metrics...');

      // Create zero-value metrics for the date range
      const dates = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      const currencyCode = await getNetworkInfo(accessToken.token, networkCode);

      const dailyMetricsArray = dates.map(date => ({
        publisher_id: publisherId,
        date,
        ad_requests: 0,
        matched_requests: 0,
        match_rate: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        revenue: 0,
        ecpm: 0,
        ad_request_ecpm: 0,
        mcm_auto_payment_revenue: 0,
        net_revenue: 0,
        measurable_impressions: 0,
        viewable_impressions: 0,
        viewability: 0,
        delivery_rate: 0,
        currency_code: currencyCode,
      }));

      const reportData = {
        dailyMetrics: dailyMetricsArray,
        dimensionalRows: [],
        currencyCode,
        summary: {
          totalRevenue: 0,
          totalAdRequests: 0,
          totalImpressions: 0,
          dateCount: dailyMetricsArray.length,
        }
      };

      console.log(`✅ Zero-value metrics created for ${publisherName}: 0 revenue (${currencyCode}), ${dates.length} day(s)`);
      return reportData;
    }

    console.log(`  ➤ Aggregating ${records.length} records into warehouse rows...`);

    // Process records in chunks for large datasets to avoid memory issues
    const CHUNK_SIZE = 10000;
    let dimensionalRows = [];

    if (records.length > CHUNK_SIZE) {
      console.log(`  ➤ Processing in chunks of ${CHUNK_SIZE} for memory efficiency...`);
      const recordChunks = chunkArray(records, CHUNK_SIZE);

      for (let chunkIdx = 0; chunkIdx < recordChunks.length; chunkIdx++) {
        const chunk = recordChunks[chunkIdx];
        const chunkRows = aggregateRecordsToWarehouseRows(chunk, publisherId);
        dimensionalRows.push(...chunkRows);
        console.log(`  ➤ Processed chunk ${chunkIdx + 1}/${recordChunks.length} (${chunkRows.length} rows)`);

        // Clear chunk from memory
        recordChunks[chunkIdx] = null;
      }
    } else {
      dimensionalRows = aggregateRecordsToWarehouseRows(records, publisherId);
    }

    // Clear records array to free memory
    records.length = 0;

    // Group dimensional rows by date
    const rowsByDate = new Map();
    for (const row of dimensionalRows) {
      if (!rowsByDate.has(row.date)) {
        rowsByDate.set(row.date, []);
      }
      rowsByDate.get(row.date).push(row);
    }

    // Build daily metrics for each date
    const dailyMetricsArray = [];
    let totalRevenue = 0;
    let totalAdRequests = 0;
    let totalImpressions = 0;

    for (const [date, rows] of rowsByDate.entries()) {
      const totals = rows.reduce(
        (acc, r) => {
          acc.ad_requests += Number(r.ad_requests || 0);
          acc.matched_requests += Number(r.matched_requests || 0);
          acc.impressions += Number(r.impressions || 0);
          acc.clicks += Number(r.clicks || 0);
          acc.revenue += Number(r.revenue || 0);
          acc.measurable_impressions += Number(r.measurable_impressions || 0);
          acc.viewable_impressions += Number(r.viewable_impressions || 0);
          return acc;
        },
        {
          ad_requests: 0,
          matched_requests: 0,
          impressions: 0,
          clicks: 0,
          revenue: 0,
          measurable_impressions: 0,
          viewable_impressions: 0
        }
      );

      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const ecpm = totals.impressions > 0 ? (totals.revenue / totals.impressions) * 1000 : 0;
      const adRequestEcpm = totals.ad_requests > 0 ? (totals.revenue / totals.ad_requests) * 1000 : 0;
      const matchRate = totals.ad_requests > 0 ? (totals.matched_requests / totals.ad_requests) * 100 : 0;
      const netRevenue = totals.revenue;

      const totalViewabilityWeighted = rows.reduce(
        (sum, r) => sum + (r.viewability * r.impressions),
        0
      );
      const avgViewability = totals.impressions > 0 ? totalViewabilityWeighted / totals.impressions : 0;

      const totalDeliveryRateWeighted = rows.reduce(
        (sum, r) => sum + (r.delivery_rate * r.ad_requests),
        0
      );
      const avgDeliveryRate = totals.ad_requests > 0 ? totalDeliveryRateWeighted / totals.ad_requests : 0;

      dailyMetricsArray.push({
        publisher_id: publisherId,
        date,
        ad_requests: totals.ad_requests,
        matched_requests: totals.matched_requests,
        match_rate: matchRate,
        impressions: totals.impressions,
        clicks: totals.clicks,
        ctr,
        revenue: totals.revenue,
        ecpm,
        ad_request_ecpm: adRequestEcpm,
        mcm_auto_payment_revenue: 0,
        net_revenue: netRevenue,
        measurable_impressions: totals.measurable_impressions,
        viewable_impressions: totals.viewable_impressions,
        viewability: avgViewability,
        delivery_rate: avgDeliveryRate,
        currency_code: currencyCode,
      });

      totalRevenue += totals.revenue;
      totalAdRequests += totals.ad_requests;
      totalImpressions += totals.impressions;
    }

    const reportData = {
      dailyMetrics: dailyMetricsArray,
      dimensionalRows: dimensionalRows.map(row => ({ ...row, currency_code: currencyCode })),
      currencyCode,
      summary: {
        totalRevenue,
        totalAdRequests,
        totalImpressions,
        dateCount: dailyMetricsArray.length,
      }
    };

    console.log(
      `✅ Report generated for ${publisherName}: ${totalRevenue.toFixed(2)} revenue (${currencyCode}), ${totalAdRequests.toLocaleString()} ad requests, ${totalImpressions.toLocaleString()} impressions across ${dailyMetricsArray.length} day(s)`
    );

    return reportData;
  } catch (error) {
    console.error(`❌ Error fetching report for ${publisherName}:`, error.message);

    if (error.response) {
      console.error(`  ➤ HTTP Status: ${error.response.status}`);
      try {
        console.error(`  ➤ Response: ${JSON.stringify(error.response.data).substring(0, 500)}`);
      } catch (e) {
        console.error('  ➤ Response (non-json)');
      }

      if (error.response.status === 403) {
        await createAlert(publisherId, publisherName, networkCode, 'Permission denied - service account not authorized');
        await checkServiceKeyStatus(publisherId);
      }
    }

    await createAlert(publisherId, publisherName, networkCode, error.message);
    return null;
  }
}

async function fetchGAMReportWithRetry(authClient, networkCode, publisherId, publisherName, startDate = null, endDate = null, attempt = 1) {
  try {
    return await fetchGAMReport(authClient, networkCode, publisherId, publisherName, startDate, endDate);
  } catch (error) {
    if (attempt < RETRY_ATTEMPTS) {
      const backoffDelay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`🔄 Retrying (${attempt}/${RETRY_ATTEMPTS}) for ${publisherName} after ${backoffDelay}ms...`);
      await delay(backoffDelay);
      return await fetchGAMReportWithRetry(authClient, networkCode, publisherId, publisherName, startDate, endDate, attempt + 1);
    }

    console.error(`❌ Max retries reached for ${publisherName}`);
    return null;
  }
}

function deduplicateDimensionalRows(rows) {
  const keyMap = new Map();

  for (const row of rows) {
    const key = `${row.publisher_id}|${row.date}|${row.country_name}|${row.carrier_name}|${row.device_category_name}|${row.site_name}|${row.browser_name}|${row.mobile_app_name}|${row.operating_system_name}`;

    if (keyMap.has(key)) {
      const existing = keyMap.get(key);
      existing.revenue = (existing.revenue || 0) + (row.revenue || 0);
      existing.impressions = (existing.impressions || 0) + (row.impressions || 0);
      existing.clicks = (existing.clicks || 0) + (row.clicks || 0);
      existing.ad_requests = (existing.ad_requests || 0) + (row.ad_requests || 0);
      existing.viewable_impressions = (existing.viewable_impressions || 0) + (row.viewable_impressions || 0);
      existing.measurable_impressions = (existing.measurable_impressions || 0) + (row.measurable_impressions || 0);
    } else {
      keyMap.set(key, { ...row });
    }
  }

  return Array.from(keyMap.values());
}

/**
 * Save warehouse rows + daily metrics into Supabase
 * - upserts daily metrics to reports_daily
 * - upserts dimensional rows to reports_dimensional (composite unique constraint)
 * - upserts historical dimensional rows to reports_historical (for new publisher 2-month backfill)
 */
async function saveReportToSupabase(reportData, isHistorical = false) {
  if (!reportData) return;

  try {
    const publisherId = reportData.dailyMetrics[0]?.publisher_id;

    // Update publisher currency code if we have it
    if (reportData.currencyCode && publisherId) {
      const { error: publisherUpdateError } = await supabase
        .from('publishers')
        .update({ currency_code: reportData.currencyCode })
        .eq('id', publisherId);

      if (publisherUpdateError) {
        console.warn(`⚠️ Failed to update publisher currency: ${publisherUpdateError.message}`);
      } else {
        console.log(`  ➤ Updated publisher currency to ${reportData.currencyCode}`);
      }
    }

    // Save all daily metrics
    if (reportData.dailyMetrics && reportData.dailyMetrics.length > 0) {
      const dailyPayload = reportData.dailyMetrics.map(m => ({
        ...m,
        updated_at: new Date().toISOString(),
      }));

      const { error: metricsError } = await supabase
        .from('reports_daily')
        .upsert(dailyPayload, { onConflict: 'publisher_id,date' });

      if (metricsError) {
        console.error('❌ Error saving metrics:', metricsError.message);
      } else {
        console.log(`✅ Daily metrics saved: ${dailyPayload.length} day(s) for publisher ${publisherId}`);
      }
    }

    // Save dimensional rows - use report_historical for historical data, reports_dimensional for regular data
    if (reportData.dimensionalRows && reportData.dimensionalRows.length > 0) {
      const tableName = isHistorical ? 'report_historical' : 'reports_dimensional';
      const originalCount = reportData.dimensionalRows.length;
      const deduplicatedRows = deduplicateDimensionalRows(reportData.dimensionalRows);
      const deduplicatedCount = deduplicatedRows.length;

      if (deduplicatedCount < originalCount) {
        console.log(`  ➤ Deduplicated ${originalCount} rows to ${deduplicatedCount} rows (removed ${originalCount - deduplicatedCount} duplicates)`);
      }

      const chunks = chunkArray(deduplicatedRows, 1000);

      for (const chunk of chunks) {
        const payload = chunk.map(r => ({
          ...r,
          updated_at: new Date().toISOString(),
          ...(isHistorical ? { cleanup_scheduled_at: new Date().toISOString() } : {})
        }));

        const { error: dimensionalError } = await supabase.from(tableName).upsert(
          payload,
          {
            onConflict:
              'publisher_id,date,country_name,carrier_name,device_category_name,site_name,browser_name,mobile_app_name,operating_system_name',
          }
        );

        if (dimensionalError) {
          console.error(`❌ Error saving ${tableName} metrics chunk:`, dimensionalError.message);
        } else {
          console.log(`✅ ${isHistorical ? 'Historical' : 'Dimensional'} metrics saved to ${tableName}: ${payload.length} records`);
        }
      }
    }

    // Log fetch success for each date
    for (const dailyMetric of reportData.dailyMetrics) {
      const { error: logError } = await supabase.from('report_fetch_logs').insert({
        publisher_id: dailyMetric.publisher_id,
        fetch_date: dailyMetric.date,
        status: 'success',
        metrics_fetched: {
          revenue: dailyMetric.revenue,
          impressions: dailyMetric.impressions,
          clicks: dailyMetric.clicks,
        },
      });

      if (logError && logError.code !== '23505') {
        console.error(`❌ Failed to write fetch log for ${dailyMetric.date}:`, logError.message);
      }
    }
  } catch (error) {
    console.error('❌ Error in saveReportToSupabase:', error.message);
  }
}

async function processAllPublishers() {
  const startTime = new Date();
  console.log('\n' + '='.repeat(80));
  console.log(`🚀 STARTING REPORT FETCH JOB - ${startTime.toISOString()}`);
  console.log('='.repeat(80) + '\n');

  try {
    const authClient = createGAMClient();

    console.log('📋 Fetching publishers from Supabase...');
    const { data: publishers, error: fetchError } = await supabase
      .from('publishers')
      .select('id, name, network_code, service_key_status')
      .not('network_code', 'is', null)
      .neq('service_key_status', 'invalid');

    if (fetchError) {
      console.error('❌ Error fetching publishers:', fetchError.message);
      return;
    }

    if (!publishers || publishers.length === 0) {
      console.log('⚠️ No publishers found with valid network codes');
      return;
    }

    console.log(`✅ Found ${publishers.length} publishers to process`);

    const batches = chunkArray(publishers, BATCH_SIZE);
    console.log(`📦 Processing in ${batches.length} batch(es) of up to ${BATCH_SIZE} publishers\n`);

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalRevenue = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} publishers)`);
      console.log('─'.repeat(80) + '\n');

      for (let i = 0; i < batch.length; i++) {
        const publisher = batch[i];
        totalProcessed++;

        const reportData = await fetchGAMReportWithRetry(authClient, publisher.network_code, publisher.id, publisher.name);

        if (reportData) {
          await saveReportToSupabase(reportData);
          totalSuccessful++;
          totalRevenue += reportData.summary.totalRevenue || 0;
        } else {
          totalFailed++;
          const fetchDate = getTodayDate();
          const { error: logError } = await supabase.from('report_fetch_logs').insert({
            publisher_id: publisher.id,
            fetch_date: fetchDate,
            status: 'failed',
            error_message: 'Failed to fetch report data',
          });
          if (logError) console.error('❌ Failed to write failed fetch log:', logError.message);
        }

        if (i < batch.length - 1) {
          await delay(PUBLISHER_DELAY_MS);
        }
      }

      if (batchIndex < batches.length - 1) {
        console.log(`\n⏳ Waiting ${BATCH_DELAY_MS / 1000} seconds before next batch...\n`);
        await delay(BATCH_DELAY_MS);
      }
    }

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('📊 JOB SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Total processed: ${totalProcessed}`);
    console.log(`✅ Successful: ${totalSuccessful}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`💰 Total revenue: ${totalRevenue.toFixed(2)} (mixed currencies - each publisher in their GAM currency)`);
    console.log(`⏱️ Duration: ${duration} seconds`);
    console.log(`🕐 Completed at: ${endTime.toISOString()}`);
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Fatal error in processAllPublishers:', error.message);
    console.error(error.stack);
  }
}

// Internal scheduler removed - now triggered by Supabase Edge Function via pg_cron

function handleShutdown(signal) {
  console.log('\n' + '⚠'.repeat(80));
  console.log(`🛑 Received ${signal} - Initiating graceful shutdown...`);
  console.log('⚠'.repeat(80) + '\n');

  console.log('📝 Cleanup complete. Shutting down worker.');
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('❌ Reason:', reason);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    service: 'GAM Report Worker',
    status: 'running',
    version: 'warehouse-3.0.0',
    mode: 'API endpoints (triggered by Supabase Edge Functions)',
    implementation: 'SOAP API -> warehouse-style reports_dimensional + reports_historical',
    scheduler: {
      type: 'External (Supabase pg_cron -> Edge Function)',
      interval: 'Every 6 hours',
      target: 'All publishers',
      destination: 'reports_daily + reports_dimensional'
    },
    endpoints: {
      health: 'GET /health',
      fetchReports: 'POST /fetch-reports - Fetch reports for ALL publishers (triggered by scheduled edge function or manual refresh)',
      fetchHistorical: 'POST /fetch-historical-reports - NEW PUBLISHER ONLY: Fetch last 2 months (stored in reports_historical, auto-cleanup after 24h)'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

async function processSinglePublisher(publisherId, fetchLast2Months = false) {
  const startTime = new Date();
  console.log('\n' + '='.repeat(80));
  console.log(`🚀 STARTING SINGLE PUBLISHER REPORT FETCH - ${startTime.toISOString()}`);
  console.log(`📝 Publisher ID: ${publisherId}`);
  console.log(`📅 Fetch mode: ${fetchLast2Months ? 'Last 2 months (new publisher)' : 'Today only'}`);
  console.log('='.repeat(80) + '\n');

  try {
    const authClient = createGAMClient();

    console.log('📋 Fetching publisher from Supabase...');
    const { data: publisher, error: fetchError } = await supabase
      .from('publishers')
      .select('id, name, network_code, service_key_status')
      .eq('id', publisherId)
      .not('network_code', 'is', null)
      .neq('service_key_status', 'invalid')
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Error fetching publisher:', fetchError.message);
      return { success: false, error: fetchError.message };
    }

    if (!publisher) {
      console.log('⚠️ Publisher not found or has invalid network code');
      return { success: false, error: 'Publisher not found or has invalid network code' };
    }

    console.log(`✅ Found publisher: ${publisher.name}`);

    let startDate, endDate;
    if (fetchLast2Months) {
      startDate = getDateDaysAgo(60);
      endDate = getTodayDate();
    } else {
      startDate = getTodayDate();
      endDate = null;
    }

    const reportData = await fetchGAMReportWithRetry(
      authClient,
      publisher.network_code,
      publisher.id,
      publisher.name,
      startDate,
      endDate,
      1
    );

    let success = false;
    if (reportData) {
      await saveReportToSupabase(reportData, fetchLast2Months);
      success = true;
      console.log(`✅ Report saved successfully for ${publisher.name}${fetchLast2Months ? ' (historical data)' : ''}`);
    } else {
      const fetchDate = getTodayDate();
      const { error: logError } = await supabase.from('report_fetch_logs').insert({
        publisher_id: publisher.id,
        fetch_date: fetchDate,
        status: 'failed',
        error_message: 'Failed to fetch report data',
      });
      if (logError) console.error('❌ Failed to write failed fetch log:', logError.message);
    }

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('📊 SINGLE PUBLISHER JOB SUMMARY');
    console.log('='.repeat(80));
    console.log(`Publisher: ${publisher.name}`);
    console.log(`Status: ${success ? '✅ Success' : '❌ Failed'}`);
    if (success && reportData) {
      console.log(`Revenue: ${reportData.summary.totalRevenue.toFixed(2)} (${reportData.currencyCode})`);
      console.log(`Ad Requests: ${reportData.summary.totalAdRequests.toLocaleString()}`);
      console.log(`Impressions: ${reportData.summary.totalImpressions.toLocaleString()}`);
      console.log(`Days fetched: ${reportData.summary.dateCount}`);
    }
    console.log(`⏱️ Duration: ${duration} seconds`);
    console.log(`🕐 Completed at: ${endTime.toISOString()}`);
    console.log('='.repeat(80) + '\n');

    return {
      success,
      publisher: publisher.name,
      summary: reportData ? reportData.summary : null
    };
  } catch (error) {
    console.error('❌ Fatal error in processSinglePublisher:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

app.post('/fetch-reports', async (req, res) => {
  const requestId = req.body?.request_id || 'manual-trigger';
  const triggeredBy = req.body?.triggered_by || 'manual';

  console.log(`\n[${requestId}] Manual all-publishers fetch triggered by: ${triggeredBy}`);
  console.log(`[${requestId}] Fetching ALL publishers immediately`);

  res.json({
    success: true,
    message: 'All-publishers fetch started',
    requestId,
    triggeredAt: new Date().toISOString(),
    note: 'Processing all publishers. Check logs for progress.'
  });

  setTimeout(() => {
    processAllPublishers().catch(error => {
      console.error(`[${requestId}] Error in manual fetch job:`, error);
    });
  }, 100);
});

app.post('/fetch-historical-reports', async (req, res) => {
  const requestId = req.body?.request_id || 'manual-trigger';
  const publisherId = req.body?.publisherId;

  if (!publisherId) {
    return res.status(400).json({
      success: false,
      error: 'publisherId is required',
      requestId,
    });
  }

  console.log(`\n[${requestId}] Historical report fetch triggered for new publisher`);
  console.log(`[${requestId}] Publisher ID: ${publisherId}`);
  console.log(`[${requestId}] Fetching last 60 days of data to reports_historical table`);

  res.json({
    success: true,
    message: `Historical report fetch (last 2 months) started for publisher ${publisherId}`,
    requestId,
    triggeredAt: new Date().toISOString(),
    dataDestination: 'reports_historical',
    retentionPeriod: '24 hours',
    note: 'Historical data will be stored in reports_historical and automatically cleaned up after 24 hours. Daily worker continues to store incremental data in reports_dimensional.'
  });

  setTimeout(async () => {
    try {
      const result = await processSinglePublisher(publisherId, true);

      if (result.success) {
        console.log(`[${requestId}] Historical data saved successfully. Queuing site audits...`);

        await queueAuditJobsForNewPublisher(publisherId, requestId);
      } else {
        console.error(`[${requestId}] Historical fetch failed, skipping audit job queue:`, result.error);
      }
    } catch (error) {
      console.error(`[${requestId}] Error in historical fetch job:`, error);
    }
  }, 100);
});

async function queueAuditJobsForNewPublisher(publisherId, requestId) {
  try {
    console.log(`[${requestId}] Extracting unique sites from historical report data...`);

    const { data: historicalData, error: fetchError } = await supabase
      .from('report_historical')
      .select('site_name')
      .eq('publisher_id', publisherId)
      .not('site_name', 'is', null);

    if (fetchError) {
      console.error(`[${requestId}] Error fetching historical sites:`, fetchError.message);
      return;
    }

    if (!historicalData || historicalData.length === 0) {
      console.warn(`[${requestId}] No site data found in historical report`);
      return;
    }

    const uniqueSites = [...new Set(historicalData.map(r => r.site_name))].filter(Boolean);

    if (uniqueSites.length === 0) {
      console.warn(`[${requestId}] No valid site names extracted from historical data`);
      return;
    }

    const sitesPayload = uniqueSites.map(name => ({
      url: name,
      name: name
    }));

    console.log(`[${requestId}] Found ${uniqueSites.length} unique site(s): ${uniqueSites.join(', ')}`);

    const { data: queueEntry, error: insertError } = await supabase
      .from('audit_job_queue')
      .insert({
        publisher_id: publisherId,
        sites: sitesPayload,
        status: 'pending',
        triggered_by: 'new_publisher_edge_function',
        worker_attempts: 0,
      })
      .select();

    if (insertError) {
      console.error(`[${requestId}] Error queuing audit job:`, insertError.message);
      return;
    }

    if (queueEntry && queueEntry.length > 0) {
      console.log(`[${requestId}] ✅ Audit job queued successfully with ID: ${queueEntry[0].id}`);
      console.log(`[${requestId}] Status: pending | Sites: ${uniqueSites.length}`);
    }
  } catch (error) {
    console.error(`[${requestId}] Error in queueAuditJobsForNewPublisher:`, error.message);
  }
}

app.listen(PORT, () => {
  console.log('\n' + '★'.repeat(80));
  console.log('🚀 GAM REPORT WORKER STARTED');
  console.log('★'.repeat(80));
  console.log(`🌐 HTTP Server listening on port ${PORT}`);
  console.log(`📡 Health endpoint: http://localhost:${PORT}/health`);
  console.log(`🔄 Trigger endpoint: http://localhost:${PORT}/fetch-reports`);
  console.log(`📅 Mode: API-driven (no internal scheduler)`);
  console.log(`⏰ Scheduled via: Supabase Edge Function + pg_cron (every 6 hours)`);
  console.log('★'.repeat(80) + '\n');
});
