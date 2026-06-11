const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'dashboard.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS tf (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    target_date TEXT NOT NULL,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS tf_member (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tf_id INTEGER NOT NULL,
    part TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (tf_id) REFERENCES tf(id)
  );

  CREATE TABLE IF NOT EXISTS work_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tf_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    checklist_item_id INTEGER,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (tf_id) REFERENCES tf(id),
    FOREIGN KEY (member_id) REFERENCES tf_member(id),
    FOREIGN KEY (checklist_item_id) REFERENCES tf_checklist(id)
  );

  CREATE TABLE IF NOT EXISTS uploaded_file (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_log_id INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    FOREIGN KEY (work_log_id) REFERENCES work_log(id)
  );

  CREATE TABLE IF NOT EXISTS generated_ppt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_log_id INTEGER NOT NULL,
    stored_path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (work_log_id) REFERENCES work_log(id)
  );

  CREATE TABLE IF NOT EXISTS tf_background (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tf_id INTEGER NOT NULL UNIQUE,
    background TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (tf_id) REFERENCES tf(id)
  );

  CREATE TABLE IF NOT EXISTS tf_background_file (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tf_id INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (tf_id) REFERENCES tf(id)
  );

  CREATE TABLE IF NOT EXISTS tf_checklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tf_id INTEGER NOT NULL,
    part TEXT NOT NULL,
    item_key TEXT NOT NULL,
    item_label TEXT NOT NULL,
    assignee_id INTEGER,
    target_date TEXT,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    FOREIGN KEY (tf_id) REFERENCES tf(id),
    FOREIGN KEY (assignee_id) REFERENCES tf_member(id)
  );

  CREATE TABLE IF NOT EXISTS tf_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tf_id INTEGER NOT NULL UNIQUE,
    title TEXT DEFAULT '',
    sections TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (tf_id) REFERENCES tf(id)
  );
`);

// 구버전 DB 컬럼 추가 대응
try { db.exec('ALTER TABLE work_log ADD COLUMN checklist_item_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE tf_background_file ADD COLUMN summary_json TEXT'); } catch {}

module.exports = db;
