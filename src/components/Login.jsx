import { useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onLogin();
    } catch {
      setError('비밀번호가 틀렸습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>신제품 TF 운영 현황</h1>
        <p>접속하려면 비밀번호를 입력하세요</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? '확인 중...' : '접속'}
          </button>
        </form>
      </div>
    </div>
  );
}
