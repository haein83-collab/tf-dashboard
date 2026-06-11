require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const MASTER_CHECKLIST = require('./checklist');
const { parseEvalHtml } = require('./parseEvalHtml');

const app = express();
const PORT = process.env.PORT || 3001;

// 정적 파일은 CORS 검사 전에 서빙 (Vite crossorigin 스크립트 호환)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,  // Vercel 배포 URL (예: https://tf-dashboard.vercel.app)
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error('CORS: not allowed'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'tf-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

const uploadDir = path.join(__dirname, 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

function requireAuth(req, res, next) {
  next(); // 비밀번호 인증 비활성화 중
}

// ── 인증 ──────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '비밀번호가 틀렸습니다' });
  }
});
app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/auth/check', (req, res) => {
  req.session.authenticated = true; // 비밀번호 없이 항상 인증
  res.json({ authenticated: true });
});

// ── TF CRUD ───────────────────────────────────────────
app.get('/api/tf', requireAuth, (req, res) => {
  const tfs = db.prepare('SELECT * FROM tf ORDER BY id DESC').all();
  const result = tfs.map(tf => {
    const members = db.prepare('SELECT * FROM tf_member WHERE tf_id = ?').all(tf.id);

    // 체크리스트 항목 + 각 항목의 최신 업무 로그
    const checklistItems = db.prepare(
      'SELECT c.*, m.name as assignee_name FROM tf_checklist c LEFT JOIN tf_member m ON c.assignee_id = m.id WHERE c.tf_id = ? ORDER BY c.part, c.id'
    ).all(tf.id);

    const itemsWithLog = checklistItems.map(item => {
      const lastLog = db.prepare(
        `SELECT w.*, m.name as member_name FROM work_log w JOIN tf_member m ON w.member_id = m.id WHERE w.checklist_item_id = ? ORDER BY w.created_at DESC LIMIT 1`
      ).get(item.id);
      return { ...item, lastLog: lastLog || null };
    });

    // 부서별로 그룹핑
    const PARTS = ['영업', '공장', '연구소', '구매'];
    const partGroups = PARTS.map(part => {
      const items = itemsWithLog.filter(i => i.part === part);
      if (!items.length) return null;
      return { part, items };
    }).filter(Boolean);

    // 최근 활동 (최근 5건)
    const recentLogs = db.prepare(`
      SELECT w.*, m.name as member_name, m.part
      FROM work_log w
      JOIN tf_member m ON w.member_id = m.id
      WHERE w.tf_id = ?
      ORDER BY w.created_at DESC LIMIT 5
    `).all(tf.id);

    // D-day
    const dday = Math.ceil((new Date(tf.target_date) - new Date()) / (1000 * 60 * 60 * 24));

    return { ...tf, members, partGroups, recentLogs, dday };
  });
  res.json(result);
});

app.get('/api/tf/:id', requireAuth, (req, res) => {
  const tf = db.prepare('SELECT * FROM tf WHERE id = ?').get(req.params.id);
  if (!tf) return res.status(404).json({ error: 'TF를 찾을 수 없습니다' });
  const members = db.prepare('SELECT * FROM tf_member WHERE tf_id = ?').all(tf.id);
  const checklist = db.prepare('SELECT * FROM tf_checklist WHERE tf_id = ? ORDER BY part, id').all(tf.id);
  const background = db.prepare('SELECT * FROM tf_background WHERE tf_id = ?').get(tf.id) || { background: '', reason: '' };
  const bgFiles = db.prepare('SELECT * FROM tf_background_file WHERE tf_id = ? ORDER BY uploaded_at DESC').all(tf.id);
  res.json({ ...tf, members, checklist, background, bgFiles });
});

app.post('/api/tf', requireAuth, (req, res) => {
  const { name, product_name, start_date, target_date, parts, membersByPart } = req.body;
  const info = db.prepare(
    'INSERT INTO tf (name, product_name, start_date, target_date) VALUES (?, ?, ?, ?)'
  ).run(name, product_name, start_date, target_date);
  const tfId = info.lastInsertRowid;

  if (parts && membersByPart) {
    parts.forEach(part => {
      (membersByPart[part] || []).forEach(memberName => {
        if (memberName.trim())
          db.prepare('INSERT INTO tf_member (tf_id, part, name) VALUES (?, ?, ?)').run(tfId, part, memberName.trim());
      });
    });
  }
  res.json({ id: tfId });
});

