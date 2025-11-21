# GAM Report Worker

Automated Google Ad Manager (GAM) report fetching service with warehouse-style dimensional data storage.

## Features

- Automated daily GAM report fetching using SOAP API
- Multi-dimensional data collection (country, device, browser, OS, domain, etc.)
- Warehouse-style storage in `reports_dimensional` table
- Historical data support via `reports_historical` table (auto-cleanup after 24h)
- Daily summary metrics in `reports_daily` table
- Multi-currency support with automatic currency detection
- Batch processing with configurable delays and retry logic
- Alert generation for failed fetches
- Service key validation

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file with:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GAM_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
PORT=3000

# Optional Configuration
BATCH_SIZE=100
BATCH_DELAY_MS=2000
PUBLISHER_DELAY_MS=100
RETRY_ATTEMPTS=3
RETRY_DELAY_MS=1000
RUN_INTERVAL_MS=5220000
```

## Usage

Start the worker:

```bash
npm start
```

Development mode with auto-reload:

```bash
npm run dev
```

## API Endpoints

### GET /

Service information and endpoint documentation.

### GET /health

Health check endpoint:

```json
{
  "status": "healthy",
  "uptime": 12345,
  "timestamp": "2025-10-25T12:00:00Z"
}
```

### POST /fetch-reports

Trigger report fetch manually:

```json
{
  "request_id": "optional-request-id",
  "fetch_mode": "all_publishers",
  "triggered_by": "user@example.com"
}
```

For single publisher:

```json
{
  "fetch_mode": "single_publisher",
  "publisher_id": "uuid",
  "fetch_last_2_months": false
}
```

### POST /fetch-historical-reports

Fetch last 2 months of data for a new publisher (stored in reports_historical):

```json
{
  "publisherId": "uuid"
}
```

Historical data is automatically cleaned up after 24 hours by a cron job.

## Data Architecture

### reports_daily
Daily aggregated metrics per publisher:
- Revenue, impressions, clicks, CTR, eCPM
- Match rate, delivery rate, viewability
- Currency-specific data

### reports_dimensional
Warehouse-style dimensional data with metrics broken down by:
- Date
- Country (name + criteria ID)
- Device category (name + ID)
- Browser (name + ID)
- Operating system (name + version ID)
- Domain
- Mobile app name
- Carrier name

### reports_historical
Same structure as reports_dimensional but for historical backfill data.
Automatically cleaned up after 24 hours.

## Scheduled Operations

The worker runs automatically every 87 minutes (configurable via RUN_INTERVAL_MS).

Manual triggers are available via the API endpoints above.

## Error Handling

- Automatic retries with exponential backoff
- Alert generation for failed fetches
- Service key status validation
- Comprehensive logging

## Deployment

This worker can be deployed to any Node.js hosting platform.

For Render deployment, use the included `render.yaml` configuration.

Ensure your GAM service account has proper permissions:
- Read access to Ad Manager API
- Network code access for all publishers

## Currency Handling

The worker automatically detects each publisher's GAM network currency and stores it in the `currency_code` field. All revenue data is stored in the publisher's native GAM currency.

Currency conversion should be handled at the application/reporting layer using the `exchange_rates` table.
