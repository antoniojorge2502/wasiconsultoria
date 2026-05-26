const { query } = require('../config/database');

// ─── Registrar atividade (não bloqueia resposta) ────────────
const log = async ({ userId, projectId, taskId, action, description, req }) => {
  try {
    const ip = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.headers?.['user-agent'] || null;

    await query(
      `INSERT INTO activity_logs (user_id, project_id, task_id, action, description, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId || null, projectId || null, taskId || null, action, description || null, ip, userAgent]
    );
  } catch (err) {
    // Não propagar erros de log — nunca deve derrubar a operação principal
    console.error('Erro ao registrar log:', err.message);
  }
};

// ─── Buscar logs (admin) ────────────────────────────────────
const getLogs = async ({ userId, projectId, limit = 50, offset = 0 } = {}) => {
  const conditions = [];
  const params = [];
  let i = 1;

  if (userId)    { conditions.push(`l.user_id = $${i++}`);    params.push(userId); }
  if (projectId) { conditions.push(`l.project_id = $${i++}`); params.push(projectId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);

  const result = await query(
    `SELECT l.*, u.name AS user_name, p.name AS project_name
     FROM activity_logs l
     LEFT JOIN users u ON u.id = l.user_id
     LEFT JOIN projects p ON p.id = l.project_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params
  );

  return result.rows;
};

module.exports = { log, getLogs };
