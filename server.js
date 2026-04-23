const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { users, tasks } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
  })
);

// ---------- middleware ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ---------- auth routes ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  const user = users.findByUsername(String(username).trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  req.session.fullName = user.full_name;

  res.json({
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = users.findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    id: user.id, username: user.username, full_name: user.full_name, role: user.role
  });
});

// ---------- task routes ----------
// Members see only their own tasks; admins see everything.
app.get('/api/tasks', requireAuth, (req, res) => {
  const rows = req.session.role === 'admin'
    ? tasks.listAll()
    : tasks.listForUser(req.session.userId);
  res.json(rows);
});

app.post('/api/tasks', requireAdmin, (req, res) => {
  const { title, description, priority, due_date, assignee_id } = req.body || {};
  if (!title || !assignee_id) return res.status(400).json({ error: 'Title and assignee are required' });
  if (priority && !['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  const assignee = users.findById(assignee_id);
  if (!assignee) return res.status(400).json({ error: 'Assignee does not exist' });

  const task = tasks.create({
    title: String(title).trim(),
    description: (description || '').trim(),
    priority: priority || 'medium',
    due_date: due_date || null,
    assignee_id: Number(assignee_id),
    created_by: req.session.userId
  });
  res.status(201).json({ id: task.id });
});

// Update task status. Members can only touch tasks assigned to them.
app.patch('/api/tasks/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const task = tasks.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.session.role !== 'admin' && task.assignee_id !== req.session.userId) {
    return res.status(403).json({ error: 'You cannot update a task assigned to someone else' });
  }
  tasks.updateStatus(req.params.id, status);
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', requireAdmin, (req, res) => {
  const removed = tasks.delete(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Task not found' });
  res.json({ ok: true });
});

// ---------- user management (admin) ----------
app.get('/api/users', requireAuth, (req, res) => {
  const rows = users
    .list()
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  res.json(rows);
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, full_name, role } = req.body || {};
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Username, password, and full name are required' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (role && !['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const trimmed = String(username).trim();
  if (users.findByUsername(trimmed)) return res.status(409).json({ error: 'Username already taken' });

  const user = users.create({
    username: trimmed,
    password,
    full_name: String(full_name).trim(),
    role: role || 'member'
  });
  res.status(201).json({ id: user.id });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.userId) return res.status(400).json({ error: 'You cannot delete your own account' });
  const removed = users.delete(id);
  if (!removed) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

// ---------- static frontend ----------
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Team Task Manager running at http://localhost:${PORT}`);
});
