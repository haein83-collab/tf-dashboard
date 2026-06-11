import { useState } from 'react';
import { api } from '../api';

const STATUS_COLOR  = { '완료': '#16a34a', '진행중': '#2563eb', '이슈있음': '#dc2626' };
const STATUS_BG     = { '완료': '#dcfce7', '진행중': '#dbeafe', '이슈있음': '#fee2e2' };
const PART_COLOR    = { '영업': '#3b82f6', '공장': '#f59e0b', '연구소': '#8b5cf6', '구매': '#10b981' };

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function TFCard({ tf, onRefresh, onMemberLink, onOpenDetail }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleComplete = async () => {
    if (!confirm(`"${tf.name}" TF를 완료 처리하시겠습니까?`)) return;
    await api.updateTFStatus(tf.id, 'completed');
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirm(`"${tf.name}" TF를 삭제하시겠습니까? 모든 데이터가 삭제됩니다.`)) return;
    await api.deleteTF(tf.id);
    onRefresh();
  };

  const partGroups  = tf.partGroups  || [];
  const recentLogs  = tf.recentLogs  || [];

  return (
    <div className={`tf-card ${tf.status === 'completed' ? 'completed' : ''}`}>
      {/* 카드 헤더 */}
      <div className="tf-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="tf-name-link" onClick={() => onOpenDetail(tf.id)}>{tf.name}</h3>
          <span className="product-name">{tf.product_name}</span>
        </div>
        <div className="card-menu">
          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>⋮</button>
          {menuOpen && (
            <div className="dropdown">
              <button onClick={() => { onOpenDetail(tf.id); setMenuOpen(false); }}>상세 보기</button>
              <button onClick={() => { onMemberLink(tf.id); setMenuOpen(false); }}>팀원 링크 복사</button>
              <button onClick={() => { handleComplete(); setMenuOpen(false); }}>완료 처리</button>
              <button className="danger" onClick={() => { handleDelete(); setMenuOpen(false); }}>삭제</button>
            </div>
          )}
        </div>
      </div>

      {/* 부서별 업무 현황 */}
      {partGroups.length === 0 ? (
        <div className="card-no-checklist">체크리스트 미설정</div>
      ) : (
        <div className="card-parts">
          {partGroups.map(group => (
            <div key={group.part} className="card-part-group">
              <div className="card-part-name">{group.part}</div>
              <div className="card-part-items">
                {group.items.map(item => (
                  <div key={item.id} className="card-item-row">
                    <span className={`card-item-check ${item.completed ? 'done' : ''}`}>
                      {item.completed ? '✅' : '⬜'}
                    </span>
                    <span className="card-item-label">{item.item_label}</span>
                    {item.lastLog ? (
                      <div className="card-item-log">
                        <span className="card-item-status"
                          style={{ color: STATUS_COLOR[item.lastLog.status], background: STATUS_BG[item.lastLog.status] }}>
                          {item.lastLog.status}
                        </span>
                        <span className="card-item-content">
                          {item.lastLog.content.length > 22
                            ? item.lastLog.content.slice(0, 22) + '…'
                            : item.lastLog.content}
                        </span>
                        <span className="card-item-time">{timeAgo(item.lastLog.created_at)}</span>
                      </div>
                    ) : (
                      <span className="card-item-none">기록 없음</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 최근 활동 */}
      <div className="card-activity">
        <div className="card-activity-title">최근 활동</div>
        {recentLogs.length === 0 ? (
          <div className="card-activity-empty">등록된 업무가 없습니다</div>
        ) : (
          <div className="card-activity-list">
            {recentLogs.map((log, i) => (
              <div key={i} className="card-act-item">
                <span className="card-act-part"
                  style={{ background: PART_COLOR[log.part] || '#6b7280' }}>
                  {log.part}
                </span>
                <span className="card-act-who">{log.member_name}</span>
                <span className="card-act-status"
                  style={{ color: STATUS_COLOR[log.status] || '#666' }}>
                  {log.status}
                </span>
                <span className="card-act-content">
                  {log.content.length > 28 ? log.content.slice(0, 28) + '…' : log.content}
                </span>
                <span className="card-act-time">{timeAgo(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 카드 하단 */}
      <div className="tf-card-footer">
        <span className="card-footer-date">목표: {tf.target_date}</span>
        {tf.dday !== undefined && (
          <span className={`dday-small ${tf.dday < 0 ? 'over' : tf.dday <= 7 ? 'soon' : ''}`}>
            {tf.dday < 0 ? `D+${Math.abs(tf.dday)}` : tf.dday === 0 ? 'D-Day' : `D-${tf.dday}`}
          </span>
        )}
        <button className="detail-link" onClick={() => onOpenDetail(tf.id)}>상세 →</button>
      </div>
    </div>
  );
}
