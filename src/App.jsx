import { useState, useEffect } from 'react';
import { api } from './api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import MemberInput from './components/MemberInput';
import TFDetail from './components/TFDetail';
import './App.css';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [memberTfId, setMemberTfId] = useState(null);
  const [detailTfId, setDetailTfId] = useState(null);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/member\/(\d+)$/);
    if (match) {
      setMemberTfId(parseInt(match[1]));
      setPage('member');
      setAuth(true);
      return;
    }
    api.checkAuth().then(r => setAuth(r.authenticated));
  }, []);

  if (auth === null) return <div className="loading">로딩 중...</div>;

  if (page === 'member' && memberTfId) return <MemberInput tfId={memberTfId} />;

  if (!auth) return <Login onLogin={() => setAuth(true)} />;

  if (page === 'detail' && detailTfId) {
    return <TFDetail tfId={detailTfId} onBack={() => setPage('dashboard')} />;
  }

  return (
    <Dashboard
      onLogout={() => setAuth(false)}
      onOpenDetail={(id) => { setDetailTfId(id); setPage('detail'); }}
    />
  );
}
