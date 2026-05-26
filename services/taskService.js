const { query } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

// ─── Listar tarefas do projeto ──────────────────────────────
const getTasksByProject = async (projectId) => {
  const result = await query(
    'SELECT * FROM tasks WHERE project_id = $1 ORDER BY order_index, created_at',
    [projectId]
  );
  return result.rows;
};

// ─── Criar tarefa ───────────────────────────────────────────
const createTask = async ({ projectId, name, description, orderIndex }) => {
  if (!projectId || !name) {
    throw new AppError('Projeto e nome da tarefa são obrigatórios.', 400);
  }

  // Verifica se projeto existe
  const projCheck = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
  if (projCheck.rows.length === 0) throw new AppError('Projeto não encontrado.', 404);

  // Ordem: maior existente + 1
  const orderResult = await query(
    'SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order FROM tasks WHERE project_id = $1',
    [projectId]
  );
  const nextOrder = orderIndex ?? orderResult.rows[0].next_order;

  const result = await query(
    `INSERT INTO tasks (project_id, name, description, order_index)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [projectId, name.trim(), description || null, nextOrder]
  );

  return result.rows[0];
};

// ─── Criar múltiplas tarefas (batch) ────────────────────────
const createManyTasks = async (projectId, taskNames) => {
  if (!Array.isArray(taskNames) || taskNames.length === 0) {
    throw new AppError('Forneça um array de nomes de tarefas.', 400);
  }

  const values = taskNames.map((name, i) => `($1, $${i + 2}, ${i + 1})`).join(', ');
  const params = [projectId, ...taskNames.map((n) => n.trim())];

  const result = await query(
    `INSERT INTO tasks (project_id, name, order_index) VALUES ${values} RETURNING *`,
    params
  );

  return result.rows;
};

// ─── Alternar conclusão da tarefa ───────────────────────────
const toggleTask = async (taskId, projectId, userId) => {
  // Verificar se o usuário tem acesso ao projeto
  const accessCheck = await query(
    `SELECT p.id FROM projects p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND (p.user_id = $2 OR u.role = 'admin')`,
    [projectId, userId]
  );

  // Buscar tarefa
  const taskResult = await query(
    'SELECT * FROM tasks WHERE id = $1 AND project_id = $2',
    [taskId, projectId]
  );

  if (taskResult.rows.length === 0) throw new AppError('Tarefa não encontrada.', 404);

  const task = taskResult.rows[0];
  const newCompleted = !task.is_completed;

  const result = await query(
    `UPDATE tasks
     SET is_completed = $1, completed_at = $2
     WHERE id = $3
     RETURNING *`,
    [newCompleted, newCompleted ? new Date() : null, taskId]
  );

  // Atualizar progresso do projeto automaticamente
  await recalculateProjectProgress(projectId);

  return result.rows[0];
};

// ─── Atualizar tarefa ───────────────────────────────────────
const updateTask = async (taskId, { name, description, orderIndex }) => {
  const current = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  if (current.rows.length === 0) throw new AppError('Tarefa não encontrada.', 404);

  const t = current.rows[0];

  const result = await query(
    `UPDATE tasks SET name = $1, description = $2, order_index = $3 WHERE id = $4 RETURNING *`,
    [name ?? t.name, description ?? t.description, orderIndex ?? t.order_index, taskId]
  );

  return result.rows[0];
};

// ─── Deletar tarefa ─────────────────────────────────────────
const deleteTask = async (taskId) => {
  const result = await query('DELETE FROM tasks WHERE id = $1 RETURNING id, project_id', [taskId]);
  if (result.rows.length === 0) throw new AppError('Tarefa não encontrada.', 404);
  await recalculateProjectProgress(result.rows[0].project_id);
  return { deleted: true };
};

// ─── Recalcular progresso do projeto ───────────────────────
const recalculateProjectProgress = async (projectId) => {
  const result = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE is_completed = true)::int AS done
     FROM tasks WHERE project_id = $1`,
    [projectId]
  );

  const { total, done } = result.rows[0];
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  await query('UPDATE projects SET progress = $1 WHERE id = $2', [progress, projectId]);

  return progress;
};

module.exports = {
  getTasksByProject,
  createTask,
  createManyTasks,
  toggleTask,
  updateTask,
  deleteTask,
  recalculateProjectProgress,
};
