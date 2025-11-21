# Edge Function Usage Guide: send-alert-email

## Overview
The `send-alert-email` Edge Function handles alert notifications for **two separate systems**:
1. **GAM Report Worker** → Uses `alerts` table
2. **Site Monitoring Worker** → Uses `publisher_trend_alerts` table

## Usage Patterns

### 1. GAM Report Worker (Default)
**Table**: `alerts`  
**Usage**: Pass only `alertId`

```javascript
// gam-report-worker/index.js
const emailResponse = await axios.post(
  `${SUPABASE_URL}/functions/v1/send-alert-email`,
  { alertId: alert.id },
  { headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
);
```

The function will:
- Query the `alerts` table
- Fetch publisher info with `domain` field
- Send to all admin/super_admin users

---

### 2. Site Monitoring Worker (Direct Data)
**Table**: `publisher_trend_alerts`  
**Usage**: Pass full alert data (recommended - no DB lookup needed)

```javascript
// site-monitoring-worker/modules/alert-engine/notification-dispatcher.js
const { data, error } = await this.client.functions.invoke('send-alert-email', {
  body: {
    alertId: alert.id,
    publisherName: publisher.name,
    publisherDomain: publisher.primary_domain,
    recipientEmail: adminEmail,  // specific admin email
    alertType: alert.alert_type,
    severity: alert.severity,
    message: alert.message,
    metadata: alert.metadata,
    timestamp: alert.created_at
  }
});
```

The function will:
- Use the provided data directly (no DB query)
- Send to the specified `recipientEmail`
- More efficient than lookup method

---

### 3. Site Monitoring Worker (Lookup)
**Table**: `publisher_trend_alerts`  
**Usage**: Pass `alertId` with source flag

```javascript
const { data, error } = await this.client.functions.invoke('send-alert-email', {
  body: {
    alertId: trendAlertId,
    source: 'site-monitoring'  // or useTrendAlerts: true
  }
});
```

The function will:
- Query the `publisher_trend_alerts` table
- Fetch publisher info with `primary_domain` field
- Send to all admin/super_admin users

---

### 4. Test Email
**Usage**: Send a test alert

```javascript
const { data, error } = await this.client.functions.invoke('send-alert-email', {
  body: {
    testEmail: 'admin@example.com',
    type: 'test_alert',
    severity: 'medium',
    message: 'This is a test alert'
  }
});
```

---

## Table Differences

| Feature | `alerts` (GAM) | `publisher_trend_alerts` (Site Monitoring) |
|---------|----------------|-------------------------------------------|
| **Used By** | gam-report-worker | site-monitoring-worker |
| **Domain Field** | `publishers.domain` | `publishers.primary_domain` |
| **Type Field** | `type` | `alert_type` |
| **Auto-Detected** | Yes (default) | Requires `source` flag or direct data |

## How Table Selection Works

```typescript
if (requestData.alertId && requestData.publisherName) {
  // Direct data provided → Use it (site-monitoring-worker)
} else if (requestData.source === 'site-monitoring' || requestData.useTrendAlerts) {
  // Lookup from publisher_trend_alerts table
} else {
  // Default: Lookup from alerts table (gam-report-worker)
}
```

## Email Recipients

**All patterns** send to admin/super_admin users from `app_users` table:
```sql
SELECT email FROM app_users WHERE role IN ('admin', 'super_admin');
```

Exception: When `recipientEmail` is provided in direct data mode, it sends only to that email.

## Response Format

```json
{
  "success": true,
  "message": "Alert emails sent: 2 succeeded, 0 failed",
  "alertId": "uuid",
  "recipients": ["admin1@example.com", "admin2@example.com"],
  "successCount": 2,
  "failedCount": 0,
  "results": [
    {
      "email": "admin1@example.com",
      "status": "sent",
      "error": null,
      "metadata": { "messageId": "..." }
    }
  ],
  "timestamp": "2025-11-21T18:45:00.000Z"
}
```

## Environment Variables Required

```bash
# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM=alerts@lpmedia.tech  # Optional, defaults to SMTP_USER

# Supabase (automatically provided)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

## Deployment

```bash
# Deploy the function
supabase functions deploy send-alert-email

# Set SMTP secrets
supabase secrets set SMTP_HOST=smtp.example.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=user@example.com
supabase secrets set SMTP_PASS=password
supabase secrets set SMTP_FROM=alerts@lpmedia.tech
```

## Summary

✅ **GAM Report Worker**: Just pass `{ alertId }` - uses `alerts` table  
✅ **Site Monitoring Worker**: Pass full data or `{ alertId, source: 'site-monitoring' }` - uses `publisher_trend_alerts` table  
✅ **Both systems**: Send to all admin/super_admin users  
✅ **Separate tables**: No conflicts between systems
