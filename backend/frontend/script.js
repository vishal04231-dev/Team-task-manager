const API_URL = '/api';

let authToken = null;
let currentUser = null;

// ---------- Helper: Toast Notifications ----------
function showToast(message, type = 'success') {
  let toast = document.getElementById('customToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'customToast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '40px';
    toast.style.fontWeight = '500';
    toast.style.fontSize = '14px';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
    toast.style.zIndex = '2000';
    toast.style.animation = 'fadeInUp 0.3s ease';
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// ---------- Modal Helpers ----------
function openModal(title, bodyHtml, onConfirm) {
  const overlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  modalTitle.innerText = title;
  modalBody.innerHTML = bodyHtml;
  overlay.style.display = 'flex';
  const confirmBtn = document.getElementById('modalConfirmBtn');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (onConfirm) onConfirm();
      closeModal();
    };
  }
  const cancelBtn = document.getElementById('modalCancelBtn');
  if (cancelBtn) cancelBtn.onclick = closeModal;
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

// ---------- API Call ----------
async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

// ---------- Helper: Escape HTML ----------
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ---------- Auth UI ----------
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authError = document.getElementById('auth-error');

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    loginForm.style.display = tab === 'login' ? 'block' : 'none';
    signupForm.style.display = tab === 'signup' ? 'block' : 'none';
    authError.innerText = '';
  });
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(currentUser));
    showMainApp();
  } catch (err) {
    authError.innerText = err.message;
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  try {
    await apiCall('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(currentUser));
    showMainApp();
  } catch (err) {
    authError.innerText = err.message;
  }
});

function showMainApp() {
  authScreen.style.display = 'none';
  mainApp.style.display = 'flex';

  // Update user profile in sidebar
  if (currentUser) {
    const userNameSpan = document.getElementById('userName');
    const userEmailSpan = document.getElementById('userEmail');
    if (userNameSpan) userNameSpan.innerText = currentUser.name || 'User';
    if (userEmailSpan) userEmailSpan.innerText = currentUser.email || '';
  }

  loadDashboard();
  attachNavEvents();
  document.getElementById('logoutBtn').addEventListener('click', logout);

  const darkToggle = document.getElementById('darkModeToggle');
  darkToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark', darkToggle.checked);
    localStorage.setItem('darkMode', darkToggle.checked);
  });
  const savedDark = localStorage.getItem('darkMode') === 'true';
  if (savedDark) {
    darkToggle.checked = true;
    document.body.classList.add('dark');
  }

  // Show quick task button and attach event
  const quickBtn = document.getElementById('quickTaskBtn');
  if (quickBtn) {
    quickBtn.style.display = 'inline-flex';
    quickBtn.onclick = () => showCreateTaskModal();
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  authScreen.style.display = 'flex';
  mainApp.style.display = 'none';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('signup-name').value = '';
  document.getElementById('signup-email').value = '';
  document.getElementById('signup-password').value = '';
}

function attachNavEvents() {
  document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
      link.classList.add('active');

      const titleMap = { dashboard: 'Dashboard', projects: 'Projects', tasks: 'Tasks' };
      const pageTitle = document.getElementById('pageTitle');
      if (pageTitle) pageTitle.innerText = titleMap[page] || 'FlowTask';

      if (page === 'dashboard') loadDashboard();
      else if (page === 'projects') loadProjects();
      else if (page === 'tasks') loadTasks();
    });
  });
}

