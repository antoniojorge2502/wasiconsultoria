const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const authController    = require('../controllers/authController');
const projectController = require('../controllers/projectController');
const taskController    = require('../controllers/taskController');
const adminController   = require('../controllers/adminController');
const { authenticate, adminOnly, ownsProject } = require('../middleware/auth');
const { query } = require('../config/database');

// ─── Configuração Multer (upload) ───────────────────────────
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|xls|xlsx|png|jpg|jpeg|gif|zip|txt/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido.'));
  },
});

// ════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════
router.post('/auth/login',          authController.login);
router.get ('/auth/me',   authenticate, authController.me);
router.put ('/auth/profile', authenticate, authController.updateProfile);

// ════════════════════════════════════════════════════════════
// CLIENT ROUTES (autenticado)
// ════════════════════════════════════════════════════════════

// Projetos
router.get('/projects',     authenticate, projectController.listProjects);
router.get('/projects/:id', authenticate, projectController.getProject);

// Tarefas
router.get  ('/projects/:projectId/tasks',                 authenticate, ownsProject, taskController.listTasks);
router.patch('/projects/:projectId/tasks/:taskId/toggle',  authenticate, ownsProject, taskController.toggleTask);

// Upload de arquivo
router.post('/projects/:projectId/upload', authenticate, ownsProject, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const result = await query(
      `INSERT INTO file_uploads (project_id, uploaded_by, filename, original_name, file_size, mime_type, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.params.projectId,
        req.user.id,
        req.file.filename,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        req.file.path,
      ]
    );

    res.status(201).json({ message: 'Arquivo enviado.', file: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════════════════════════
router.get ('/admin/stats',                       authenticate, adminOnly, adminController.getStats);
router.get ('/admin/logs',                        authenticate, adminOnly, adminController.getLogs);

// Clientes
router.post('/admin/users',                       authenticate, adminOnly, adminController.createClient);
router.get ('/admin/users',                       authenticate, adminOnly, adminController.listClients);
router.get ('/admin/users/:id',                   authenticate, adminOnly, adminController.getClient);
router.patch('/admin/users/:id/toggle',           authenticate, adminOnly, adminController.toggleClientStatus);

// Projetos (admin)
router.get ('/admin/projects',                    authenticate, adminOnly, projectController.adminListProjects);
router.post('/admin/projects',                    authenticate, adminOnly, projectController.createProject);
router.put ('/admin/projects/:id',                authenticate, adminOnly, projectController.updateProject);
router.delete('/admin/projects/:id',              authenticate, adminOnly, projectController.deleteProject);

// Tarefas (admin)
router.post('/admin/projects/:projectId/tasks',         authenticate, adminOnly, taskController.createTask);
router.post('/admin/projects/:projectId/tasks/batch',   authenticate, adminOnly, taskController.createManyTasks);
router.put ('/admin/tasks/:taskId',                     authenticate, adminOnly, taskController.updateTask);
router.delete('/admin/tasks/:taskId',                   authenticate, adminOnly, taskController.deleteTask);

module.exports = router;
