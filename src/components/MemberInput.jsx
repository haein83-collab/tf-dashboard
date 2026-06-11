import { useState, useEffect } from 'react';
import { api } from '../api';

const PARTS = ['영업', '공장', '연구소', '구매'];

export default function MemberInput({ tfId }) {
  const [tfInfo, setTfInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [checklist, setChecklist] = useState([]); // 전체 체크리스트
  const [form, setForm] = useState({
    member_id: '',
    checklist_item_id: '',
    content: '',
    status: '진행중'
  });
  const [file, setFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTFMembers(tfId)
      .then(data => {
        setTfInfo(data.tf);
        setMembers(data.members);
        setChecklist(data.checklist || []);
      })
      .catch(() => setError('TF 정보를 불러올 수 없습니다'));
  }, [tfId]);

  // 선택된 담당자의 파트
  const selectedMember = members.find(m => String(m.id) === String(form.member_id));
  const selectedPart = selectedMember?.part;

  // 해당 파트의 미완료 체크리스트 항목
  const partChecklist = checklist.filter(
    item => item.part === selectedPart && !item.completed
  );

  const handleMemberChange = (e) => {
    setForm({ ...form, member_id: e.target.value, checklist_item_id: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.member_id || !form.content) {
      alert('담당자와 업무 내용을 입력해주세요');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('tf_id', tfId);
    formData.append('member_id', form.member_id);
    formData.append('content', form.content);
    formData.append('status', form.status);
    if (form.checklist_item_id) formData.append('checklist_item_id', form.checklist_item_id);
    if (file) formData.append('file', file);

    try {
      await api.submitWorkLog(formData);
      setSubmitted(true);
    } catch {
      alert('제출 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (error) return <div className="member-wrap"><p className="error">{error}</p></div>;
  if (!tfInfo) return <div className="member-wrap"><p className="loading">로딩 중...</p></div>;

  if (submitted) return (
    <div className="member-wrap">
      <div className="submit-success">
        <div className="success-icon">✅</div>
        <h2>업무 내용이 제출됐습니다</h2>
        <p>팀장 대시보드에 반영됐습니다</p>
        <button onClick={() => {
          setSubmitted(false);
          setForm({ member_id: '', checklist_item_id: '', content: '', status: '진행중' });
          setFile(null);
        }}>추가 입력</button>
      </div>
    </div>
  );

  return (
    <div className="member-wrap">
      <div className="member-box">
        <div className="member-header">
          <h1>{tfInfo.name}</h1>
          <span>{tfInfo.product_name}</span>
        </div>
        <form onSubmit={handleSubmit}>

          {/* 1. 담당자 선택 */}
          <label>담당자 선택</label>
          <select value={form.member_id} onChange={handleMemberChange}>
            <option value="">— 선택하세요 —</option>
            {PARTS.map(part => {
              const partMembers = members.filter(m => m.part === part);
              if (!partMembers.length) return null;
              return (
                <optgroup key={part} label={part}>
                  {partMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>

          {/* 2. 체크리스트 항목 연결 (담당자 선택 후 해당 파트 항목 표시) */}
          {selectedPart && (
            <>
              <label>
                관련 체크리스트 항목
                <span className="label-hint"> (선택사항)</span>
              </label>
              {partChecklist.length === 0 ? (
                <p className="no-checklist">
                  {checklist.filter(i => i.part === selectedPart).length === 0
                    ? '등록된 체크리스트 항목이 없습니다'
                    : '미완료 체크리스트 항목이 없습니다 (모두 완료됨)'}
                </p>
              ) : (
                <div className="checklist-select">
                  <div
                    className={`cl-select-item ${form.checklist_item_id === '' ? 'selected' : ''}`}
                    onClick={() => setForm({ ...form, checklist_item_id: '' })}
                  >
                    <span>항목 연결 안함</span>
                  </div>
                  {partChecklist.map(item => (
                    <div
                      key={item.id}
                      className={`cl-select-item ${String(form.checklist_item_id) === String(item.id) ? 'selected' : ''}`}
                      onClick={() => setForm({ ...form, checklist_item_id: item.id })}
                    >
                      <span className="cl-sel-label">{item.item_label}</span>
                      {item.target_date && (
                        <span className="cl-sel-date">기한 {item.target_date}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 3. 업무 내용 */}
          <label>업무 내용</label>
          <textarea
            placeholder={
              form.checklist_item_id
                ? `"${partChecklist.find(i => String(i.id) === String(form.checklist_item_id))?.item_label}" 관련 업무 내용을 입력하세요`
                : '진행한 업무 내용을 자유롭게 입력하세요'
            }
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            rows={5}
          />

          {/* 4. 현재 상태 */}
          <label>현재 상태</label>
          <div className="status-btns">
            {['진행중', '완료', '이슈있음'].map(s => (
              <button
                key={s}
                type="button"
                className={`status-btn ${form.status === s ? 'active' : ''} ${s === '이슈있음' ? 'issue' : ''}`}
                onClick={() => setForm({ ...form, status: s })}
              >
                {s}
              </button>
            ))}
          </div>

          {/* 5. 파일 첨부 */}
          <label>파일 첨부 <span className="label-hint">(선택)</span></label>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.pptx"
            onChange={e => setFile(e.target.files[0])}
          />
          {file && <p className="file-name">첨부: {file.name}</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '제출 중...' : '업무 내용 제출'}
          </button>
        </form>
      </div>
    </div>
  );
}
