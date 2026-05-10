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

// Helper: check if a user is a member of a project (any role)
async function isUserInProject(userId, projectId) {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId }
  });
  return !!member;
}

// Create a task (Admin only)
router.post('/project/:projectId', async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { title, description, dueDate, priority, assignedTo } = req.body;
  const userId = req.userId;

  // 1. Check if current user is Admin of this project
  const role = await getUserRoleInProject(userId, projectId);
  if (role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden: Only project admins can create tasks' });
  }

  // 2. Validate required fields
  if (!title || !dueDate || !assignedTo) {
    return res.status(400).json({ error: 'Title, due date, and assigned user are required' });
  }

  // 3. Check that assignedTo user exists
  const assignee = await prisma.user.findUnique({ where: { id: assignedTo } });
  if (!assignee) {
    return res.status(404).json({ error: 'Assigned user not found' });
  }

  // 4. Verify the assigned user is a member of this project
  const isMember = await isUserInProject(assignedTo, projectId);
  if (!isMember) {
    return res.status(400).json({ error: 'Assigned user is not a member of this project. Add them first.' });
  }

  // 5. Create task
  const task = await prisma.task.create({
    data: {
      title,
      description: description || '',
      dueDate: new Date(dueDate),
      priority: priority || 'Medium',
      status: 'To Do',
      projectId,
      assignedTo,
      createdBy: userId
    }
  });
  res.json(task);
});

// Get all tasks visible to the current user (based on role)
router.get('/', async (req, res) => {
  const userId = req.userId;
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true, role: true }
  });
  const projectIds = memberships.map(m => m.projectId);

  if (projectIds.length === 0) {
    return res.json([]);
  }

  let tasks;
  if (memberships.some(m => m.role === 'Admin')) {
    // Admin sees all tasks of projects they belong to
    tasks = await prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      include: { assignee: true, project: true }
    });
  } else {
    // Member sees only tasks assigned to themselves
    tasks = await prisma.task.findMany({
      where: { assignedTo: userId, projectId: { in: projectIds } },
      include: { assignee: true, project: true }
    });
  }
  res.json(tasks);
});

// Update a task (Admin can update any field; Member can only update status of assigned tasks)
router.patch('/:id', async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { status, title, description, dueDate, priority, assignedTo } = req.body;
  const userId = req.userId;

  // 1. Fetch task with its project
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true }
  });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // 2. Determine user's role in the project
  const role = await getUserRoleInProject(userId, task.projectId);
  const isAssigned = task.assignedTo === userId;

  // 3. Authorize
  if (role !== 'Admin' && !isAssigned) {
    return res.status(403).json({ error: 'Forbidden: You cannot update this task' });
  }

  // 4. Build update object based on role
  let updateData = {};
  if (role === 'Admin') {
    // Admin can update everything
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) {
      // If reassigning, verify new assignee is a project member
      if (assignedTo !== task.assignedTo) {
        const isMember = await isUserInProject(assignedTo, task.projectId);
        if (!isMember) {
          return res.status(400).json({ error: 'New assignee is not a project member' });
        }
        updateData.assignedTo = assignedTo;
      }
    }
    if (status !== undefined) updateData.status = status;
  } else if (isAssigned && status !== undefined) {
    // Member can only change status of their own tasks
    updateData.status = status;
  } else {
    return res.status(403).json({ error: 'You are not allowed to modify this field' });
  }

  // 5. Update task
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: updateData
  });
  res.json(updated);
});

module.exports = router;