app.patch('/api/tf/:id/status', requireAuth, (req, res) => {
  db.prepare('UPDATE tf SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  res.json({ success: true });
});

app.delete('/api/tf/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  // 참조 순서대로 삭제 (자식 → 부모)
  db.prepare('DELETE FROM uploaded_file WHERE work_log_id IN (SELECT id FROM work_log WHERE tf_id = ?)').run(id);
  db.prepare('DELETE FROM generated_ppt WHERE work_log_id IN (SELECT id FROM work_log WHERE tf_id = ?)').run(id);
  db.prepare('DELETE FROM work_log WHERE tf_id = ?').run(id);
  db.prepare('DELETE FROM tf_checklist WHERE tf_id = ?').run(id);
  db.prepare('DELETE FROM tf_background_file WHERE tf_id = ?').run(id);
  db.prepare('DELETE FROM tf_background WHERE tf_id = ?').run(id);
  db.prepare('DELETE FROM tf_member WHERE tf_id = ?').run(id);
  db.prepare('DELETE FROM tf WHERE id = ?').run(id);
  res.json({ success: true });
});

// TF 팀원 + 파트별 체크리스트 조회 (팀원 페이지용, 인증 불필요)
app.get('/api/tf/:id/members', (req, res) => {
  const tf = db.prepare('SELECT * FROM tf WHERE id = ?').get(req.params.id);
  if (!tf) return res.status(404).json({ error: 'TF를 찾을 수 없습니다' });
  const members = db.prepare('SELECT * FROM tf_member WHERE tf_id = ?').all(req.params.id);
  const checklist = db.prepare('SELECT * FROM tf_checklist WHERE tf_id = ? ORDER BY part, id').all(req.params.id);
  res.json({ tf, members, checklist });
});

// 파트별 체크리스트 조회 (대시보드 팝업용, 인증 필요)
app.get('/api/tf/:id/checklist/:part', requireAuth, (req, res) => {
  const tfId = req.params.id;
  const part = decodeURIComponent(req.params.part);

  const items = db.prepare(
    'SELECT c.*, m.name as assignee_name FROM tf_checklist c LEFT JOIN tf_member m ON c.assignee_id = m.id WHERE c.tf_id = ? AND c.part = ? ORDER BY c.id'
  ).all(tfId, part);

  // 항목별 업무 로그 (checklist_item_id 기준)
  const itemLogs = db.prepare(`
    SELECT w.*, m.name as member_name FROM work_log w
    JOIN tf_member m ON w.member_id = m.id
    WHERE w.checklist_item_id IS NOT NULL AND w.tf_id = ? AND m.part = ?
    ORDER BY w.created_at DESC
  `).all(tfId, part);

  // 파트 전체 로그 (항목 미연결 포함, 최근 10개)
  const logs = db.prepare(`
    SELECT w.*, m.name as member_name FROM work_log w
    JOIN tf_member m ON w.member_id = m.id
    WHERE w.tf_id = ? AND m.part = ? ORDER BY w.created_at DESC LIMIT 10
  `).all(tfId, part);

  // items에 해당 항목의 로그를 붙임
  const itemsWithLogs = items.map(item => ({
    ...item,
    logs: itemLogs.filter(l => l.checklist_item_id === item.id)
  }));

  res.json({ items: itemsWithLogs, logs });
});

// ── 체크리스트 마스터 ──────────────────────────────────
app.get('/api/checklist/master', requireAuth, (req, res) => {
  res.json(MASTER_CHECKLIST);
});

// TF 체크리스트 저장 (선택 항목 + 일정)
app.post('/api/tf/:id/checklist', requireAuth, (req, res) => {
  const tfId = req.params.id;
  const { items } = req.body; // [{ part, item_key, item_label, assignee_id, target_date }]
  db.prepare('DELETE FROM tf_checklist WHERE tf_id = ?').run(tfId);
  const stmt = db.prepare(
    'INSERT INTO tf_checklist (tf_id, part, item_key, item_label, assignee_id, target_date) VALUES (?, ?, ?, ?, ?, ?)'
  );
  items.forEach(item => {
    stmt.run(tfId, item.part, item.item_key, item.item_label, item.assignee_id || null, item.target_date || null);
  });
  res.json({ success: true });
});

// 체크리스트 항목 완료 토글
app.patch('/api/checklist/:id/toggle', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM tf_checklist WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: '항목을 찾을 수 없습니다' });
  const completed = item.completed ? 0 : 1;
  const completed_at = completed ? new Date().toLocaleString('ko-KR') : null;
  db.prepare('UPDATE tf_checklist SET completed = ?, completed_at = ? WHERE id = ?')
    .run(completed, completed_at, req.params.id);
  res.json({ success: true, completed });
});

// 체크리스트 항목 일정/담당자 수정
app.patch('/api/checklist/:id', requireAuth, (req, res) => {
  const { assignee_id, target_date } = req.body;
  db.prepare('UPDATE tf_checklist SET assignee_id = ?, target_date = ? WHERE id = ?')
    .run(assignee_id || null, target_date || null, req.params.id);
  res.json({ success: true });
});

