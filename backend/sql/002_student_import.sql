-- Extensión segura del modelo actual.
ALTER TABLE users ADD COLUMN IF NOT EXISTS dni VARCHAR(8);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_dni_unique
ON users(dni) WHERE dni IS NOT NULL;

CREATE TABLE IF NOT EXISTS student_profiles(
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  career VARCHAR(120) NOT NULL DEFAULT 'ELECTRICIDAD INDUSTRIAL',
  phone VARCHAR(30),
  age INTEGER,
  enrollment_status VARCHAR(60),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cohorts(
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  career VARCHAR(120) NOT NULL,
  cycle INTEGER NOT NULL,
  shift VARCHAR(30) NOT NULL,
  academic_year INTEGER NOT NULL,
  academic_term VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cohort_students(
  cohort_id BIGINT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_file TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(cohort_id,student_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_students_student
ON cohort_students(student_id);
