// ─── Middleware: 404 ────────────────────────────────────────
const notFound = (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada.',
    path: req.originalUrl,
  });
};

// ─── Middleware: erro global ────────────────────────────────
const errorHandler = (err, req, res, next) => {
  console.error('❌ Erro não tratado:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  // Erros conhecidos do PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Registro duplicado. Verifique os dados.' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referência inválida entre registros.' });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Formato de dado inválido.' });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Erro interno do servidor.';

  res.status(status).json({ error: message });
};

// ─── Classe de erro operacional ─────────────────────────────
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { notFound, errorHandler, AppError };
