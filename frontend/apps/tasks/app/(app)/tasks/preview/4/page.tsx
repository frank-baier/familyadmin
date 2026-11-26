'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MOCK_TASKS, VARIANTS } from '../_mock';
import type { MockStatus } from '../_mock';

type Filter = 'all' | 'open' | 'active' | 'done';

const S: Record<MockStatus, { border: string; text: string; bg: string; label: string }> = {
  OPEN:       { border: '#DC2626', text: '#DC2626', bg: '#FEF2F2', label: 'OPEN' },
  IN_PROGRESS:{ border: '#1D4ED8', text: '#1D4ED8', bg: '#EFF6FF', label: 'ACTIVE' },
  DONE:       { border: '#15803D', text: '#15803D', bg: '#F0FDF4', label: 'DONE' },
};

function Switcher({ current }: { current: number }) {
  return (
    <div style={{
      position: 'fixed', bottom: '7rem', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '0', background: '#fff',
      borderRadius: 0, padding: 0, zIndex: 9999,
      border: '2px solid #1A1A18', whiteSpace: 'nowrap',
      boxShadow: '4px 4px 0 #1A1A18',
    }}>
      {VARIANTS.map(v => (
        <a key={v.id} href={`/tasks/preview/${v.id}`} style={{
          color: current === v.id ? '#fff' : '#1A1A18',
          background: current === v.id ? '#1A1A18' : 'transparent',
          fontSize: '0.6rem', fontWeight: 800,
          textDecoration: 'none', padding: '0.35rem 0.7rem',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          borderRight: v.id < 5 ? '1px solid #1A1A18' : 'none',
          fontFamily: "'Barlow Condensed', sans-serif",
        }}>{v.id}. {v.name}</a>
      ))}
    </div>
  );
}

export default function BlueprintPreview() {
  const [filter, setFilter] = useState<Filter>('all');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.background, body: body.style.background };
    html.style.background = '#FFFFFF';
    body.style.background = '#FFFFFF';
    return () => { html.style.background = prev.html; body.style.background = prev.body; };
  }, []);

  const filtered = MOCK_TASKS.filter(t =>
    filter === 'all' ? true :
    filter === 'open' ? t.status === 'OPEN' :
    filter === 'active' ? t.status === 'IN_PROGRESS' :
    t.status === 'DONE'
  );

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
        .bp { font-family: 'Barlow', sans-serif; }
        .bp-cond { font-family: 'Barlow Condensed', sans-serif; }
      `}</style>

      <div className="bp" style={{ minHeight: '100vh', background: '#FFFFFF', color: '#1A1A18' }}>

        {/* Header */}
        <div style={{ borderBottom: '3px solid #1A1A18', marginBottom: 0, paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div className="bp-cond" style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#888', marginBottom: '0.25rem' }}>
                Family Admin / Task Board
              </div>
              <h1 className="bp-cond" style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)', fontWeight: 900, lineHeight: 0.9, letterSpacing: '-0.01em', textTransform: 'uppercase', margin: 0 }}>
                Tasks
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', paddingBottom: '0.2rem' }}>
              <div className="bp-cond" style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textAlign: 'right', color: '#888', fontWeight: 500 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#DC2626', lineHeight: 1 }}>{MOCK_TASKS.filter(t => t.status === 'OPEN').length}</div>
                <div>OPEN</div>
              </div>
              <div style={{ width: '1px', height: '2.5rem', background: '#E0E0E0' }} />
              <div className="bp-cond" style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textAlign: 'right', color: '#888', fontWeight: 500 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1D4ED8', lineHeight: 1 }}>{MOCK_TASKS.filter(t => t.status === 'IN_PROGRESS').length}</div>
                <div>ACTIVE</div>
              </div>
              <div style={{ width: '1px', height: '2.5rem', background: '#E0E0E0' }} />
              <div className="bp-cond" style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textAlign: 'right', color: '#888', fontWeight: 500 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#15803D', lineHeight: 1 }}>{MOCK_TASKS.filter(t => t.status === 'DONE').length}</div>
                <div>DONE</div>
              </div>
              <Link href="/tasks/new" className="bp-cond" style={{
                display: 'inline-block', background: '#1A1A18', color: '#fff',
                padding: '0.65rem 1.25rem', fontSize: '0.8rem', fontWeight: 800,
                letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none',
                marginLeft: '0.75rem',
              }}>+ NEW</Link>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #1A1A18', marginBottom: '1.5rem' }}>
          {([
            { id: 'all' as Filter, label: 'ALL TASKS' },
            { id: 'open' as Filter, label: 'OPEN' },
            { id: 'active' as Filter, label: 'ACTIVE' },
            { id: 'done' as Filter, label: 'DONE' },
          ]).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className="bp-cond" style={{
              padding: '0.65rem 1.25rem', fontSize: '0.72rem', fontWeight: 800,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              background: filter === f.id ? '#1A1A18' : 'transparent',
              color: filter === f.id ? '#fff' : '#888',
              border: 'none', borderRight: '1px solid #E0E0E0',
              cursor: 'pointer',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.length === 0 && (
            <div className="bp-cond" style={{ textAlign: 'center', padding: '3rem', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#CCC', border: '2px solid #E0E0E0' }}>
              NO TASKS FOUND
            </div>
          )}
          {filtered.map(task => {
            const style = S[task.status];
            const isHov = hovered === task.id;
            return (
              <div
                key={task.id}
                onMouseEnter={() => setHovered(task.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  gap: '1rem', alignItems: 'center',
                  border: `2px solid ${isHov ? '#1A1A18' : '#E0E0E0'}`,
                  borderLeft: `5px solid ${style.border}`,
                  padding: '0.9rem 1rem',
                  cursor: 'pointer',
                  background: isHov ? '#FAFAFA' : '#fff',
                  transition: 'border-color 0.15s, background 0.15s',
                  boxShadow: isHov ? `4px 4px 0 ${style.border}20` : 'none',
                }}
              >
                <div>
                  <div className="bp-cond" style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: style.text, marginBottom: '0.25rem' }}>
                    {style.label}
                    {task.overdue && <span style={{ color: '#DC2626', marginLeft: '0.5rem' }}>— OVERDUE</span>}
                  </div>
                  <h3 className="bp-cond" style={{
                    fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', fontWeight: 800,
                    lineHeight: 1.1, letterSpacing: '0.01em', textTransform: 'uppercase',
                    color: task.status === 'DONE' ? '#BBB' : '#1A1A18',
                    textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                    margin: 0,
                  }}>{task.title}</h3>
                  <div className="bp" style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.72rem', color: '#888', fontWeight: 500 }}>
                    {task.assignee && <span>{task.assignee}</span>}
                    {task.dueLabel && <span style={{ color: task.overdue ? '#DC2626' : task.dueToday ? '#D97706' : '#888' }}>Due: {task.dueLabel}</span>}
                    {task.checklistTotal > 0 && <span>{task.checklistDone}/{task.checklistTotal} done</span>}
                  </div>
                </div>
                <div>
                  <span className="bp-cond" style={{
                    display: 'inline-block', padding: '0.35rem 0.75rem',
                    background: style.bg, color: style.text,
                    fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase',
                    border: `1px solid ${style.border}`,
                  }}>{style.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Switcher current={4} />
    </>
  );
}
