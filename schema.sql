-- ============================================================
-- SCHEMA COMPLETO - Sistema de Consultoria
-- ============================================================

-- Extensão para UUID (opcional mas recomendado)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  company     VARCHAR(200),
  role        VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  avatar_url  VARCHAR(500),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: projects
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  status       VARCHAR(30) NOT NULL DEFAULT 'planning'
                 CHECK (status IN ('planning', 'design', 'development', 'review', 'completed', 'paused')),
  progress     SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  start_date   DATE,
  end_date     DATE,
  next_steps   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         VARCHAR(300) NOT NULL,
  description  TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: activity_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  task_id     INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  description TEXT,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: file_uploads
-- ============================================================
CREATE TABLE IF NOT EXISTS file_uploads (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename     VARCHAR(300) NOT NULL,
  original_name VARCHAR(300) NOT NULL,
  file_size    INTEGER NOT NULL,
  mime_type    VARCHAR(100),
  file_path    VARCHAR(500) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_user_id    ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed     ON tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_logs_user_id        ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_project_id     ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at     ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_uploads_proj   ON file_uploads(project_id);

-- ============================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED: usuário admin padrão
-- Senha: Admin@123 (bcrypt hash)
-- ============================================================
INSERT INTO users (name, email, password, company, role)
VALUES (
  'Administrador',
  'admin@consultoria.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdpUS.8yxRtVnOW',
  'Consultoria Pro',
  'admin'
) ON CONFLICT (email) DO NOTHING;
