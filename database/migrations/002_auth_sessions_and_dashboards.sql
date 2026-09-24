ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(128),
  ADD COLUMN IF NOT EXISTS last_login_latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS last_login_longitude NUMERIC(9, 6);

ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS model_used VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_user_logs_action_created_at ON user_logs(action, created_at DESC);
