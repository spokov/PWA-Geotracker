/*
# Create location_logs table for real-time background location tracking

1. New Tables
- `location_logs` — stores verified, unique GPS coordinates logged by authenticated users
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key → auth.users, defaults to authenticated user)
  - `username` (text, the username of the tracker at time of logging)
  - `latitude` (double precision, not null)
  - `longitude` (double precision, not null)
  - `timestamp` (timestamptz, ISO timestamp from the client device)
  - `created_at` (timestamptz, server-side record creation time)

2. Indexes
- `idx_location_logs_user_id` — fast lookup of a user's logs
- `idx_location_logs_user_timestamp` — chronological ordering per user for route rendering

3. Security — Row Level Security enabled
- SELECT: authenticated users can only read their own location logs
- INSERT: authenticated users can only insert logs with their own user_id
- UPDATE: authenticated users can only update their own logs
- DELETE: authenticated users can only delete their own logs

4. Important Notes
- `user_id` defaults to `auth.uid()` so client inserts that omit user_id still pass RLS.
- `username` is stored for convenience/display but authorization is always based on `user_id`.
- `timestamp` comes from the client device (ISO string) to represent exact GPS reading time.
*/

CREATE TABLE IF NOT EXISTS location_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_location_logs" ON location_logs;
CREATE POLICY "select_own_location_logs" ON location_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_location_logs" ON location_logs;
CREATE POLICY "insert_own_location_logs" ON location_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_location_logs" ON location_logs;
CREATE POLICY "update_own_location_logs" ON location_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_location_logs" ON location_logs;
CREATE POLICY "delete_own_location_logs" ON location_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_location_logs_user_id ON location_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_user_timestamp ON location_logs(user_id, timestamp ASC);