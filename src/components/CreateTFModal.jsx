import { useState } from 'react';
import { api } from '../api';

const PARTS = ['영업', '공장', '연구소', '구매'];

export default function CreateTFModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', product_name: '', start_date: '', target_date: ''
  });
  const [selectedParts, setSelectedParts] = useState([]);
  const [membersByPart, setMembersByPart] = useState({});
  const [loading, setLoading] = useState(false);

  const togglePart = (part) => {
    setSelectedParts(prev =>
      prev.includes(part) ? prev.filter(p => p !== part) : [...prev, part]
    );
  };

  const setMembers = (part, value) => {
    setMembersByPart(prev => ({ ...prev, [part]: value.split(',').map(s => s.trim()) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.product_name || !form.start_date || !form.target_date) {
      alert('모든 항목을 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      await api.createTF({ ...form, parts: selectedParts, membersByPart });
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>새 TF 추가</h2>
        <form onSubmit={handleSubmit}>
          <label>TF 이름</label>
          <input placeholder="예: 신제품A TF" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />

          <label>대상 신제품명</label>
          <input placeholder="예: 제품A" value={form.product_name}
            onChange={e => setForm({ ...form, product_name: e.target.value })} />

          <div className="date-row">
            <div>
              <label>시작일</label>
              <input type="date" value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label>목표 완료일</label>
              <input type="date" value={form.target_date}
                onChange={e => setForm({ ...form, target_date: e.target.value })} />
            </div>
          </div>

          <label>파트 구성</label>
          <div className="parts-check">
            {PARTS.map(part => (
              <label key={part} className="check-label">
                <input type="checkbox" checked={selectedParts.includes(part)}
                  onChange={() => togglePart(part)} />
                {part}
              </label>
            ))}
          </div>

          {selectedParts.map(part => (
            <div key={part}>
              <label>{part} 담당자 (쉼표로 구분)</label>
              <input placeholder="예: 홍길동, 김철수"
                onChange={e => setMembers(part, e.target.value)} />
            </div>
          ))}

          <div className="modal-btns">
            <button type="button" onClick={onClose}>취소</button>
            <button type="submit" disabled={loading}>
              {loading ? '생성 중...' : 'TF 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
