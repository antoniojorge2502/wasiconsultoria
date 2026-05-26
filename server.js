require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const routes = require("./routes/index");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globais ────────────────────────────────────
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Arquivos estáticos ─────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/uploads",
  express.static(path.join(__dirname, process.env.UPLOAD_DIR || "uploads")),
);

// ─── API Routes ─────────────────────────────────────────────
app.use("/api", routes);

// ─── Health check ───────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ─── SPA fallback (login e dashboard) ──────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ─── Tratamento de erros ────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Iniciar servidor ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🗄️  Banco: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`,
  );
  console.log(`\n📋 Rotas disponíveis:`);
  console.log(`   → GET  /health`);
  console.log(`   → POST /api/auth/login`);
  console.log(`   → GET  /api/projects`);
  console.log(`   → POST /api/admin/users`);
  console.log(`   → POST /api/admin/projects\n`);
});

module.exports = app;