// ---------- Dashboard (enhanced with progress, upcoming, recent) ----------
async function loadDashboard() {
  const container = document.getElementById('page-content');
  container.innerHTML = '<div class="card">Loading dashboard...</div>';
  try {
    const data = await apiCall('/dashboard?_=' + Date.now());
    const { totalTasks, byStatus, perUser, overdue } = data;
    const total = totalTasks;
    const done = byStatus['Done'] || 0;
    const progressPercent = total === 0 ? 0 : (done / total) * 100;

    // Fetch all tasks for upcoming/recent widgets
    const allTasks = await apiCall('/tasks');
    const now = new Date();
    const upcoming = allTasks.filter(t => new Date(t.dueDate) >= now && t.status !== 'Done')
      .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0,5);
    const recent = allTasks.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,5);

    container.innerHTML = `
      <h2>Dashboard</h2>
      <div class="dashboard-stats">
        <div class="stat-card"><h3>${totalTasks}</h3><p>Total Tasks</p></div>
        <div class="stat-card"><h3>${byStatus['To Do'] || 0}</h3><p>To Do</p></div>
        <div class="stat-card"><h3>${byStatus['In Progress'] || 0}</h3><p>In Progress</p></div>
        <div class="stat-card"><h3>${byStatus['Done'] || 0}</h3><p>Done</p></div>
      </div>
      <div class="card">
        <h3>Completion Progress</h3>
        <div class="progress-container"><div class="progress-bar" style="width: ${progressPercent}%;"></div></div>
        <p>${done} of ${total} tasks completed (${Math.round(progressPercent)}%)</p>
      </div>
      <div class="card">
        <h3>Tasks per User</h3>
        <ul>${perUser.map(u => `<li>${escapeHtml(u.user)}: ${u.count} tasks</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h3>Upcoming Tasks</h3>
        ${upcoming.length === 0 ? '<p>No upcoming tasks 🎉</p>' : upcoming.map(t => `<div class="task-card"><strong>${escapeHtml(t.title)}</strong> - Due ${new Date(t.dueDate).toLocaleDateString()}</div>`).join('')}
      </div>
      <div class="card">
        <h3>Recent Activity</h3>
        ${recent.length === 0 ? '<p>No recent tasks</p>' : recent.map(t => `<div class="task-card"><strong>${escapeHtml(t.title)}</strong> - created ${new Date(t.createdAt).toLocaleDateString()}</div>`).join('')}
      </div>
      <div class="card">
        <h3>Overdue Tasks</h3>
        ${overdue.length === 0 ? '<p>None 🎉</p>' : overdue.map(t => `<div class="task-card overdue-task"><strong>${escapeHtml(t.title)}</strong> - Due ${new Date(t.dueDate).toLocaleDateString()}</div>`).join('')}
      </div>
      <div style="text-align: center; margin-top: 1rem;">
        <button class="btn-secondary" onclick="loadDashboard()">⟳ Refresh Dashboard</button>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card error">Error: ${err.message}</div>`;
  }
}

