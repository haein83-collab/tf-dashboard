const STATUS_LABEL = { '완료': '완료', '진행중': '진행중', '이슈있음': '이슈' };
const STATUS_CLASS = { '완료': 'done', '진행중': 'ongoing', '이슈있음': 'issue' };

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function ActivityFeed({ activities }) {
  if (!activities.length) {
    return <div className="feed-empty">아직 업무 내역이 없습니다</div>;
  }
  return (
    <div className="activity-feed">
      {activities.map(a => (
        <div key={a.id} className="activity-item">
          <span className={`status-badge ${STATUS_CLASS[a.status]}`}>
            {STATUS_LABEL[a.status]}
          </span>
          <span className="activity-meta">[{a.tf_name} / {a.part}]</span>
          <span className="activity-who">{a.member_name}</span>
          <span className="activity-content">— {a.content.slice(0, 40)}{a.content.length > 40 ? '...' : ''}</span>
          <span className="activity-time">{timeAgo(a.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
