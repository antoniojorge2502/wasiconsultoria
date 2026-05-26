const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// ─── Middleware principal de autenticação ───────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de acesso não fornecido.' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado. Faça login novamente.' });
      }
      return res.status(401).json({ error: 'Token inválido.' });
    }

    // Verificar se o usuário ainda existe e está ativo
    const result = await query(
      'SELECT id, name, email, role, company, avatar_url FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('Erro no middleware de autenticação:', err);
    res.status(500).json({ error: 'Erro interno de autenticação.' });
  }
};

// ─── Middleware: apenas admins ──────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
};

// ─── Middleware: verificar dono do projeto ──────────────────
const ownsProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const userId = req.user.id;

    // Admin tem acesso total
    if (req.user.role === 'admin') return next();

    const result = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a este projeto.' });
    }

    next();
  } catch (err) {
    console.error('Erro ao verificar dono do projeto:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
};

module.exports = { authenticate, adminOnly, ownsProject };
