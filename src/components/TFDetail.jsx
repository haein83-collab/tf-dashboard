import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import ReportTab from './ReportTab';

const PARTS = ['영업', '공장', '연구소', '구매'];
const STATUS_OPTIONS = ['진행중', '완료', '이슈있음'];
const STATUS_COLOR = { '완료': '#16a34a', '진행중': '#2563eb', '이슈있음': '#dc2626' };

function EvalHtmlViewer({ tfId, file }) {
  const src = `/api/tf/${tfId}/background/file/${file.id}/view`;
  return (
    <div className="eval-html-viewer">
      <iframe src={src} title={file.original_filename} className="eval-iframe" sandbox="allow-same-origin" />
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// 업무 진행 현황 탭
function WorkTab({ tfId, checklist, members }) {
  const [partData, setPartData] = useState({}); // { part: { items, logs } }
  const [expanded, setExpanded] = useState(null); // checklist item id
  const [form, setForm] = useState({ content: '', status: '진행중', member_id: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    const parts = [...new Set(checklist.map(i => i.part))];
    const results = await Promise.all(parts.map(p => api.getPartChecklist(tfId, p)));
    const map = {};
    parts.forEach((p, i) => { map[p] = results[i]; });
    setPartData(map);
  }, [tfId, checklist]);

  useEffect(() => { if (checklist.length > 0) loadAll(); }, [loadAll, checklist.length]);

  const handleExpand = (itemId) => {
    setExpanded(prev => prev === itemId ? null : itemId);
    setForm({ content: '', status: '진행중', member_id: '' });
  };

  const handleSubmit = async (item) => {
    if (!form.content.trim()) return;
    if (!form.member_id) { alert('담당자를 선택하세요'); return; }
    setSubmitting(true);
    const fd = new FormData();
    fd.append('tf_id', tfId);
    fd.append('member_id', form.member_id);
    fd.append('checklist_item_id', item.id);
    fd.append('content', form.content);
    fd.append('status', form.status);
    await api.submitWorkLog(fd);
    setForm({ content: '', status: '진행중', member_id: '' });
    await loadAll();
    setSubmitting(false);
  };

  if (checklist.length === 0) {
    return (
      <div className="wt-empty">
        <p>체크리스트를 먼저 설정해야 업무를 등록할 수 있습니다.</p>
        <p style={{ fontSize: '13px', color: '#aaa', marginTop: '6px' }}>체크리스트 탭에서 항목을 설정해주세요.</p>
      </div>
    );
  }

  return (
    <div className="wt-wrap">
      {PARTS.map(part => {
        const items = (partData[part]?.items || checklist.filter(c => c.part === part));
        if (!items.length) return null;
        const partMembers = members.filter(m => m.part === part);

        return (
          <div key={part} className="wt-part">
            <div className="wt-part-header">
              <span className="wt-part-name">{part}</span>
              <span className="wt-part-count">{items.length}개 항목</span>
            </div>

            {items.map(item => {
              const logs = item.logs || [];
              const isOpen = expanded === item.id;
              const lastLog = logs[0];

              return (
                <div key={item.id} className={`wt-item ${isOpen ? 'open' : ''}`}>
                  {/* 항목 헤더 */}
                  <div className="wt-item-header" onClick={() => handleExpand(item.id)}>
                    <span className={`wt-check ${item.completed ? 'done' : ''}`}>
                      {item.completed ? '✅' : '⬜'}
                    </span>
                    <span className="wt-item-label">{item.item_label}</span>
                    <div className="wt-item-meta">
                      {lastLog && (
                        <span className="wt-last-status" style={{ color: STATUS_COLOR[lastLog.status] || '#666' }}>
                          {lastLog.status}
                        </span>
                      )}
                      {item.target_date && <span className="wt-target-date">~{item.target_date}</span>}
                      <span className="wt-log-count">{logs.length > 0 ? `${logs.length}건` : '기록 없음'}</span>
                      <span className="wt-expand-arrow">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* 펼침 영역 */}
                  {isOpen && (
                    <div className="wt-item-body">
                      {/* 이전 업무 기록 */}
                      {logs.length > 0 && (
                        <div className="wt-logs">
                          {logs.map((log, i) => (
                            <div key={i} className="wt-log-entry">
                              <div className="wt-log-top">
                                <span className="wt-log-who">{log.member_name}</span>
                                <span className="wt-log-status" style={{ color: STATUS_COLOR[log.status] || '#666' }}>
                                  {log.status}
                                </span>
                                <span className="wt-log-time">{timeAgo(log.created_at)}</span>
                              </div>
                              <p className="wt-log-content">{log.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 새 업무 입력 폼 */}
                      <div className="wt-input-form">
                        <div className="wt-form-row">
                          <select
                            value={form.member_id}
                            onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}
                            className="wt-select"
                          >
                            <option value="">담당자 선택</option>
                            {partMembers.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          <select
                            value={form.status}
                            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                            className="wt-select"
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <textarea
                          className="wt-textarea"
                          rows={3}
                          placeholder="업무 진행 내용을 입력하세요"
                          value={form.content}
                          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                        />
                        <button
                          className="wt-submit-btn"
                          onClick={() => handleSubmit(item)}
                          disabled={submitting || !form.content.trim()}
                        >
                          {submitting ? '등록 중...' : '업무 등록'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function TFDetail({ tfId, onBack }) {
  const [tf, setTf] = useState(null);
  const [master, setMaster] = useState({});
  const [tab, setTab] = useState('background');
  const [bgForm, setBgForm] = useState({ background: '', reason: '' });
  const [bgSaving, setBgSaving] = useState(false);
  const [bgSaved, setBgSaved] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [expandedFile, setExpandedFile] = useState(null);
  const [clState, setClState] = useState({});
  const [clSaving, setClSaving] = useState(false);
  const [clEditMode, setClEditMode] = useState(false);

  const load = useCallback(async () => {
    const [tfData, masterData] = await Promise.all([api.getTF(tfId), api.getMasterChecklist()]);
    setTf(tfData);
    setMaster(masterData);
    setBgForm({ background: tfData.background?.background || '', reason: tfData.background?.reason || '' });
    const saved = {};
    tfData.checklist.forEach(item => {
      saved[item.item_key] = {
        selected: true,
        assignee_id: item.assignee_id || '',
        target_date: item.target_date || '',
        db_id: item.id,
        completed: item.completed,
      };
    });
    setClState(saved);
  }, [tfId]);

  useEffect(() => { load(); }, [load]);

  const saveBackground = async () => {
    setBgSaving(true);
    await api.saveBackground(tfId, bgForm);
    setBgSaving(false);
    setBgSaved(true);
    setTimeout(() => setBgSaved(false), 2000);
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    await api.uploadBgFile(tfId, fd);
    await load();
    setFileUploading(false);
    e.target.value = '';
  };

  const deleteFile = async (fileId) => {
    if (!confirm('파일을 삭제하시겠습니까?')) return;
    await api.deleteBgFile(tfId, fileId);
    if (expandedFile === fileId) setExpandedFile(null);
    await load();
  };

  const toggleItem = (key) => {
    setClState(prev => ({
      ...prev,
      [key]: prev[key]?.selected
        ? { ...prev[key], selected: false }
        : { ...(prev[key] || {}), selected: true, assignee_id: '', target_date: '' }
    }));
  };

  const updateItemField = (key, field, value) => {
    setClState(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const saveChecklist = async () => {
    setClSaving(true);
    const items = [];
    Object.entries(master).forEach(([part, partItems]) => {
      partItems.forEach(masterItem => {
        const s = clState[masterItem.key];
        if (s?.selected) {
          items.push({
            part,
            item_key: masterItem.key,
            item_label: masterItem.label,
            assignee_id: s.assignee_id || null,
            target_date: s.target_date || null,
          });
        }
      });
    });
    await api.saveTFChecklist(tfId, items);
    await load();
    setClSaving(false);
    setClEditMode(false);
  };

  const toggleComplete = async (dbId) => {
    await api.toggleChecklistItem(dbId);
    await load();
  };

  if (!tf) return <div className="loading">로딩 중...</div>;

  const allMembers = tf.members || [];
  const savedChecklist = tf.checklist || [];
  const totalCl = savedChecklist.length;
  const doneCl = savedChecklist.filter(i => i.completed).length;
  const progress = totalCl === 0 ? 0 : Math.round((doneCl / totalCl) * 100);
  const evalFiles = tf.bgFiles?.filter(f => f.summary_json) || [];

  return (
    <div className="detail-wrap">
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>← 대시보드</button>
        <div>
          <h1>{tf.name}</h1>
          <span className="detail-product">{tf.product_name}</span>
        </div>
        <div className="detail-meta">
          <span>{tf.start_date} ~ {tf.target_date}</span>
          {tf.dday !== undefined && (
            <span className={`dday ${tf.dday < 0 ? 'over' : tf.dday <= 7 ? 'soon' : ''}`}>
              {tf.dday < 0 ? `D+${Math.abs(tf.dday)}` : tf.dday === 0 ? 'D-Day' : `D-${tf.dday}`}
            </span>
          )}
        </div>
      </div>

      <div className="detail-progress">
        <div className="dp-label">
          <span>체크리스트 진행률</span>
          <strong>{doneCl} / {totalCl} ({progress}%)</strong>
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="detail-tabs">
        <button className={tab === 'background' ? 'active' : ''} onClick={() => setTab('background')}>
          추진배경 / 기초자료
        </button>
        <button className={tab === 'checklist' ? 'active' : ''} onClick={() => setTab('checklist')}>
          업무 계획 {totalCl > 0 && <span className="tab-badge">{doneCl}/{totalCl}</span>}
        </button>
        <button className={tab === 'work' ? 'active' : ''} onClick={() => setTab('work')}>
          업무 진행 현황
        </button>
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>
          보고서
        </button>
      </div>

      {/* 추진배경 탭 */}
      {tab === 'background' && (
        <div className="tab-content">
          <div className="bg-section">
            <label>추진 배경</label>
            <textarea rows={4} placeholder="이 TF를 추진하게 된 배경을 입력하세요"
              value={bgForm.background} onChange={e => setBgForm({ ...bgForm, background: e.target.value })} />
            <label>추진 이유 / 목적</label>
            <textarea rows={4} placeholder="TF의 목적과 기대 효과를 입력하세요"
              value={bgForm.reason} onChange={e => setBgForm({ ...bgForm, reason: e.target.value })} />
            <button className="save-btn" onClick={saveBackground} disabled={bgSaving}>
              {bgSaved ? '저장됨 ✓' : bgSaving ? '저장 중...' : '저장'}
            </button>
          </div>

          {evalFiles.length > 0 && (
            <div className="eval-summaries">
              {evalFiles.map(f => (
                <div key={f.id}>
                  <div className={`eval-file-toggle ${expandedFile === f.id ? 'open' : ''}`}
                    onClick={() => setExpandedFile(expandedFile === f.id ? null : f.id)}>
                    <span>📊 {f.original_filename}</span>
                    <span className="eval-toggle-arrow">{expandedFile === f.id ? '▲ 접기' : '▼ 평가 내용 보기'}</span>
                  </div>
                  {expandedFile === f.id && <EvalHtmlViewer tfId={tfId} file={f} />}
                </div>
              ))}
            </div>
          )}

          <div className="bg-files">
            <div className="bg-files-header">
              <h3>기초조사자료</h3>
              <label className="file-upload-btn">
                {fileUploading ? '업로드 중...' : '+ 파일 추가'}
                <input type="file" hidden onChange={uploadFile}
                  accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.pptx,.html,.htm" />
              </label>
            </div>
            {tf.bgFiles?.length === 0 && <p className="empty-files">첨부된 파일이 없습니다</p>}
            <ul className="file-list">
              {tf.bgFiles?.map(f => (
                <li key={f.id}>
                  <span className="file-icon">{f.summary_json ? '📊' : '📄'}</span>
                  <span className="file-name">{f.original_filename}</span>
                  {f.summary_json && <span className="file-eval-tag">평가서</span>}
                  <span className="file-date">{f.uploaded_at?.slice(0, 10)}</span>
                  <button className="file-del" onClick={() => deleteFile(f.id)}>✕</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 체크리스트 탭 */}
      {tab === 'checklist' && (
        <div className="tab-content">
          {savedChecklist.length > 0 && !clEditMode ? (
            <div className="cl-progress-view">
              <div className="cl-actions">
                <span className="cl-hint">항목을 클릭하면 완료/미완료 토글됩니다</span>
                <button className="outline-btn" onClick={() => setClEditMode(true)}>항목 수정</button>
              </div>
              {PARTS.map(part => {
                const items = savedChecklist.filter(i => i.part === part);
                if (!items.length) return null;
                return (
                  <div key={part} className="cl-part">
                    <h4>{part}</h4>
                    {items.map(item => {
                      const member = allMembers.find(m => m.id === item.assignee_id);
                      return (
                        <div key={item.id} className={`cl-item ${item.completed ? 'done' : ''}`}
                          onClick={() => toggleComplete(item.id)}>
                          <span className="cl-check">{item.completed ? '✅' : '⬜'}</span>
                          <span className="cl-label">{item.item_label}</span>
                          <span className="cl-assignee">{member ? member.name : '—'}</span>
                          <span className="cl-date">{item.target_date || '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="cl-setup-view">
              <p className="cl-setup-hint">
                {clEditMode ? '항목을 수정하고 저장하세요. 완료 기록은 유지됩니다.' : '이 TF에 해당하는 항목을 선택하고 담당자와 목표일을 설정하세요'}
              </p>
              {PARTS.map(part => {
                const partMembers = allMembers.filter(m => m.part === part);
                const partItems = master[part] || [];
                if (!partItems.length) return null;
                return (
                  <div key={part} className="cl-part">
                    <h4>{part}</h4>
                    {partItems.map(item => {
                      const s = clState[item.key] || {};
                      return (
                        <div key={item.key} className={`cl-setup-item ${s.selected ? 'selected' : ''}`}>
                          <label className="cl-select-label">
                            <input type="checkbox" checked={!!s.selected} onChange={() => toggleItem(item.key)} />
                            <span>{item.label}</span>
                          </label>
                          {s.selected && (
                            <div className="cl-setup-fields">
                              <select value={s.assignee_id || ''}
                                onChange={e => updateItemField(item.key, 'assignee_id', e.target.value)}>
                                <option value="">담당자 선택</option>
                                {partMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                              <input type="date" value={s.target_date || ''}
                                onChange={e => updateItemField(item.key, 'target_date', e.target.value)} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                {clEditMode && (
                  <button className="outline-btn" onClick={() => setClEditMode(false)}>취소</button>
                )}
                <button className="save-btn" onClick={saveChecklist} disabled={clSaving}>
                  {clSaving ? '저장 중...' : '체크리스트 저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 업무 진행 현황 탭 */}
      {tab === 'work' && (
        <div className="tab-content">
          <WorkTab tfId={tfId} checklist={savedChecklist} members={allMembers} />
        </div>
      )}

      {/* 보고서 탭 */}
      {tab === 'report' && (
        <div className="tab-content">
          <ReportTab tfId={tfId} tf={tf} />
        </div>
      )}
    </div>
  );
}
