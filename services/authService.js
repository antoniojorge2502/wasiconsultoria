const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

// ─── Gerar JWT ──────────────────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ─── Login ──────────────────────────────────────────────────
const login = async ({ email, password }) => {
  if (!email || !password) {
    throw new AppError('Email e senha são obrigatórios.', 400);
  }

  const result = await query(
    'SELECT id, name, email, password, role, company, avatar_url FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase().trim()]
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError('Credenciais inválidas.', 401);
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new AppError('Credenciais inválidas.', 401);
  }

  const token = generateToken(user.id);

  // Remover senha do retorno
  const { password: _, ...userWithoutPassword } = user;

  return { token, user: userWithoutPassword };
};

// ─── Criar usuário (admin) ──────────────────────────────────
const createUser = async ({ name, email, password, company, role = 'client' }) => {
  if (!name || !email || !password) {
    throw new AppError('Nome, email e senha são obrigatórios.', 400);
  }

  if (password.length < 6) {
    throw new AppError('Senha deve ter no mínimo 6 caracteres.', 400);
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing.rows.length > 0) {
    throw new AppError('Email já cadastrado.', 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await query(
    `INSERT INTO users (name, email, password, company, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, company, role, created_at`,
    [name.trim(), email.toLowerCase().trim(), hashedPassword, company || null, role]
  );

  return result.rows[0];
};

// ─── Atualizar perfil ───────────────────────────────────────
const updateProfile = async (userId, { name, company, currentPassword, newPassword }) => {
  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];

  if (!user) throw new AppError('Usuário não encontrado.', 404);

  let hashedPassword = user.password;

  if (newPassword) {
    if (!currentPassword) throw new AppError('Senha atual é obrigatória para alterar a senha.', 400);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new AppError('Senha atual incorreta.', 401);
    if (newPassword.length < 6) throw new AppError('Nova senha deve ter no mínimo 6 caracteres.', 400);
    hashedPassword = await bcrypt.hash(newPassword, 12);
  }

  const result = await query(
    `UPDATE users SET name = $1, company = $2, password = $3
     WHERE id = $4
     RETURNING id, name, email, company, role, updated_at`,
    [name || user.name, company || user.company, hashedPassword, userId]
  );

  return result.rows[0];
};

module.exports = { login, createUser, updateProfile, generateToken };
