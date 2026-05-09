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

// Create a new project (creator becomes Admin)
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  const userId = req.userId;
  try {
    const project = await prisma.project.create({
      data: { name, description, createdBy: userId }
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId, role: 'Admin' }
    });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all projects for the current user (where they are a member)
router.get('/', async (req, res) => {
  const userId = req.userId;
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: { project: true }
  });
  const projects = memberships.map(m => m.project);
  res.json(projects);
});

// Get all members of a specific project (with user details)
router.get('/:id/members', async (req, res) => {
  const projectId = parseInt(req.params.id);
  const userId = req.userId;
  // Check if the user belongs to this project (authorization)
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId }
  });
  if (!member) return res.status(403).json({ error: 'Forbidden' });
  
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  // Format response: id, name, email, role
  res.json(members.map(m => ({
    id: m.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role
  })));
});

// Add a member to a project (Admin only)
router.post('/:id/members', async (req, res) => {
  const projectId = parseInt(req.params.id);
  const { email, role } = req.body;
  const userId = req.userId;
  const userRole = await getUserRoleInProject(userId, projectId);
  if (userRole !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
  const userToAdd = await prisma.user.findUnique({ where: { email } });
  if (!userToAdd) return res.status(404).json({ error: 'User not found' });
  await prisma.projectMember.create({
    data: { projectId, userId: userToAdd.id, role: role || 'Member' }
  });
  res.json({ message: 'Member added' });
});

// Remove a member from a project (Admin only)
router.delete('/:id/members/:userId', async (req, res) => {
  const projectId = parseInt(req.params.id);
  const memberId = parseInt(req.params.userId);
  const userId = req.userId;
  const userRole = await getUserRoleInProject(userId, projectId);
  if (userRole !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
  await prisma.projectMember.deleteMany({
    where: { projectId, userId: memberId }
  });
  res.json({ message: 'Member removed' });
});

// ===== NEW: Delete a project (Admin only, cascades tasks & members) =====
router.delete('/:id', async (req, res) => {
  const projectId = parseInt(req.params.id);
  const userId = req.userId;
  const userRole = await getUserRoleInProject(userId, projectId);
  if (userRole !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
  
  try {
    // Delete all tasks, project members, then the project itself
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { projectId } }),
      prisma.projectMember.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } })
    ]);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;