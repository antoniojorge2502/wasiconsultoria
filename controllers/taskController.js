const taskService = require('../services/taskService');
const logService = require('../services/logService');

// ─── GET /api/projects/:projectId/tasks ─────────────────────
const listTasks = async (req, res, next) => {
  try {
    const tasks = await taskService.getTasksByProject(req.params.projectId);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/admin/projects/:projectId/tasks ──────────────
const createTask = async (req, res, next) => {
  try {
    const { name, description, orderIndex } = req.body;
    const task = await taskService.createTask({
      projectId: req.params.projectId,
      name,
      description,
      orderIndex,
    });

    await logService.log({
      userId: req.user.id,
      projectId: req.params.projectId,
      taskId: task.id,
      action: 'TASK_CREATED',
      description: `Tarefa "${task.name}" criada`,
      req,
    });

    res.status(201).json({ message: 'Tarefa criada.', task });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/admin/projects/:projectId/tasks/batch ────────
const createManyTasks = async (req, res, next) => {
  try {
    const { tasks: taskNames } = req.body;
    const tasks = await taskService.createManyTasks(req.params.projectId, taskNames);
    res.status(201).json({ message: `${tasks.length} tarefas criadas.`, tasks });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/projects/:projectId/tasks/:taskId/toggle ────
const toggleTask = async (req, res, next) => {
  try {
    const task = await taskService.toggleTask(
      req.params.taskId,
      req.params.projectId,
      req.user.id
    );

    await logService.log({
      userId: req.user.id,
      projectId: req.params.projectId,
      taskId: task.id,
      action: task.is_completed ? 'TASK_COMPLETED' : 'TASK_UNCOMPLETED',
      description: `Tarefa "${task.name}" marcada como ${task.is_completed ? 'concluída' : 'pendente'}`,
      req,
    });

    res.json({ message: 'Tarefa atualizada.', task });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/admin/tasks/:taskId ───────────────────────────
const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.params.taskId, req.body);
    res.json({ message: 'Tarefa atualizada.', task });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/admin/tasks/:taskId ────────────────────────
const deleteTask = async (req, res, next) => {
  try {
    await taskService.deleteTask(req.params.taskId);
    res.json({ message: 'Tarefa excluída.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listTasks, createTask, createManyTasks, toggleTask, updateTask, deleteTask };
