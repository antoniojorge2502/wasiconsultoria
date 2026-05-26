const authService = require('../services/authService');
const logService = require('../services/logService');

// ─── POST /api/auth/login ───────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    await logService.log({
      userId: result.user.id,
      action: 'LOGIN',
      description: `Login realizado via ${req.headers['user-agent']?.substring(0, 80)}`,
      req,
    });

    res.json({
      message: 'Login realizado com sucesso.',
      token: result.token,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/auth/me ───────────────────────────────────────
const me = async (req, res) => {
  res.json({ user: req.user });
};

// ─── PUT /api/auth/profile ──────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const updated = await authService.updateProfile(req.user.id, req.body);
    res.json({ message: 'Perfil atualizado.', user: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, me, updateProfile };
