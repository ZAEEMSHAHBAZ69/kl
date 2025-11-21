# 🚀 Deployment Checklist - Cross-Module Comparison & Alerting System

## ✅ Pre-Deployment Checklist

### 1. Database Migrations
- [ ] **Migration 1**: `20251121120000_create_phase1_comparison_tables.sql`
  - Creates: `module_comparison_results`, `publisher_trend_alerts`, `data_retention_policy_logs`
  
- [ ] **Migration 2**: `20251121120500_create_phase1_comparison_functions.sql`
  - Creates: `get_previous_audit_id()`, `calculate_publisher_risk_trajectory()`
  
- [ ] **Migration 3**: `20251121181500_fix_publisher_trend_alerts.sql` ⚠️ **CRITICAL**
  - Adds: `notified_at` column
  - Fixes: status enum to include `notified` and `acknowledged`
  
- [ ] **Migration 4**: `20251121181600_fix_retention_logs_schema.sql` ⚠️ **CRITICAL**
  - Fixes: Column names to match retention manager code

**Apply Command**:
```bash
cd d:\project-bolt-github-jndtxv2a-xvbrlaoj\project
supabase db push
```

---

### 2. Edge Function Deployment
- [ ] Deploy `send-alert-email` function
  ```bash
  supabase functions deploy send-alert-email
  ```

- [ ] Set SMTP environment variables
  ```bash
  supabase secrets set SMTP_HOST=smtp.example.com
  supabase secrets set SMTP_PORT=587
  supabase secrets set SMTP_USER=user@example.com
  supabase secrets set SMTP_PASS=your_password
  supabase secrets set SMTP_FROM=alerts@lpmedia.tech
  ```

---

### 3. Verify Database Schema

Run these queries in Supabase SQL Editor:

**Check publisher_trend_alerts**:
```sql
-- Should return notified_at column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'publisher_trend_alerts' 
AND column_name = 'notified_at';

-- Should return 5 status values
SELECT unnest(enum_range(NULL::text)) 
FROM pg_constraint 
WHERE conname = 'publisher_trend_alerts_status_check';
```

**Check data_retention_policy_logs**:
```sql
-- Should return operation_type, target_table, records_affected, status
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'data_retention_policy_logs' 
AND column_name IN ('operation_type', 'target_table', 'records_affected', 'status');
```

**Check functions exist**:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('get_previous_audit_id', 'calculate_publisher_risk_trajectory');
```

---

### 4. Test Alert System

**Test 1: Run an Audit**
```bash
# Trigger an audit for a publisher
# This should automatically trigger comparison and alert generation
```

**Test 2: Check Comparison Results**
```sql
SELECT * FROM module_comparison_results 
ORDER BY created_at DESC LIMIT 5;
```

**Test 3: Check Alerts Generated**
```sql
SELECT id, publisher_id, alert_type, severity, status, notified_at 
FROM publisher_trend_alerts 
ORDER BY created_at DESC LIMIT 10;
```

**Test 4: Check Email Logs**
```sql
SELECT * FROM email_logs 
WHERE email_type = 'alert' 
ORDER BY created_at DESC LIMIT 10;
```

---

### 5. Frontend Integration

**MFA Buster Page**:
```typescript
import { dashboardAggregationService } from '@/lib/dashboardAggregationService';

// Add to your page component
const trends = await dashboardAggregationService.getPublisherTrends(publisherId, 30);
const profiles = await dashboardAggregationService.getAllPublisherRiskProfiles();
```

**Alerts Page**:
```typescript
import { alertManagementService } from '@/lib/alertManagementService';

// Add to your alerts page
const alerts = await alertManagementService.getActiveAlerts();

// Add acknowledge/resolve handlers
await alertManagementService.acknowledgeAlert(alertId);
await alertManagementService.resolveAlert(alertId);
```

---

## 📋 Post-Deployment Verification

### System Health Checks

- [ ] **Worker Logs**: Check `worker.logs` for comparison engine execution
  - Look for: `[CMP-*]` log entries
  - Verify: No errors during comparison

- [ ] **Alert Processing**: Check alert manager execution
  - Look for: `[ALERT-PROC-*]` log entries
  - Verify: Alerts are being processed

- [ ] **Email Delivery**: Check email logs
  - Look for: `[EMAIL_SEND:*]` in Edge Function logs
  - Verify: Emails sent successfully

- [ ] **Database Growth**: Monitor table sizes
  ```sql
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE tablename IN ('module_comparison_results', 'publisher_trend_alerts', 'data_retention_policy_logs')
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
  ```

---

## 🔧 Configuration

### Data Retention Policies
Edit: `site-monitoring-worker/modules/retention-manager/retention-policy.js`

```javascript
const RETENTION_POLICIES = {
    RAW_AUDIT_DATA: { days: 365 },  // 1 year
    ALERTS: { days: 1095 },         // 3 years
    LOGS: { days: 90 }              // 3 months
};
```

### Enable Cleanup Scheduler
Add to worker initialization:

```javascript
const cleanupScheduler = require('./modules/retention-manager/cleanup-scheduler');
cleanupScheduler.init(); // Runs daily at 3 AM
```

---

## 🚨 Troubleshooting

### Issue: Alerts not generating
**Check**:
1. Comparison engine is running (check logs for `[CMP-*]`)
2. Previous audit exists for comparison
3. Changes exceed threshold (15+ risk score change)

### Issue: Emails not sending
**Check**:
1. SMTP secrets are set: `supabase secrets list`
2. Admin users exist: `SELECT * FROM app_users WHERE role IN ('admin', 'super_admin')`
3. Edge Function logs in Supabase dashboard

### Issue: Frontend not showing data
**Check**:
1. Services are imported correctly
2. Supabase client is initialized
3. RLS policies allow access
4. Data exists in tables

---

## 📊 Monitoring Queries

**Daily Alert Summary**:
```sql
SELECT 
  DATE(created_at) as date,
  alert_type,
  severity,
  COUNT(*) as count
FROM publisher_trend_alerts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), alert_type, severity
ORDER BY date DESC, count DESC;
```

**Email Delivery Rate**:
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM email_logs
WHERE email_type = 'alert'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

**Comparison Engine Performance**:
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as comparisons_run,
  COUNT(DISTINCT publisher_id) as publishers_analyzed
FROM module_comparison_results
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## ✅ Final Checklist

- [ ] All 4 migrations applied successfully
- [ ] Edge function deployed
- [ ] SMTP secrets configured
- [ ] Test audit completed
- [ ] Comparison results visible in DB
- [ ] Alerts generated (if thresholds met)
- [ ] Emails sent to admins
- [ ] Frontend services integrated
- [ ] Alerts page shows active alerts
- [ ] MFA Buster page shows trends
- [ ] Retention scheduler initialized (optional)
- [ ] Monitoring queries bookmarked

---

## 🎉 Success Criteria

✅ **System is working when**:
1. Audits trigger automatic comparisons
2. Comparisons generate alerts when risks detected
3. Alerts send emails to all admins
4. Emails are logged in `email_logs` table
5. Frontend displays alerts and trends
6. Users can acknowledge/resolve alerts
7. Historical data is tracked over time

---

## 📚 Documentation References

- **Integration Guide**: `INTEGRATION_GUIDE.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Migrations Summary**: `MIGRATIONS_SUMMARY.md`
- **Edge Function Usage**: `supabase/functions/send-alert-email/README.md`
