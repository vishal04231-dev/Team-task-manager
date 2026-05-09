const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

router.get('/', async (req, res) => {
  const userId = req.userId;
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true }
  });
  const projectIds = memberships.map(m => m.projectId);
  if (projectIds.length === 0) {
    return res.json({ totalTasks: 0, byStatus: {}, perUser: [], overdue: [] });
  }
  const allTasks = await prisma.task.findMany({
    where: { projectId: { in: projectIds } },
    include: { assignee: true }
  });
  const totalTasks = allTasks.length;
  const byStatus = {
    'To Do': allTasks.filter(t => t.status === 'To Do').length,
    'In Progress': allTasks.filter(t => t.status === 'In Progress').length,
    'Done': allTasks.filter(t => t.status === 'Done').length,
  };
  const perUserMap = {};
  allTasks.forEach(t => {
    const name = t.assignee.name;
    perUserMap[name] = (perUserMap[name] || 0) + 1;
  });
  const perUser = Object.entries(perUserMap).map(([user, count]) => ({ user, count }));
  const now = new Date();
  const overdue = allTasks.filter(t => new Date(t.dueDate) < now && t.status !== 'Done');
  res.json({ totalTasks, byStatus, perUser, overdue });
});

module.exports = router;