CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  assignment TEXT NOT NULL,
  student_number TEXT NOT NULL,
  student_name TEXT NOT NULL,
  email TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  submitted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_email_submitted_at
  ON submissions (email, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_submitted_at
  ON submissions (assignment, submitted_at DESC);
