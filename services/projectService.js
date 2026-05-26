const { query, transaction } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const VALID_STATUSES = ['planning', 'design', 'development', 'review', 'completed', 'paused'];

const STATUS_LABELS = {
  planning:    'Planejamento',
  design:      'Design',
  development: 'Desenvolvimento',
  review:      'Revisão',
  completed:   'Concluído',
  paused:      'Pausado',
};

// ─── Listar projetos do cliente ─────────────────────────────
const getProjectsByUser = async (userId) => {
  const result = await query(
    `SELECT
       p.*,
       COUNT(t.id)::int                                   AS total_tasks,
       COUNT(t.id) FILTER (WHERE t.is_completed = true)::int AS completed_tasks
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows.map(formatProject);
};

// ─── Buscar projeto com tarefas ─────────────────────────────
const getProjectById = async (projectId, userId = null) => {
  const whereClause = userId ? 'AND p.user_id = $2' : '';
  const params = userId ? [projectId, userId] : [projectId];

  const result = await query(
    `SELECT
       p.*,
       u.name AS client_name, u.email AS client_email, u.company AS client_company,
       COUNT(t.id)::int                                   AS total_tasks,
       COUNT(t.id) FILTER (WHERE t.is_completed = true)::int AS completed_tasks
     FROM projects p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.id = $1 ${whereClause}
     GROUP BY p.id, u.name, u.email, u.company`,
    params
  );

  if (result.rows.length === 0) throw new AppError('Projeto não encontrado.', 404);

  const project = formatProject(result.rows[0]);

  // Buscar tarefas
  const tasksResult = await query(
    'SELECT * FROM tasks WHERE project_id = $1 ORDER BY order_index, created_at',
    [projectId]
  );
  project.tasks = tasksResult.rows;

  // Buscar arquivos
  const filesResult = await query(
    `SELECT f.*, u.name AS uploaded_by_name
     FROM file_uploads f
     JOIN users u ON u.id = f.uploaded_by
     WHERE f.project_id = $1
     ORDER BY f.created_at DESC`,
    [projectId]
  );
  project.files = filesResult.rows;

  return project;
};

// ─── Criar projeto ──────────────────────────────────────────
const createProject = async ({ userId, name, description, status, progress, startDate, endDate, nextSteps }) => {
  if (!userId || !name) throw new AppError('Usuário e nome do projeto são obrigatórios.', 400);
  if (status && !VALID_STATUSES.includes(status)) {
    throw new AppError(`Status inválido. Use: ${VALID_STATUSES.join(', ')}`, 400);
  }

  const result = await query(
    `INSERT INTO projects (user_id, name, description, status, progress, start_date, end_date, next_steps)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, name.trim(), description || null, status || 'planning', progress || 0,
     startDate || null, endDate || null, nextSteps || null]
  );

  return formatProject(result.rows[0]);
};

// ─── Atualizar projeto ──────────────────────────────────────
const updateProject = async (projectId, updates) => {
  const current = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
  if (current.rows.length === 0) throw new AppError('Projeto não encontrado.', 404);

  const p = current.rows[0];
  const { name, description, status, progress, startDate, endDate, nextSteps } = updates;

  if (status && !VALID_STATUSES.includes(status)) {
    throw new AppError(`Status inválido. Use: ${VALID_STATUSES.join(', ')}`, 400);
  }

  if (progress !== undefined && (progress < 0 || progress > 100)) {
    throw new AppError('Progresso deve estar entre 0 e 100.', 400);
  }

  const result = await query(
    `UPDATE projects
     SET name = $1, description = $2, status = $3, progress = $4,
         start_date = $5, end_date = $6, next_steps = $7
     WHERE id = $8
     RETURNING *`,
    [
      name        ?? p.name,
      description ?? p.description,
      status      ?? p.status,
      progress    ?? p.progress,
      startDate   ?? p.start_date,
      endDate     ?? p.end_date,
      nextSteps   ?? p.next_steps,
      projectId,
    ]
  );

  return formatProject(result.rows[0]);
};

// ─── Deletar projeto ────────────────────────────────────────
const deleteProject = async (projectId) => {
  const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [projectId]);
  if (result.rows.length === 0) throw new AppError('Projeto não encontrado.', 404);
  return { deleted: true };
};

// ─── Formatar projeto ───────────────────────────────────────
const formatProject = (row) => ({
  ...row,
  status_label: STATUS_LABELS[row.status] || row.status,
  progress: parseInt(row.progress) || 0,
});

// ─── Listar todos (admin) ───────────────────────────────────
const getAllProjects = async ({ page = 1, limit = 20, status, userId } = {}) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let i = 1;

  if (status) { conditions.push(`p.status = $${i++}`); params.push(status); }
  if (userId) { conditions.push(`p.user_id = $${i++}`); params.push(userId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);

  const result = await query(
    `SELECT p.*, u.name AS client_name, u.email AS client_email,
       COUNT(t.id)::int AS total_tasks,
       COUNT(t.id) FILTER (WHERE t.is_completed = true)::int AS completed_tasks
     FROM projects p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN tasks t ON t.project_id = p.id
     ${where}
     GROUP BY p.id, u.name, u.email
     ORDER BY p.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*)::int FROM projects p ${where}`,
    params.slice(0, -2)
  );

  return {
    projects: result.rows.map(formatProject),
    total: countResult.rows[0].count,
    page,
    totalPages: Math.ceil(countResult.rows[0].count / limit),
  };
};

module.exports = {
  getProjectsByUser,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getAllProjects,
};
