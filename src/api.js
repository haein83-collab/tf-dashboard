const BASE = (import.meta.env.VITE_API_BASE || '') + '/api';

async function req(path, options = {}) {
  const res = await fetch(BASE + path, { credentials: 'include', ...options });
  if (!res.ok) throw await res.json();
  return res.json();
}

export const api = {
  login: (password) => req('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  }),
  logout: () => req('/auth/logout', { method: 'POST' }),
  checkAuth: () => req('/auth/check'),

  getTFs: () => req('/tf'),
  getTF: (id) => req(`/tf/${id}`),
  createTF: (data) => req('/tf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  updateTFStatus: (id, status) => req(`/tf/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }),
  deleteTF: (id) => req(`/tf/${id}`, { method: 'DELETE' }),
  getTFMembers: (id) => req(`/tf/${id}/members`),

  // 체크리스트
  getMasterChecklist: () => req('/checklist/master'),
  getPartChecklist: (tfId, part) => req(`/tf/${tfId}/checklist/${encodeURIComponent(part)}`),
  saveTFChecklist: (tfId, items) => req(`/tf/${tfId}/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  }),
  toggleChecklistItem: (id) => req(`/checklist/${id}/toggle`, { method: 'PATCH' }),
  updateChecklistItem: (id, data) => req(`/checklist/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),

  // 추진배경/이유
  saveBackground: (tfId, data) => req(`/tf/${tfId}/background`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  uploadBgFile: (tfId, formData) => fetch(`${BASE}/tf/${tfId}/background/file`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  }).then(r => r.json()),
  deleteBgFile: (tfId, fileId) => req(`/tf/${tfId}/background/file/${fileId}`, { method: 'DELETE' }),

  // 업무 로그
  submitWorkLog: (formData) => fetch(BASE + '/worklog', {
    method: 'POST',
    credentials: 'include',
    body: formData
  }).then(r => r.json()),

  getActivity: () => req('/activity'),

  // 보고서
  getReport: (tfId) => req(`/tf/${tfId}/report`),
  saveReport: (tfId, data) => req(`/tf/${tfId}/report`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  getReportData: (tfId) => req(`/tf/${tfId}/report/data`),
};
