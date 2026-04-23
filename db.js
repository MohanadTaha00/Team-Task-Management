// Pure-JS JSON-file store. No native deps, works on any Node version.
// The whole workspace is small (a team of a few people and their tasks),
// so we keep everything in memory and flush to disk on every write.

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'tasks.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function loadState() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], tasks: [], nextUserId: 1, nextTaskId: 1 };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read data file, starting fresh:', err.message);
    return { users: [], tasks: [], nextUserId: 1, nextTaskId: 1 };
  }
}

let state = loadState();

function save() {
  // Atomic write: write to a temp file and rename, so a crash mid-write
  // can never leave a half-written JSON file behind.
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function now() { return new Date().toISOString(); }

// ---------- users ----------
const users = {
  list() {
    return state.users.map(u => ({
      id: u.id, username: u.username, full_name: u.full_name, role: u.role
    }));
  },
  findById(id) {
    return state.users.find(u => u.id === Number(id)) || null;
  },
  findByUsername(username) {
    return state.users.find(u => u.username === username) || null;
  },
  create({ username, password, full_name, role }) {
    const user = {
      id: state.nextUserId++,
      username,
      password_hash: bcrypt.hashSync(password, 10),
      full_name,
      role,
      created_at: now()
    };
    state.users.push(user);
    save();
    return user;
  },
  delete(id) {
    id = Number(id);
    const before = state.users.length;
    state.users = state.users.filter(u => u.id !== id);
    // Cascade: remove tasks assigned to or created by this user.
    state.tasks = state.tasks.filter(
      t => t.assignee_id !== id && t.created_by !== id
    );
    const removed = before !== state.users.length;
    if (removed) save();
    return removed;
  }
};

// ---------- tasks ----------
function decorate(task) {
  const assignee = users.findById(task.assignee_id);
  const creator = users.findById(task.created_by);
  return {
    ...task,
    assignee_username: assignee ? assignee.username : null,
    assignee_name: assignee ? assignee.full_name : 'Unknown',
    creator_username: creator ? creator.username : null
  };
}

const tasks = {
  listAll() {
    return [...state.tasks]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(decorate);
  },
  listForUser(userId) {
    userId = Number(userId);
    return [...state.tasks]
      .filter(t => t.assignee_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(decorate);
  },
  findById(id) {
    return state.tasks.find(t => t.id === Number(id)) || null;
  },
  create({ title, description, priority, due_date, assignee_id, created_by }) {
    const task = {
      id: state.nextTaskId++,
      title,
      description: description || '',
      status: 'pending',
      priority: priority || 'medium',
      due_date: due_date || null,
      assignee_id: Number(assignee_id),
      created_by: Number(created_by),
      created_at: now(),
      updated_at: now()
    };
    state.tasks.push(task);
    save();
    return task;
  },
  updateStatus(id, status) {
    const task = this.findById(id);
    if (!task) return false;
    task.status = status;
    task.updated_at = now();
    save();
    return true;
  },
  delete(id) {
    id = Number(id);
    const before = state.tasks.length;
    state.tasks = state.tasks.filter(t => t.id !== id);
    const removed = before !== state.tasks.length;
    if (removed) save();
    return removed;
  }
};

// ---------- first-run seeding ----------
function seed() {
  if (state.users.length > 0) return;

  const defaults = [
    { username: 'admin', password: 'admin123', full_name: 'Team Lead',   role: 'admin'  },
    { username: 'alice', password: 'alice123', full_name: 'Alice Smith', role: 'member' },
    { username: 'bob',   password: 'bob123',   full_name: 'Bob Johnson', role: 'member' },
    { username: 'carol', password: 'carol123', full_name: 'Carol Davis', role: 'member' }
  ];
  defaults.forEach(u => users.create(u));

  const admin = users.findByUsername('admin').id;
  const alice = users.findByUsername('alice').id;
  const bob = users.findByUsername('bob').id;

  tasks.create({ title: 'Design homepage mockup', description: 'Prepare 2 variations for review.', priority: 'high',   assignee_id: alice, created_by: admin });
  tasks.updateStatus(1, 'in_progress');
  tasks.create({ title: 'Write API documentation', description: 'Cover all public endpoints.',     priority: 'medium', assignee_id: alice, created_by: admin });
  tasks.create({ title: 'Fix login bug',           description: 'Session expires too early.',      priority: 'high',   assignee_id: bob,   created_by: admin });

  console.log('Seeded default users. Log in with admin/admin123 or alice/alice123');
}
seed();

module.exports = { users, tasks };
