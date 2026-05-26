const projectService = require('../services/projectService');
const logService = require('../services/logService');

// ─── GET /api/projects (cliente: apenas os seus) ────────────
const listProjects = async (req, res, next) => {
  try {
    const userId = req.user.role === 'admin' && req.query.userId
      ? req.query.userId
      : req.user.id;

    const projects = await projectService.getProjectsByUser(userId);
    res.json({ projects });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/projects/:id ──────────────────────────────────
const getProject = async (req, res, next) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;
    const project = await projectService.getProjectById(req.params.id, userId);
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/admin/projects ───────────────────────────────
const createProject = async (req, res, next) => {
  try {
    const { userId, name, description, status, progress, startDate, endDate, nextSteps } = req.body;
    const project = await projectService.createProject({
      userId, name, description, status, progress, startDate, endDate, nextSteps,
    });

    await logService.log({
      userId: req.user.id,
      projectId: project.id,
      action: 'PROJECT_CREATED',
      description: `Projeto "${project.name}" criado para usuário ${userId}`,
      req,
    });

    res.status(201).json({ message: 'Projeto criado com sucesso.', project });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/admin/projects/:id ────────────────────────────
const updateProject = async (req, res, next) => {
  try {
    const project = await projectService.updateProject(req.params.id, req.body);

    await logService.log({
      userId: req.user.id,
      projectId: project.id,
      action: 'PROJECT_UPDATED',
      description: `Projeto "${project.name}" atualizado`,
      req,
    });

    res.json({ message: 'Projeto atualizado.', project });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/admin/projects/:id ─────────────────────────
const deleteProject = async (req, res, next) => {
  try {
    await projectService.deleteProject(req.params.id);
    res.json({ message: 'Projeto excluído.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/projects (listagem geral) ───────────────
const adminListProjects = async (req, res, next) => {
  try {
    const { page, limit, status, userId } = req.query;
    const result = await projectService.getAllProjects({ page, limit, status, userId });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { listProjects, getProject, createProject, updateProject, deleteProject, adminListProjects };
