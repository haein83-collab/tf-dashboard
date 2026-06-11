import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import TFCard from './TFCard';
import CreateTFModal from './CreateTFModal';

export default function Dashboard({ onLogout, onOpenDetail }) {
  const [tfs, setTFs] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('active');

  const load = useCallback(async () => {
    const tfData = await api.getTFs();
    setTFs(tfData);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const copyMemberLink = (tfId) => {
    const url = `${window.location.origin}/member/${tfId}`;
    navigator.clipboard.writeText(url);
    alert(`팀원 링크가 복사됐습니다:\n${url}`);
  };

  const handleLogout = async () => {
    await api.logout();
    onLogout();
  };

  const filteredTFs = tfs.filter(tf =>
    filter === 'all' ? true : tf.status === filter
  );

  return (
    <div className="dashboard">
      <div className="site-title-bar">Non-Commodity T/F 대시보드</div>
      <header className="dash-header">
        <h1>신제품 TF 운영 현황</h1>
        <div className="header-actions">
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="active">진행중</option>
            <option value="completed">완료</option>
            <option value="all">전체</option>
          </select>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ TF 추가</button>
          <button className="btn-ghost" onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      <main className="dash-main">
        {filteredTFs.length === 0 ? (
          <div className="empty-state">
            <p>진행 중인 TF가 없습니다</p>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>첫 TF 추가하기</button>
          </div>
        ) : (
          <div className="tf-grid">
            {filteredTFs.map(tf => (
              <TFCard
                key={tf.id}
                tf={tf}
                onRefresh={load}
                onMemberLink={copyMemberLink}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        )}

      </main>

      {showCreate && (
        <CreateTFModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
