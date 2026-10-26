ALTER TABLE public.import_channels
  ADD COLUMN IF NOT EXISTS autopilot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dry_scans integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;