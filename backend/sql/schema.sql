CREATE TABLE IF NOT EXISTS users(
  id BIGSERIAL PRIMARY KEY,
  role VARCHAR(20) NOT NULL CHECK(role IN ('student','teacher')),
  code VARCHAR(60) UNIQUE NOT NULL,
  dni VARCHAR(8) UNIQUE,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(180) UNIQUE,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS courses(
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(60) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  teacher_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_students(
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(course_id,student_id)
);

CREATE TABLE IF NOT EXISTS exams(
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 1 AND 600),
  randomize_questions BOOLEAN NOT NULL DEFAULT TRUE,
  randomize_options BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions(
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_options(
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS exam_questions(
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  points NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK(points>=0),
  UNIQUE(exam_id,question_id)
);

CREATE TABLE IF NOT EXISTS attempts(
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL CHECK(status IN ('in_progress','submitted','expired')),
  score NUMERIC(10,2),
  max_score NUMERIC(10,2),
  incident_count INTEGER NOT NULL DEFAULT 0,
  consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attempts_exam_student ON attempts(exam_id,student_id);

CREATE TABLE IF NOT EXISTS attempt_questions(
  id BIGSERIAL PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id),
  position INTEGER NOT NULL,
  option_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(attempt_id,question_id),
  UNIQUE(attempt_id,position)
);

CREATE TABLE IF NOT EXISTS answers(
  id BIGSERIAL PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  attempt_question_id BIGINT UNIQUE NOT NULL REFERENCES attempt_questions(id) ON DELETE CASCADE,
  selected_option_id BIGINT REFERENCES question_options(id),
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents(
  id BIGSERIAL PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  type VARCHAR(120) NOT NULL,
  details TEXT,
  client_at TIMESTAMPTZ,
  server_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incidents_attempt ON incidents(attempt_id,server_at);

-- Preparado para Fase 2: capturas de webcam con consentimiento.
CREATE TABLE IF NOT EXISTS evidence(
  id BIGSERIAL PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL,
  object_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_dni ON users(dni);
