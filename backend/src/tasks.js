const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

async function getUserRoleInProject(userId, projectId) {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId }
  });
  return member ? member.role : null;
}

router.post('/project/:projectId', async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { title, description, dueDate, priority, assignedTo } = req.body;
  const userId = req.userId;
  const role = await getUserRoleInProject(userId, projectId);
  if (role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
  const task = await prisma.task.create({
    data: {
      title, description, dueDate: new Date(dueDate), priority,
      status: 'To Do', projectId, assignedTo, createdBy: userId
    }
  });
  res.json(task);
});

router.get('/', async (req, res) => {
  const userId = req.userId;
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true, role: true }
  });
  const projectIds = memberships.map(m => m.projectId);
  let tasks;
  if (memberships.some(m => m.role === 'Admin')) {
    tasks = await prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      include: { assignee: true, project: true }
    });
  } else {
    tasks = await prisma.task.findMany({
      where: { assignedTo: userId, projectId: { in: projectIds } },
      include: { assignee: true, project: true }
    });
  }
  res.json(tasks);
});

router.patch('/:id', async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { status, title, description, dueDate, priority, assignedTo } = req.body;
  const userId = req.userId;
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const role = await getUserRoleInProject(userId, task.projectId);
  const isAssigned = task.assignedTo === userId;
  if (role !== 'Admin' && !isAssigned) return res.status(403).json({ error: 'Forbidden' });
  let updateData = {};
  if (role === 'Admin') {
    updateData = { title, description, dueDate: dueDate ? new Date(dueDate) : undefined, priority, assignedTo, status };
  } else if (isAssigned && status) {
    updateData = { status };
  } else {
    return res.status(403).json({ error: 'Cannot update that field' });
  }
  const updated = await prisma.task.update({ where: { id: taskId }, data: updateData });
  res.json(updated);
});

module.exports = router;