// ---------- Projects (member chips) ----------
async function loadProjects() {
  const container = document.getElementById('page-content');
  container.innerHTML = '<div class="loading-spinner">Loading projects...</div>';
  try {
    const projects = await apiCall('/projects');
    if (projects.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
          <p>No projects yet. Click "New Project" to get started.</p>
          <button class="btn-primary" onclick="showCreateProjectModal()">+ New Project</button>
        </div>
      `;
      return;
    }

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <h2 style="margin:0">Projects</h2>
        <button class="btn-primary" onclick="showCreateProjectModal()">+ New Project</button>
      </div>
      <div class="project-grid">
    `;

    for (const p of projects) {
      const members = await apiCall(`/projects/${p.id}/members`);
      const adminMember = members.find(m => m.role === 'Admin');
      const otherMembers = members.filter(m => m.role !== 'Admin');
      const currentUserIsAdmin = members.some(m => m.userId === currentUser?.id && m.role === 'Admin');

      html += `
        <div class="project-card">
          <div class="project-header">
            <h3>${escapeHtml(p.name)}</h3>
            ${currentUserIsAdmin ? `<button class="delete-project-btn" data-id="${p.id}" title="Delete Project"><i class="fas fa-trash-alt"></i></button>` : ''}
          </div>
          <p class="project-desc">${p.description ? escapeHtml(p.description) : 'No description'}</p>
          <div class="project-meta">
            <span><i class="far fa-calendar-alt"></i> ${new Date(p.createdAt).toLocaleDateString()}</span>
            <span><i class="fas fa-users"></i> ${members.length} member${members.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="project-admin">
            <strong>Admin:</strong> ${escapeHtml(adminMember?.name || 'Unknown')}
          </div>
          <div class="project-members">
            <strong>Members (${otherMembers.length}):</strong>
            <div class="member-chips">
              ${otherMembers.map(m => `<span class="member-chip">${escapeHtml(m.name)}</span>`).join('')}
            </div>
          </div>
          <button class="btn-secondary add-member-btn" data-id="${p.id}">+ Add Member</button>
        </div>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;

    document.querySelectorAll('.add-member-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = parseInt(btn.dataset.id);
        showAddMemberModal(projectId);
      });
    });
    document.querySelectorAll('.delete-project-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const projectId = parseInt(btn.dataset.id);
        if (confirm('Are you sure you want to delete this project? All tasks will be lost.')) {
          try {
            await apiCall(`/projects/${projectId}`, { method: 'DELETE' });
            showToast('Project deleted successfully', 'success');
            loadProjects();
            loadDashboard();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="card error">Error: ${err.message}</div>`;
  }
}

// ---------- Create Project Modal ----------
window.showCreateProjectModal = function() {
  const bodyHtml = `
    <input type="text" id="projectName" placeholder="Project Name" required>
    <textarea id="projectDesc" rows="3" placeholder="Description (optional)"></textarea>
    <div class="modal-footer">
      <button class="btn-modal btn-secondary" id="modalCancelBtn">Cancel</button>
      <button class="btn-modal btn-primary" id="modalConfirmBtn">Create</button>
    </div>
  `;
  openModal('Create New Project', bodyHtml, async () => {
    const name = document.getElementById('projectName').value.trim();
    if (!name) return showToast('Project name required', 'error');
    const description = document.getElementById('projectDesc').value;
    try {
      await apiCall('/projects', { method: 'POST', body: JSON.stringify({ name, description }) });
      showToast(`Project "${name}" created`, 'success');
      loadProjects();
      loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
};

// ---------- Add Member Modal ----------
window.showAddMemberModal = async function(projectId) {
  let existingMembers = [];
  try {
    existingMembers = await apiCall(`/projects/${projectId}/members`);
  } catch(e) { /* ignore */ }
  const memberListHtml = existingMembers.map(m => `<li>${escapeHtml(m.name)} (${m.role})</li>`).join('');
  const bodyHtml = `
    <div style="max-height: 160px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 16px; margin-bottom: 1rem;">
      <strong>Current Members:</strong>
      <ul>${memberListHtml || '<li>No members yet</li>'}</ul>
    </div>
    <input type="email" id="memberEmail" placeholder="Member's Email" required>
    <select id="memberRole" style="margin-top: 0.5rem; width:100%">
      <option value="Member">Member</option>
      <option value="Admin">Admin</option>
    </select>
    <div class="modal-footer">
      <button class="btn-modal btn-secondary" id="modalCancelBtn">Cancel</button>
      <button class="btn-modal btn-primary" id="modalConfirmBtn">Add Member</button>
    </div>
  `;
  openModal('Add Team Member', bodyHtml, async () => {
    const email = document.getElementById('memberEmail').value.trim();
    const role = document.getElementById('memberRole').value;
    if (!email) return showToast('Email is required', 'error');
    try {
      await apiCall(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role })
      });
      showToast(`${email} added as ${role}`, 'success');
      loadProjects();
      loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
};

// ---------- Tasks with Edit/Delete Icons and Enhanced UI ----------
async function loadTasks() {
  const container = document.getElementById('page-content');
  container.innerHTML = '<div class="card">Loading tasks...</div>';
  try {
    const tasks = await apiCall('/tasks');
    const projects = await apiCall('/projects');
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Tasks</h2>
        <button class="btn-primary" onclick="showCreateTaskModal()">+ New Task</button>
      </div>
      <div>
        ${tasks.length === 0 ? '<p>No tasks yet.</p>' : tasks.map(t => `
          <div class="task-card priority-${t.priority.toLowerCase()}" id="task-${t.id}">
            <div class="task-info">
              <strong>${escapeHtml(t.title)}</strong> (${t.status})<br>
              <small>Project: ${escapeHtml(t.project.name)} | Assigned to: ${escapeHtml(t.assignee.name)} | Due: ${new Date(t.dueDate).toLocaleDateString()}</small>
            </div>
            <div class="task-actions">
              <select onchange="updateTaskStatus(${t.id}, this.value)" class="status-select">
                <option ${t.status === 'To Do' ? 'selected' : ''}>To Do</option>
                <option ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option ${t.status === 'Done' ? 'selected' : ''}>Done</option>
              </select>
              <button class="edit-task" onclick="editTask(${t.id})"><i class="fas fa-edit"></i></button>
              <button class="delete-task" onclick="deleteTask(${t.id})"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    window.updateTaskStatus = updateTaskStatus;
    window.editTask = editTask;
    window.deleteTask = deleteTask;
    window.showCreateTaskModal = showCreateTaskModal;
  } catch (err) {
    container.innerHTML = `<div class="card error">Error: ${err.message}</div>`;
  }
}

async function updateTaskStatus(taskId, newStatus) {
  try {
    await apiCall(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    showToast(`Task status updated to ${newStatus}`, 'success');
    loadTasks();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task permanently?')) return;
  try {
    await apiCall(`/tasks/${taskId}`, { method: 'DELETE' });
    showToast('Task deleted successfully', 'success');
    loadTasks();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editTask(taskId) {
  try {
    // Fetch current task details
    const tasks = await apiCall('/tasks');
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');
    const projects = await apiCall('/projects');
    let projectOptions = '';
    projects.forEach(p => {
      projectOptions += `<option value="${p.id}" ${p.id === task.projectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`;
    });
    const bodyHtml = `
      <select id="editProjectId">${projectOptions}</select>
      <input id="editTitle" value="${escapeHtml(task.title)}" placeholder="Title" required>
      <textarea id="editDesc" rows="2" placeholder="Description">${escapeHtml(task.description || '')}</textarea>
      <input type="date" id="editDueDate" value="${task.dueDate.slice(0,10)}" required>
      <select id="editPriority">
        <option ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
        <option ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
        <option ${task.priority === 'High' ? 'selected' : ''}>High</option>
      </select>
      <select id="editStatus">
        <option ${task.status === 'To Do' ? 'selected' : ''}>To Do</option>
        <option ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
        <option ${task.status === 'Done' ? 'selected' : ''}>Done</option>
      </select>
      <div class="modal-footer">
        <button class="btn-modal btn-secondary" id="modalCancelBtn">Cancel</button>
        <button class="btn-modal btn-primary" id="modalConfirmBtn">Update</button>
      </div>
    `;
    openModal('Edit Task', bodyHtml, async () => {
      const updated = {
        title: document.getElementById('editTitle').value,
        description: document.getElementById('editDesc').value,
        dueDate: document.getElementById('editDueDate').value,
        priority: document.getElementById('editPriority').value,
        status: document.getElementById('editStatus').value,
        projectId: parseInt(document.getElementById('editProjectId').value)
      };
      try {
        await apiCall(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(updated) });
        showToast('Task updated successfully', 'success');
        loadTasks();
        loadDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------- Task Creation Modal (Member Dropdown) ----------
window.showCreateTaskModal = async function() {
  try {
    const projects = await apiCall('/projects');
    if (projects.length === 0) {
      showToast('You need at least one project before creating a task.', 'error');
      return;
    }

    let projectOptions = '';
    projects.forEach(p => {
      projectOptions += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    });

    const bodyHtml = `
      <div>
        <label>Project:</label>
        <select id="taskProjectId">${projectOptions}</select>
      </div>
      <div style="margin-top: 0.75rem;">
        <label>Task Title:</label>
        <input type="text" id="taskTitle" placeholder="Task Title" required>
      </div>
      <div style="margin-top: 0.75rem;">
        <label>Description:</label>
        <textarea id="taskDesc" rows="2" placeholder="Description"></textarea>
      </div>
      <div style="margin-top: 0.75rem;">
        <label>Due Date:</label>
        <input type="date" id="taskDueDate" required>
      </div>
      <div style="margin-top: 0.75rem;">
        <label>Priority:</label>
        <select id="taskPriority">
          <option value="Low">Low</option>
          <option value="Medium" selected>Medium</option>
          <option value="High">High</option>
        </select>
      </div>
      <div style="margin-top: 0.75rem;">
        <label>Assign to Member:</label>
        <select id="taskAssignedTo" required>
          <option value="">-- Select member --</option>
        </select>
      </div>
      <div class="modal-footer" style="margin-top: 1rem;">
        <button class="btn-modal btn-secondary" id="modalCancelBtn">Cancel</button>
        <button class="btn-modal btn-primary" id="modalConfirmBtn">Create Task</button>
      </div>
    `;
    openModal('Create New Task', bodyHtml, async () => {
      const projectId = document.getElementById('taskProjectId').value;
      const title = document.getElementById('taskTitle').value.trim();
      const description = document.getElementById('taskDesc').value;
      const dueDate = document.getElementById('taskDueDate').value;
      const priority = document.getElementById('taskPriority').value;
      const assignedTo = document.getElementById('taskAssignedTo').value;
      if (!title || !dueDate || !assignedTo) {
        return showToast('Please fill all required fields', 'error');
      }
      try {
        await apiCall(`/tasks/project/${projectId}`, {
          method: 'POST',
          body: JSON.stringify({ title, description, dueDate, priority, assignedTo: parseInt(assignedTo) })
        });
        showToast('Task created successfully', 'success');
        loadTasks();
        loadDashboard();
        closeModal();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    const projectSelect = document.getElementById('taskProjectId');
    const memberSelect = document.getElementById('taskAssignedTo');

    async function loadMembersForProject(projectId) {
      memberSelect.innerHTML = '<option value="">-- Loading members --</option>';
      try {
        const members = await apiCall(`/projects/${projectId}/members`);
        memberSelect.innerHTML = '<option value="">-- Select member --</option>';
        members.forEach(m => {
          const option = document.createElement('option');
          option.value = m.id;
          option.textContent = `${escapeHtml(m.name)} (${m.role})`;
          memberSelect.appendChild(option);
        });
        if (members.length === 0) {
          memberSelect.innerHTML = '<option value="">-- No members in this project --</option>';
          showToast('This project has no members. Add members first.', 'error');
        }
      } catch (err) {
        memberSelect.innerHTML = '<option value="">-- Error loading members --</option>';
        showToast('Failed to load members', 'error');
      }
    }

    loadMembersForProject(projectSelect.value);
    projectSelect.addEventListener('change', () => {
      loadMembersForProject(projectSelect.value);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ---------- Auto-Login ----------
const savedToken = localStorage.getItem('token');
const savedUser = localStorage.getItem('user');
if (savedToken && savedUser) {
  authToken = savedToken;
  currentUser = JSON.parse(savedUser);
  showMainApp();
} else {
  authScreen.style.display = 'flex';
  mainApp.style.display = 'none';
}