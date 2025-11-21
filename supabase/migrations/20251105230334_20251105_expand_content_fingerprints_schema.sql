/*
  # Expand Content Fingerprints Schema for Entropy & Duplication Detection

  1. Columns Added to content_fingerprints
    - `page_url` (text) - The specific page URL
    - `audit_id` (uuid, FK to site_audits) - Associated audit
    - `simhash_fingerprint` (text) - 64-bit SimHash hash for near-duplicate detection
    - `content_hash` (text) - SHA256 hash for exact matching
    - `entropy_score` (numeric) - Shannon entropy (0-1 scale, threshold < 0.35)
    - `content_length` (integer) - Character count
    - `unique_words` (integer) - Unique word count
    - `total_words` (integer) - Total word count
    - `flag_status` (text) - 'low_entropy' | 'potential_duplicate' | 'clean' | 'mixed'
    - `duplicate_matches` (jsonb) - Matching domains with similar content
    - `content_sample` (text) - First 500 chars for verification

  2. Indexes
    - Index on simhash_fingerprint for duplicate queries
    - Index on content_hash for exact matches
    - Index on entropy_score for low-entropy filtering
    - Index on domain for cross-domain detection
    - Index on audit_id for audit queries

  3. Purpose
    - Enable near-duplicate detection via SimHash (distance < 3)
    - Flag AI-generated content via entropy < 0.35
    - Support content network identification
    - Maintain forensic audit trail
*/

DO $$
BEGIN
  -- Add page_url if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'page_url'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN page_url text;
  END IF;

  -- Add audit_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'audit_id'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN audit_id uuid REFERENCES site_audits(id) ON DELETE CASCADE;
  END IF;

  -- Add simhash_fingerprint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'simhash_fingerprint'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN simhash_fingerprint text;
  END IF;

  -- Add content_hash if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'content_hash'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN content_hash text;
  END IF;

  -- Add entropy_score if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'entropy_score'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN entropy_score numeric(4, 3);
  END IF;

  -- Add content_length if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'content_length'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN content_length integer DEFAULT 0;
  END IF;

  -- Add unique_words if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'unique_words'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN unique_words integer DEFAULT 0;
  END IF;

  -- Add total_words if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'total_words'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN total_words integer DEFAULT 0;
  END IF;

  -- Add flag_status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'flag_status'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN flag_status text DEFAULT 'clean';
  END IF;

  -- Add duplicate_matches if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'duplicate_matches'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN duplicate_matches jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add content_sample if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_fingerprints' AND column_name = 'content_sample'
  ) THEN
    ALTER TABLE content_fingerprints ADD COLUMN content_sample text;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_content_fingerprints_simhash ON content_fingerprints (simhash_fingerprint);
CREATE INDEX IF NOT EXISTS idx_content_fingerprints_content_hash ON content_fingerprints (content_hash);
CREATE INDEX IF NOT EXISTS idx_content_fingerprints_entropy ON content_fingerprints (entropy_score);
CREATE INDEX IF NOT EXISTS idx_content_fingerprints_domain ON content_fingerprints (domain);
CREATE INDEX IF NOT EXISTS idx_content_fingerprints_audit_id ON content_fingerprints (audit_id);
