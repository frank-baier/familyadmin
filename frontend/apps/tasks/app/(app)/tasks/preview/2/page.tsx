'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MOCK_TASKS, VARIANTS } from '../_mock';
import type { MockStatus } from '../_mock';

type Filter = 'all' | 'open' | 'active' | 'done';

function bar(done: number, total: number): string {
  if (total === 0) return '─────';
  const f = Math.round((done / total) * 5);
  return '▓'.repeat(f) + '░'.repeat(5 - f);
}

const STATUS_TAG: Record<MockStatus, string> = { OPEN: '[OPEN   ]', IN_PROGRESS: '[ACTIVE ]', DONE: '[DONE   ]' };
const STATUS_CLR: Record<MockStatus, string> = { OPEN: '#E63946', IN_PROGRESS: '#00FF9D', DONE: '#555' };

function Switcher({ current }: { current: number }) {
  return (
    <div style={{
      position: 'fixed', bottom: '7rem', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '0.25rem', background: 'rgba(0,255,157,0.08)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderRadius: '0', padding: '0.4rem 0.65rem', zIndex: 9999,
      border: '1px solid rgba(0,255,157,0.3)', whiteSpace: 'nowrap',
    }}>
      {VARIANTS.map(v => (
        <a key={v.id} href={`/tasks/preview/${v.id}`} style={{
          color: current === v.id ? '#00FF9D' : 'rgba(0,255,157,0.35)',
          background: 'transparent', fontSize: '0.62rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: current === v.id ? 700 : 400,
          textDecoration: 'none', padding: '0.25rem 0.6rem',
          letterSpacing: '0.04em',
          borderLeft: current === v.id ? '2px solid #00FF9D' : '2px solid transparent',
        }}>{v.id}:{v.name}</a>
      ))}
    </div>
  );
}

export default function CircuitPreview() {
  const [filter, setFilter] = useState<Filter>('all');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.background, body: body.style.background };
    html.style.background = '#050505';
    body.style.background = '#050505';
    return () => { html.style.background = prev.html; body.style.background = prev.body; };
  }, []);

  const filtered = MOCK_TASKS.filter(t =>
    filter === 'all' ? true :
    filter === 'open' ? t.status === 'OPEN' :
    filter === 'active' ? t.status === 'IN_PROGRESS' :
    t.status === 'DONE'
  );

  const counts = {
    open: MOCK_TASKS.filter(t => t.status === 'OPEN').length,
    active: MOCK_TASKS.filter(t => t.status === 'IN_PROGRESS').length,
    done: MOCK_TASKS.filter(t => t.status === 'DONE').length,
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap');
        .crt { font-family: 'JetBrains Mono', 'Courier New', monospace; }
      `}</style>

      <div className="crt" style={{ minHeight: '100vh', background: '#050505', color: '#C8C8C8' }}>

        {/* ASCII header */}
        <div style={{ color: '#00FF9D', fontSize: 'clamp(0.55rem, 1.8vw, 0.75rem)', lineHeight: 1.7, marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div>{'┌' + '─'.repeat(58) + '┐'}</div>
          <div>{'│  FAMILYADMIN TASK MANAGER v2.0.0' + ' '.repeat(26) + '│'}</div>
          <div>{'│  USER: frank@family.local' + ' '.repeat(11) + `OPEN:${counts.open}  ACTIVE:${counts.active}  DONE:${counts.done}` + ' '.repeat(5) + '│'}</div>
          <div>{'│  DATE: ' + new Date().toISOString().slice(0, 10) + '  TIME: ' + new Date().toTimeString().slice(0, 8) + ' '.repeat(22) + '│'}</div>
          <div>{'└' + '─'.repeat(58) + '┘'}</div>
        </div>

        {/* Filter + new */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'open', 'active', 'done'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className="crt" style={{
              fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.75rem',
              background: filter === f ? '#00FF9D' : 'transparent',
              color: filter === f ? '#050505' : '#00FF9D',
              border: '1px solid #00FF9D', cursor: 'pointer',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>{f.toUpperCase()}</button>
          ))}
          <Link href="/tasks/new" className="crt" style={{
            marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700,
            padding: '0.2rem 0.9rem', background: '#FF6B35', color: '#050505',
            border: '1px solid #FF6B35', textDecoration: 'none', display: 'inline-block',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>+ NEW</Link>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '4.5rem 1fr 9rem 7rem 5.5rem 6rem',
          gap: '0.5rem', padding: '0.35rem 0.5rem',
          borderTop: '1px solid #142014', borderBottom: '1px solid #142014',
          fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase',
          color: '#2D622D', marginBottom: '0.1rem',
        }}>
          <span>ID</span><span>TITLE</span><span>STATUS</span>
          <span>ASSIGNEE</span><span>DUE</span><span>PROGRESS</span>
        </div>

        {/* Task rows */}
        <div>
          {filtered.map((task, i) => (
            <div key={task.id}
              onMouseEnter={() => setHovered(task.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'grid', gridTemplateColumns: '4.5rem 1fr 9rem 7rem 5.5rem 6rem',
                gap: '0.5rem', padding: '0.65rem 0.5rem',
                borderBottom: '1px solid #0D180D',
                background: hovered === task.id ? 'rgba(0,255,157,0.04)' : 'transparent',
                cursor: 'pointer', fontSize: '0.7rem', alignItems: 'center',
                transition: 'background 0.1s',
              }}
            >
              <span style={{ color: '#2D622D' }}>#T-{String(i + 1).padStart(3, '0')}</span>
              <span style={{
                color: task.status === 'DONE' ? '#444' : hovered === task.id ? '#E0E0E0' : '#C8C8C8',
                textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'color 0.1s',
              }}>{task.title}</span>
              <span style={{ color: STATUS_CLR[task.status] }}>{STATUS_TAG[task.status]}</span>
              <span style={{ color: '#666' }}>{task.assignee ?? '─────────'}</span>
              <span style={{ color: task.overdue ? '#E63946' : task.dueToday ? '#FF9800' : '#555' }}>
                {task.dueLabel ?? '──────'}
              </span>
              <span style={{ color: '#2D622D', letterSpacing: '0.02em' }}>
                {task.checklistTotal > 0 ? bar(task.checklistDone, task.checklistTotal) : '─────'}
                {task.checklistTotal > 0 && <span style={{ color: '#555', marginLeft: '0.3rem' }}>{task.checklistDone}/{task.checklistTotal}</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Status bar */}
        <div style={{
          marginTop: '2rem', borderTop: '1px solid #142014', paddingTop: '0.75rem',
          fontSize: '0.58rem', color: '#2D622D', display: 'flex', justifyContent: 'space-between',
          letterSpacing: '0.06em',
        }}>
          <span>[N] new task · [F] filter · [↑↓] navigate · [ENTER] open</span>
          <span>{filtered.length}/{MOCK_TASKS.length} tasks visible</span>
        </div>
      </div>

      <Switcher current={2} />
    </>
  );
}
