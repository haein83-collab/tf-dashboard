import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const PARTS = ['영업', '공장', '연구소', '구매'];

function buildAutoSections(tf, reportData) {
  const { checklist = [], logs = [] } = reportData;
  const today = new Date().toLocaleDateString('ko-KR');

  const totalCl = checklist.length;
  const doneCl = checklist.filter(c => c.completed).length;

  // 부서별 체크리스트 + 로그 정리
  const partSections = PARTS.map(part => {
    const items = checklist.filter(c => c.part === part);
    if (!items.length) return null;
    const lines = items.map(item => {
      const itemLogs = logs.filter(l => l.checklist_item_id === item.id);
      const status = item.completed ? '✅ 완료' : '⬜ 진행중';
      const assignee = item.assignee_name ? `(담당: ${item.assignee_name})` : '';
      const date = item.target_date ? `~${item.target_date}` : '';
      let text = `• [${status}] ${item.item_label} ${assignee} ${date}`.trim();
      if (itemLogs.length) {
        text += '\n' + itemLogs.map(l =>
          `  - ${l.member_name} (${l.status}): ${l.content}`
        ).join('\n');
      }
      return text;
    });
    return { id: `part_${part}`, title: `${part} 활동 현황`, content: lines.join('\n\n') };
  }).filter(Boolean);

  return [
    {
      id: 'overview',
      title: 'TF 개요',
      content: `TF명: ${tf.name}
제품명: ${tf.product_name}
추진 기간: ${tf.start_date} ~ ${tf.target_date}
작성일: ${today}
체크리스트 진행률: ${doneCl} / ${totalCl} (${totalCl ? Math.round(doneCl / totalCl * 100) : 0}%)`
    },
    {
      id: 'background',
      title: '추진 배경 및 목적',
      content: [
        tf.background?.background ? `[추진 배경]\n${tf.background.background}` : '',
        tf.background?.reason ? `[추진 목적]\n${tf.background.reason}` : '',
      ].filter(Boolean).join('\n\n') || '(추진 배경/목적을 입력하세요)'
    },
    ...partSections,
    {
      id: 'conclusion',
      title: '종합 의견 및 결론',
      content: '(종합 의견을 입력하세요)'
    },
    {
      id: 'next',
      title: '향후 계획',
      content: '(향후 추진 계획을 입력하세요)'
    },
  ];
}

export default function ReportTab({ tfId, tf }) {
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [existing, reportData] = await Promise.all([
      api.getReport(tfId),
      api.getReportData(tfId),
    ]);
    if (existing) {
      setTitle(existing.title);
      setSections(existing.sections);
    } else {
      const autoTitle = `${tf.product_name} TF 운영 보고서`;
      const autoSections = buildAutoSections(tf, reportData);
      setTitle(autoTitle);
      setSections(autoSections);
    }
    setLoading(false);
  }, [tfId, tf]);

  useEffect(() => { load(); }, [load]);

  const regenerate = async () => {
    if (!confirm('자동 초안을 다시 생성하시겠습니까? 현재 내용이 덮어씌워집니다.')) return;
    setGenerating(true);
    const reportData = await api.getReportData(tfId);
    setSections(buildAutoSections(tf, reportData));
    setTitle(`${tf.product_name} TF 운영 보고서`);
    setGenerating(false);
  };

  const save = async () => {
    setSaving(true);
    await api.saveReport(tfId, { title, sections });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSection = (id, content) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s));
  };
  const updateSectionTitle = (id, newTitle) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const print = () => {
    const win = window.open('', '_blank');
    const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; font-size: 13px; color: #111; max-width: 800px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 22px; text-align: center; margin-bottom: 6px; }
  .sub { text-align: center; color: #555; font-size: 13px; margin-bottom: 32px; }
  h2 { font-size: 15px; font-weight: 700; border-bottom: 2px solid #0f3460; padding-bottom: 6px; margin: 28px 0 12px; color: #0f3460; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.8; margin: 0; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>${title}</h1>
<div class="sub">${tf.name} · ${tf.start_date} ~ ${tf.target_date}</div>
${sections.map(s => `<h2>${s.title}</h2><pre>${s.content}</pre>`).join('\n')}
</body></html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  if (loading) return <div className="loading">보고서 불러오는 중...</div>;

  return (
    <div className="report-wrap">
      <div className="report-toolbar">
        <input
          className="report-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="보고서 제목"
        />
        <div className="report-toolbar-actions">
          <button className="report-btn outline" onClick={regenerate} disabled={generating}>
            {generating ? '생성 중...' : '🔄 자동 초안'}
          </button>
          <button className="report-btn outline" onClick={print}>🖨 인쇄</button>
          <button className="report-btn primary" onClick={save} disabled={saving}>
            {saved ? '저장됨 ✓' : saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="report-body">
        {sections.map(section => (
          <div key={section.id} className="report-section">
            <input
              className="report-section-title"
              value={section.title}
              onChange={e => updateSectionTitle(section.id, e.target.value)}
            />
            <textarea
              className="report-section-body"
              value={section.content}
              onChange={e => updateSection(section.id, e.target.value)}
              rows={section.content.split('\n').length + 2}
            />
          </div>
        ))}
      </div>

      <div className="report-footer-actions">
        <button className="report-btn outline" onClick={regenerate} disabled={generating}>
          {generating ? '생성 중...' : '🔄 자동 초안 재생성'}
        </button>
        <button className="report-btn primary" onClick={save} disabled={saving}>
          {saved ? '저장됨 ✓' : saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
