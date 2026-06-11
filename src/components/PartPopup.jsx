import { useState, useEffect } from 'react';
import { api } from '../api';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

const STATUS_CLASS = { '완료': 'done', '진행중': 'ongoing', '이슈있음': 'issue' };
const STATUS_LABEL = { '완료': '완료', '진행중': '진행중', '이슈있음': '이슈' };

function ChecklistItem({ item, members, tfId, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ member_id: item.assignee_id || '', content: '', status: '진행중' });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    await api.toggleChecklistItem(item.id);
    onUpdate();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.member_id || !form.content.trim()) {
      alert('담당자와 업무 내용을 입력해주세요');
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.append('tf_id', tfId);
    fd.append('member_id', form.member_id);
    fd.append('checklist_item_id', item.id);
    fd.append('content', form.content);
    fd.append('status', form.status);
    if (file) fd.append('file', file);
    await api.submitWorkLog(fd);
    setSubmitting(false);
    setSubmitted(true);
    setForm({ member_id: item.assignee_id || '', content: '', status: '진행중' });
    setFile(null);
    setTimeout(() => { setSubmitted(false); setOpen(false); onUpdate(); }, 1200);
  };

  const prevLogs = item.logs || [];

  return (
    <div className={`pp-cl-wrap ${item.completed ? 'done' : ''} ${open ? 'expanded' : ''}`}>
      {/* 항목 행 */}
      <div className="pp-cl-row" onClick={() => setOpen(o => !o)}>
        <button
          className="pp-check-btn"
          onClick={handleToggleComplete}
          title={item.completed ? '완료 취소' : '완료 처리'}
        >
          {item.completed ? '✅' : '⬜'}
        </button>
        <div className="pp-cl-info">
          <span className="pp-cl-label">{item.item_label}</span>
          <span className="pp-cl-meta">
            {item.assignee_name && <span>담당: {item.assignee_name}</span>}
            {item.target_date && <span>기한: {item.target_date}</span>}
            {prevLogs.length > 0 && (
              <span className="pp-log-count">업무 {prevLogs.length}건</span>
            )}
          </span>
        </div>
        <span className={`pp-cl-arrow ${open ? 'up' : ''}`}>›</span>
        {item.completed && <span className="pp-done-badge">완료</span>}
      </div>

      {/* 펼쳐진 내용: 이전 내역 + 입력 폼 */}
      {open && (
        <div className="pp-expanded-body" onClick={e => e.stopPropagation()}>

          {/* 이전 업무 내역 */}
          {prevLogs.length > 0 && (
            <div className="pp-prev-logs">
              <div className="pp-prev-title">이전 업무 내역</div>
              {prevLogs.map(log => (
                <div key={log.id} className="pp-prev-item">
                  <div className="pp-prev-top">
                    <span className={`status-badge ${STATUS_CLASS[log.status]}`}>
                      {STATUS_LABEL[log.status]}
                    </span>
                    <span className="pp-prev-who">{log.member_name}</span>
                    <span className="pp-prev-time">{timeAgo(log.created_at)}</span>
                  </div>
                  <p className="pp-prev-content">{log.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* 새 업무 입력 폼 */}
          {!item.completed && (
            <div className="pp-input-form">
              {submitted ? (
                <div className="pp-submit-ok">✅ 업무 내용이 등록됐습니다</div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="pp-form-row">
                    <select
                      value={form.member_id}
                      onChange={e => setForm({ ...form, member_id: e.target.value })}
                    >
                      <option value="">담당자 선택</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    placeholder={`"${item.item_label}" 관련 업무 내용을 입력하세요`}
                    value={form.content}
                    onChange={e => setForm({ ...form, content: e.target.value })}
                    rows={3}
                  />
                  <div className="pp-form-bottom">
                    <div className="pp-status-btns">
                      {['진행중', '완료', '이슈있음'].map(s => (
                        <button
                          key={s}
                          type="button"
                          className={`pp-status-btn ${form.status === s ? 'active' : ''} ${s === '이슈있음' ? 'issue' : ''}`}
                          onClick={() => setForm({ ...form, status: s })}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <label className="pp-file-label">
                      📎 {file ? file.name.slice(0, 12) + (file.name.length > 12 ? '…' : '') : '파일 첨부'}
                      <input
                        type="file"
                        hidden
                        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.pptx"
                        onChange={e => setFile(e.target.files[0])}
                      />
                    </label>
                  </div>
                  <div className="pp-form-actions">
                    <button type="button" className="pp-cancel" onClick={() => setOpen(false)}>취소</button>
                    <button type="submit" className="pp-submit" disabled={submitting}>
                      {submitting ? '등록 중...' : '업무 등록'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 완료 항목은 완료 취소 안내 */}
          {item.completed && (
            <div className="pp-completed-note">
              <span>완료된 항목입니다.</span>
              <button className="pp-undo-btn" onClick={handleToggleComplete}>완료 취소</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PartPopup({ tfId, tfName, part, onClose }) {
  const [data, setData] = useState(null);
  const [partMembers, setPartMembers] = useState([]);

  const load = async () => {
    const [partData, tfData] = await Promise.all([
      api.getPartChecklist(tfId, part),
      api.getTFMembers(tfId),
    ]);
    setData(partData);
    setPartMembers((tfData.members || []).filter(m => m.part === part));
  };

  useEffect(() => { load(); }, [tfId, part]);

  const total = data?.items.length || 0;
  const done = data?.items.filter(i => i.completed).length || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="part-popup" onClick={e => e.stopPropagation()}>

        <div className="part-popup-header">
          <div>
            <span className="part-popup-tag">{part}</span>
            <h3>{tfName}</h3>
          </div>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>

        {!data ? (
          <p className="popup-loading">로딩 중...</p>
        ) : (
          <>
            <div className="popup-section">
              <div className="popup-section-header">
                <h4>체크리스트 <span className="pp-hint">— 항목을 클릭해 업무를 입력하세요</span></h4>
                {total > 0 && <span className="popup-progress">{done}/{total}</span>}
              </div>

              {total === 0 ? (
                <p className="popup-empty">등록된 체크리스트 항목이 없습니다</p>
              ) : (
                <div className="pp-cl-list">
                  {data.items.map(item => (
                    <ChecklistItem
                      key={item.id}
                      item={item}
                      members={partMembers}
                      tfId={tfId}
                      onUpdate={load}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 항목 미연결 업무 내역 */}
            {data.logs.some(l => !l.checklist_item_id) && (
              <div className="popup-section">
                <div className="popup-section-header">
                  <h4>기타 업무 내역</h4>
                </div>
                <div className="popup-logs">
                  {data.logs.filter(l => !l.checklist_item_id).map(log => (
                    <div key={log.id} className="popup-log-item">
                      <div className="popup-log-top">
                        <span className={`status-badge ${STATUS_CLASS[log.status]}`}>
                          {STATUS_LABEL[log.status]}
                        </span>
                        <span className="popup-log-who">{log.member_name}</span>
                        <span className="popup-log-time">{timeAgo(log.created_at)}</span>
                      </div>
                      <p className="popup-log-content">{log.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
