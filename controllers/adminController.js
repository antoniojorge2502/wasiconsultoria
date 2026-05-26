const authService = require('../services/authService');
const logService = require('../services/logService');
const { query } = require('../config/database');

// ─── POST /api/admin/users ──────────────────────────────────
const createClient = async (req, res, next) => {
  try {
    const { name, email, password, company } = req.body;
    const user = await authService.createUser({ name, email, password, company, role: 'client' });

    await logService.log({
      userId: req.user.id,
      action: 'CLIENT_CREATED',
      description: `Cliente "${name}" (${email}) criado`,
      req,
    });

    res.status(201).json({ message: 'Cliente criado com sucesso.', user });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/users ───────────────────────────────────
const listClients = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.company, u.role, u.is_active, u.created_at,
         COUNT(p.id)::int AS total_projects
       FROM users u
       LEFT JOIN projects p ON p.user_id = u.id
       WHERE u.role = 'client'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );

    res.json({ clients: result.rows });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/users/:id ───────────────────────────────
const getClient = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, email, company, role, is_active, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({ client: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/admin/users/:id/toggle ──────────────────────
const toggleClientStatus = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE users SET is_active = NOT is_active
       WHERE id = $1 AND role = 'client'
       RETURNING id, name, is_active`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    const client = result.rows[0];
    res.json({
      message: `Cliente ${client.is_active ? 'ativado' : 'desativado'}.`,
      client,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/stats ───────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const [usersR, projectsR, tasksR, logsR] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active) ::int AS active FROM users WHERE role='client'`),
      query(`SELECT COUNT(*)::int AS total, status, COUNT(*)::int AS count FROM projects GROUP BY status`),
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_completed)::int AS done FROM tasks`),
      query(`SELECT action, COUNT(*)::int AS count FROM activity_logs WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY action ORDER BY count DESC LIMIT 10`),
    ]);

    res.json({
      clients:  usersR.rows[0],
      projects: projectsR.rows,
      tasks:    tasksR.rows[0],
      recentActivity: logsR.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/logs ────────────────────────────────────
const getLogs = async (req, res, next) => {
  try {
    const { userId, projectId, limit, offset } = req.query;
    const logs = await logService.getLogs({ userId, projectId, limit, offset });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
};

module.exports = { createClient, listClients, getClient, toggleClientStatus, getStats, getLogs };
