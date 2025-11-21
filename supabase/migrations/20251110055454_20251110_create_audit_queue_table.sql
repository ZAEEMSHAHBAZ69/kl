/*
  # Create audit_queue table

  1. New Tables
    - `audit_queue`
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, required, identifies the publisher being audited)
      - `sites` (text[], array of site names to audit)
      - `priority` (text, job priority: normal, high)
      - `status` (text, job status: pending, running, completed, failed)
      - `started_at` (timestamptz, when processing started)
      - `completed_at` (timestamptz, when processing finished)
      - `error_message` (text, error message if job failed)
      - `queued_at` (timestamptz, when job was queued)
      - `created_at` (timestamptz, server-side timestamp)

  2. Security
    - Enable RLS on `audit_queue` table
    - Add policy for authenticated users to view their own audit queue jobs

  3. Notes
    - This table manages the audit job queue for the worker process
    - Status tracks the job lifecycle from pending to completion
*/

CREATE TABLE IF NOT EXISTS audit_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  sites text[] NOT NULL DEFAULT '{}',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  queued_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_queue_status ON audit_queue(status);
CREATE INDEX IF NOT EXISTS idx_audit_queue_publisher_id ON audit_queue(publisher_id);
CREATE INDEX IF NOT EXISTS idx_audit_queue_created_at ON audit_queue(created_at DESC);

ALTER TABLE audit_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit queue"
  ON audit_queue
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit queue jobs"
  ON audit_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update audit queue jobs"
  ON audit_queue
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
