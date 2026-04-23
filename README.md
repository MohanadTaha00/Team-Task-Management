# Team Tasks

A simple task-management website for small working teams.

- Every team member has a unique **username + password** (passwords are hashed with bcrypt).
- When a member logs in they see **only the tasks assigned to them** and can update their status.
- An **admin** role can create team members and create / assign / delete tasks for anyone.

## Tech stack

- **Backend:** Node.js + Express, session-based authentication (`express-session`, `bcryptjs`)
- **Storage:** Plain JSON file at `./data/tasks.json` — no database server, no native modules, works on any Node version
- **Frontend:** Plain HTML + CSS + vanilla JavaScript

## Getting started

Requires **Node.js 18+** (tested on Node 24).

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

The data file is created automatically in `./data/tasks.json` on first launch
and seeded with demo accounts and a few sample tasks.

### Demo accounts

| Role   | Username | Password   |
| ------ | -------- | ---------- |
| Admin  | `admin`  | `admin123` |
| Member | `alice`  | `alice123` |
| Member | `bob`    | `bob123`   |
| Member | `carol`  | `carol123` |

> Log in as `admin` to open the **Admin** tab, where you can create new users and assign tasks.
> Log in as any member to see only their own tasks.

## Project structure

```
.
├── server.js          # Express app + REST API
├── db.js              # JSON-file data store + seed data
├── package.json
├── data/              # JSON data file (created at runtime)
└── public/            # Static frontend
    ├── index.html     # Login page
    ├── dashboard.html # "My Tasks" view for every user
    ├── admin.html     # Admin panel (admins only)
    ├── css/styles.css
    └── js/shared.js
```

## REST API

All endpoints use JSON. Session cookie is set on `POST /api/login`.

| Method  | Endpoint                  | Who           | Purpose                               |
| ------- | ------------------------- | ------------- | ------------------------------------- |
| POST    | `/api/login`              | anyone        | Sign in with username + password      |
| POST    | `/api/logout`             | signed-in     | End session                           |
| GET     | `/api/me`                 | signed-in     | Current user info                     |
| GET     | `/api/tasks`              | signed-in     | Member: own tasks. Admin: all tasks   |
| POST    | `/api/tasks`              | admin         | Create a task and assign it           |
| PATCH   | `/api/tasks/:id/status`   | assignee/admin| Update task status                    |
| DELETE  | `/api/tasks/:id`          | admin         | Remove a task                         |
| GET     | `/api/users`              | signed-in     | List team members                     |
| POST    | `/api/users`              | admin         | Create a new user                     |
| DELETE  | `/api/users/:id`          | admin         | Delete a user (cascades their tasks)  |

## Security notes

This project is intentionally small and classroom-friendly. Before deploying to
the real internet you should:

1. Set a strong `SESSION_SECRET` environment variable.
2. Put the app behind HTTPS and set `cookie.secure = true` in `server.js`.
3. Add rate-limiting on `/api/login`.