// ── TF 추진배경/이유 ───────────────────────────────────
app.put('/api/tf/:id/background', requireAuth, (req, res) => {
  const { background, reason } = req.body;
  db.prepare(`
    INSERT INTO tf_background (tf_id, background, reason, updated_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(tf_id) DO UPDATE SET background=excluded.background, reason=excluded.reason, updated_at=excluded.updated_at
  `).run(req.params.id, background || '', reason || '');
  res.json({ success: true });
});

// 기초조사자료 파일 업로드
app.post('/api/tf/:id/background/file', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });

  let summaryJson = null;
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    try {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const parsed = parseEvalHtml(content);
      if (parsed) summaryJson = JSON.stringify(parsed);
    } catch (e) {
      console.error('HTML 파싱 실패:', e);
    }
  }

  db.prepare(
    'INSERT INTO tf_background_file (tf_id, original_filename, stored_path, file_type, summary_json) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, req.file.originalname, req.file.path, req.file.mimetype, summaryJson);
  res.json({ success: true, filename: req.file.originalname, hasSummary: !!summaryJson });
});

// 기초조사자료 HTML 파일 뷰어 (iframe용)
app.get('/api/tf/:id/background/file/:fileId/view', (req, res) => {
  const file = db.prepare('SELECT * FROM tf_background_file WHERE id = ? AND tf_id = ?').get(req.params.fileId, req.params.id);
  if (!file) return res.status(404).send('파일을 찾을 수 없습니다');
  res.sendFile(file.stored_path);
});

// 기초조사자료 파일 삭제
app.delete('/api/tf/:id/background/file/:fileId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tf_background_file WHERE id = ? AND tf_id = ?').run(req.params.fileId, req.params.id);
  res.json({ success: true });
});

// ── 보고서 ────────────────────────────────────────────
app.get('/api/tf/:id/report', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM tf_report WHERE tf_id = ?').get(req.params.id);
  if (!row) return res.json(null);
  res.json({ ...row, sections: JSON.parse(row.sections || '[]') });
});

app.put('/api/tf/:id/report', requireAuth, (req, res) => {
  const { title, sections } = req.body;
  db.prepare(`
    INSERT INTO tf_report (tf_id, title, sections, updated_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(tf_id) DO UPDATE SET title=excluded.title, sections=excluded.sections, updated_at=excluded.updated_at
  `).run(req.params.id, title || '', JSON.stringify(sections || []));
  res.json({ success: true });
});

// 보고서용 전체 업무 로그 조회
app.get('/api/tf/:id/report/data', requireAuth, (req, res) => {
  const tfId = req.params.id;
  const checklist = db.prepare('SELECT c.*, m.name as assignee_name FROM tf_checklist c LEFT JOIN tf_member m ON c.assignee_id = m.id WHERE c.tf_id = ? ORDER BY c.part, c.id').all(tfId);
  const logs = db.prepare(`
    SELECT w.*, m.name as member_name, m.part, c.item_label
    FROM work_log w
    JOIN tf_member m ON w.member_id = m.id
    LEFT JOIN tf_checklist c ON w.checklist_item_id = c.id
    WHERE w.tf_id = ? ORDER BY w.created_at ASC
  `).all(tfId);
  res.json({ checklist, logs });
});

// ── 업무 로그 ──────────────────────────────────────────
app.post('/api/worklog', upload.single('file'), (req, res) => {
  const { tf_id, member_id, checklist_item_id, content, status } = req.body;
  const info = db.prepare(
    'INSERT INTO work_log (tf_id, member_id, checklist_item_id, content, status) VALUES (?, ?, ?, ?, ?)'
  ).run(tf_id, member_id, checklist_item_id || null, content, status);
  if (req.file) {
    db.prepare(
      'INSERT INTO uploaded_file (work_log_id, original_filename, stored_path, file_type) VALUES (?, ?, ?, ?)'
    ).run(info.lastInsertRowid, req.file.originalname, req.file.path, req.file.mimetype);
  }
  res.json({ id: info.lastInsertRowid });
});

// 최근 활동 피드
app.get('/api/activity', requireAuth, (req, res) => {
  const logs = db.prepare(`
    SELECT w.*, m.name as member_name, m.part, t.name as tf_name, t.product_name
    FROM work_log w
    JOIN tf_member m ON w.member_id = m.id
    JOIN tf t ON w.tf_id = t.id
    ORDER BY w.created_at DESC LIMIT 20
  `).all();
  res.json(logs);
});

// React 라우터 fallback (정적 파일 외 모든 요청 → index.html)
if (fs.existsSync(distPath)) {
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => console.log(`서버 실행 중: http://localhost:${PORT}`));
