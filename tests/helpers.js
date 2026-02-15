import Database from 'better-sqlite3'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export const createTestDb = () => {
  const dir = mkdtempSync(join(tmpdir(), 'bd-eye-test-'))
  const dbPath = join(dir, 'test.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE issues (
      id TEXT PRIMARY KEY, title TEXT, description TEXT, design TEXT,
      acceptance_criteria TEXT, notes TEXT, status TEXT, priority INTEGER,
      issue_type TEXT, assignee TEXT, created_at TEXT, updated_at TEXT,
      closed_at TEXT, deleted_at TEXT, metadata TEXT
    );
    CREATE TABLE dependencies (issue_id TEXT, depends_on_id TEXT, type TEXT);
    CREATE TABLE labels (issue_id TEXT, label TEXT);
    CREATE TABLE comments (id INTEGER PRIMARY KEY, issue_id TEXT, author TEXT, text TEXT, created_at TEXT);
    CREATE VIEW ready_issues AS SELECT * FROM issues WHERE status <> 'tombstone' AND deleted_at IS NULL
      AND id NOT IN (SELECT d.issue_id FROM dependencies d
        JOIN issues i2 ON i2.id = d.depends_on_id
        WHERE d.type = 'blocks' AND i2.status <> 'closed' AND i2.status <> 'tombstone' AND i2.deleted_at IS NULL);
    CREATE VIEW blocked_issues AS SELECT i.*, COUNT(d.depends_on_id) AS blocked_by_count
      FROM issues i JOIN dependencies d ON i.id = d.issue_id AND d.type = 'blocks'
      JOIN issues i2 ON i2.id = d.depends_on_id AND i2.status <> 'closed' AND i2.status <> 'tombstone' AND i2.deleted_at IS NULL
      WHERE i.status <> 'tombstone' AND i.deleted_at IS NULL
      GROUP BY i.id;
  `)
  return { db, dbPath, dir }
}

export const seedIssues = (db) => {
  const insert = db.prepare(`INSERT INTO issues
    (id, title, description, design, acceptance_criteria, notes, status, priority, issue_type, assignee, created_at, updated_at, closed_at, deleted_at, metadata)
    VALUES (?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, NULL, '{}')`)

  insert.run('issue-1', 'First issue', 'Description one', 'Some notes', 'open', 1, 'task', null, '2024-01-01', '2024-01-01', null)
  insert.run('issue-2', 'Second issue', 'Description two', '', 'open', 2, 'bug', 'alice', '2024-01-02', '2024-01-02', null)
  insert.run('issue-3', 'Third issue', 'Description three', '', 'closed', 1, 'feature', 'bob', '2024-01-03', '2024-01-03', '2024-01-10')
  insert.run('issue-4', 'Epic one', 'An epic', '', 'open', 0, 'epic', null, '2024-01-04', '2024-01-04', null)
  insert.run('issue-5', 'Blocked task', 'This is blocked', '', 'open', 2, 'task', null, '2024-01-05', '2024-01-05', null)
  insert.run('deleted-1', 'Deleted issue', 'Gone', '', 'open', 3, 'task', null, '2024-01-06', '2024-01-06', null)
  db.prepare("UPDATE issues SET deleted_at = '2024-01-07' WHERE id = 'deleted-1'").run()

  db.prepare("INSERT INTO dependencies (issue_id, depends_on_id, type) VALUES (?, ?, ?)").run('issue-5', 'issue-1', 'blocks')
  db.prepare("INSERT INTO dependencies (issue_id, depends_on_id, type) VALUES (?, ?, ?)").run('issue-2', 'issue-4', 'parent-child')

  db.prepare("INSERT INTO labels (issue_id, label) VALUES (?, ?)").run('issue-1', 'backend')
  db.prepare("INSERT INTO labels (issue_id, label) VALUES (?, ?)").run('issue-1', 'urgent')
  db.prepare("INSERT INTO labels (issue_id, label) VALUES (?, ?)").run('issue-2', 'frontend')

  db.prepare("INSERT INTO comments (issue_id, author, text, created_at) VALUES (?, ?, ?, ?)").run('issue-1', 'alice', 'Looks good', '2024-01-02')
  db.prepare("INSERT INTO comments (issue_id, author, text, created_at) VALUES (?, ?, ?, ?)").run('issue-1', 'bob', 'Agreed', '2024-01-03')
}
