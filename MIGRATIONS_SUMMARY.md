# Database Migrations Summary

## Migration Files (Apply in Order)

### 1. `20251121120000_create_phase1_comparison_tables.sql`
**Status**: ✅ Ready  
**Purpose**: Create core tables for cross-module comparison and alerting

**Tables Created**:
- `module_comparison_results` - Stores audit comparison snapshots
- `publisher_trend_alerts` - Tracks alert conditions (NEEDS FIX - see migration 3)
- `data_retention_policy_logs` - Logs cleanup operations (NEEDS FIX - see migration 4)

**Indexes Created**:
- Multiple indexes on all tables for performance

**RLS Policies**:
- Authenticated users can view comparisons
- Partners can view their own alerts
- Admins can manage alerts
- Admins can view retention logs

---

### 2. `20251121120500_create_phase1_comparison_functions.sql`
**Status**: ✅ Ready  
**Purpose**: Create database functions for comparison logic

**Functions Created**:
- `get_previous_audit_id(current_audit_id)` - Finds previous audit for comparison
- `calculate_publisher_risk_trajectory(publisher_id, days_back)` - Gets risk history

**Permissions**:
- Granted EXECUTE to authenticated users

---

### 3. `20251121181500_fix_publisher_trend_alerts.sql` ⚠️ **REQUIRED**
**Status**: ⚠️ Must Apply  
**Purpose**: Fix missing fields in publisher_trend_alerts table

**Changes**:
- ✅ Add `notified_at` timestamp column
- ✅ Add `notified` status to enum (used by alert engine)
- ✅ Add `acknowledged` status to enum (used by frontend)
- ✅ Update status constraint: `active`, `notified`, `acknowledged`, `resolved`, `dismissed`

**Why Needed**: 
- Alert engine sets `status = 'notified'` and `notified_at = timestamp`
- Frontend service uses `acknowledgeAlert()` which sets `status = 'acknowledged'`
- Original migration only had: `active`, `resolved`, `dismissed`

---

### 4. `20251121181600_fix_retention_logs_schema.sql` ⚠️ **REQUIRED**
**Status**: ⚠️ Must Apply  
**Purpose**: Fix column names in data_retention_policy_logs table

**Changes**:
- ✅ Rename `policy_name` → `operation_type`
- ✅ Rename `records_deleted` → `records_affected`
- ✅ Rename `execution_status` → `status`
- ✅ Add `target_table` column
- ✅ Change `details` from jsonb to text
- ✅ Update status constraint: `SUCCESS`, `FAILURE`

**Why Needed**:
- Retention manager code uses different field names than original migration
- Code expects: `operation_type`, `target_table`, `records_affected`, `status`, `details`
- Original migration had: `policy_name`, `records_deleted`, `execution_status`

---

## How to Apply Migrations

### Option 1: Using Supabase CLI (Recommended)
```bash
cd d:\project-bolt-github-jndtxv2a-xvbrlaoj\project

# Apply all pending migrations
supabase db push
```

### Option 2: Manual Application (Supabase Dashboard)
1. Go to Supabase Dashboard → SQL Editor
2. Run migrations in order:
   - `20251121120000_create_phase1_comparison_tables.sql`
   - `20251121120500_create_phase1_comparison_functions.sql`
   - `20251121181500_fix_publisher_trend_alerts.sql` ⚠️
   - `20251121181600_fix_retention_logs_schema.sql` ⚠️

---

## Verification Queries

After applying migrations, run these queries to verify:

### Check publisher_trend_alerts schema
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'publisher_trend_alerts'
ORDER BY ordinal_position;
```

**Expected columns**:
- id (uuid)
- publisher_id (uuid)
- alert_type (text)
- severity (text)
- message (text)
- status (text) - with constraint: active, notified, acknowledged, resolved, dismissed
- metadata (jsonb)
- created_at (timestamptz)
- resolved_at (timestamptz)
- **notified_at (timestamptz)** ← Must be present

### Check data_retention_policy_logs schema
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'data_retention_policy_logs'
ORDER BY ordinal_position;
```

**Expected columns**:
- id (uuid)
- **operation_type (text)** ← Not policy_name
- **target_table (text)** ← Must be present
- **records_affected (integer)** ← Not records_deleted
- **status (text)** ← Not execution_status
- details (text) ← Not jsonb
- executed_at (timestamptz)

### Check functions exist
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_previous_audit_id', 'calculate_publisher_risk_trajectory');
```

**Expected**: 2 rows returned

---

## Migration Status Checklist

- [ ] Migration 1: Create comparison tables
- [ ] Migration 2: Create comparison functions
- [ ] Migration 3: Fix publisher_trend_alerts (ADD notified_at, status values)
- [ ] Migration 4: Fix retention logs schema (RENAME columns)
- [ ] Verify publisher_trend_alerts has `notified_at` column
- [ ] Verify publisher_trend_alerts status includes `notified` and `acknowledged`
- [ ] Verify data_retention_policy_logs has correct column names
- [ ] Test: Insert a test alert and verify schema
- [ ] Test: Run retention logger and verify it works

---

## Common Issues

### Issue: "column notified_at does not exist"
**Solution**: Apply migration 3 (`20251121181500_fix_publisher_trend_alerts.sql`)

### Issue: "column operation_type does not exist"
**Solution**: Apply migration 4 (`20251121181600_fix_retention_logs_schema.sql`)

### Issue: "new row violates check constraint publisher_trend_alerts_status_check"
**Solution**: Apply migration 3 to add missing status values

---

## Next Steps After Migrations

1. ✅ Deploy Edge Function: `supabase functions deploy send-alert-email`
2. ✅ Set SMTP secrets for email sending
3. ✅ Run a test audit to verify comparison engine works
4. ✅ Check that alerts are generated in `publisher_trend_alerts`
5. ✅ Verify emails are sent to admins
6. ✅ Test alert acknowledgment in frontend
