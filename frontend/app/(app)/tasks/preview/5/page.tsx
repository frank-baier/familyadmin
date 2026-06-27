'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MOCK_TASKS, VARIANTS } from '../_mock';
import type { MockStatus } from '../_mock';

type Filter = 'all' | 'open' | 'active' | 'done';

const GOLD = '#C9A96E';
const CREAM = '#F5F0E8';
const MUTED = '#4A4A44';
const FAINT = '#2A2A26';

const STATUS_DOT: Record<MockStatus, { color: string; label: string }> = {
  OPEN:        { color: '#E63946', label: 'Open' },
  IN_PROGRESS: { color: GOLD,      label: 'In progress' },
  DONE:        { color: '#4A6741', label: 'Completed' },
};

function Switcher({ current }: { current: number }) {
  return (
    <div style={{
      position: 'fixed', bottom: '7rem', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '0.25rem',
      background: 'rgba(20,20,14,0.92)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderRadius: '9999px', padding: '0.4rem 0.65rem', zIndex: 9999,
      border: `1px solid ${FAINT}`, whiteSpace: 'nowrap',
      boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${GOLD}22`,
    }}>
      {VARIANTS.map(v => (
        <a key={v.id} href={`/tasks/preview/${v.id}`} style={{
          color: current === v.id ? GOLD : 'rgba(245,240,232,0.3)',
          background: current === v.id ? `${GOLD}15` : 'transparent',
          fontSize: '0.62rem', fontWeight: current === v.id ? 600 : 400,
          textDecoration: 'none', padding: '0.25rem 0.6rem', borderRadius: '9999px',
          letterSpacing: '0.06em', fontFamily: "'Crimson Pro', Georgia, serif",
        }}>{v.id}. {v.name}</a>
      ))}
    </div>
  );
}

export default function ObsidianPreview() {
  const [filter, setFilter] = useState<Filter>('all');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.background, body: body.style.background };
    html.style.background = '#141410';
    body.style.background = '#141410';
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Crimson+Pro:wght@300;400;500&display=swap');
        .obs { font-family: 'Crimson Pro', Georgia, serif; }
        .obs-title { font-family: 'Cormorant Garamond', Georgia, serif; }
      `}</style>

      <div className="obs" style={{ minHeight: '100vh', background: '#141410', color: CREAM }}>

        {/* Header */}
        <div style={{ marginBottom: '3rem', paddingBottom: '2rem', borderBottom: `1px solid ${FAINT}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.75rem', fontWeight: 300 }}>
                Family Administration
              </div>
              <h1 className="obs-title" style={{
                fontSize: 'clamp(3rem, 8vw, 5.5rem)', fontWeight: 300,
                lineHeight: 0.9, color: CREAM, margin: 0, letterSpacing: '-0.02em',
              }}>Tasks</h1>
              <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: MUTED, letterSpacing: '0.08em' }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                <span style={{ marginLeft: '1rem', color: GOLD }}>
                  {MOCK_TASKS.filter(t => t.status !== 'DONE').length} remaining
                </span>
              </div>
            </div>
            <Link href="/tasks/new" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              fontFamily: "'Crimson Pro', Georgia, serif",
              color: GOLD, textDecoration: 'none', fontSize: '0.9rem',
              letterSpacing: '0.1em', fontWeight: 400,
              padding: '0.5rem 0', borderBottom: `1px solid ${GOLD}`,
              paddingBottom: '0.25rem',
            }}>+ New task</Link>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem' }}>
          {([
            { id: 'all' as Filter, label: 'All' },
            { id: 'open' as Filter, label: 'Open' },
            { id: 'active' as Filter, label: 'In Progress' },
            { id: 'done' as Filter, label: 'Completed' },
          ]).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className="obs" style={{
              fontSize: '0.82rem', fontWeight: 400, letterSpacing: '0.12em',
              textTransform: 'uppercase', padding: 0,
              color: filter === f.id ? GOLD : MUTED,
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: filter === f.id ? `1px solid ${GOLD}` : '1px solid transparent',
              paddingBottom: '0.1rem',
              transition: 'color 0.15s, border-color 0.15s',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Task list */}
        <div>
          {filtered.length === 0 && (
            <div className="obs-title" style={{ padding: '4rem 0', textAlign: 'center', color: MUTED, fontSize: '1.5rem', fontStyle: 'italic', fontWeight: 300 }}>
              Nothing here.
            </div>
          )}
          {filtered.map(task => {
            const isHov = hovered === task.id;
            const dot = STATUS_DOT[task.status];
            return (
              <div
                key={task.id}
                onMouseEnter={() => setHovered(task.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  borderBottom: `1px solid ${FAINT}`,
                  padding: '1.75rem 0 1.75rem 1.25rem',
                  borderLeft: isHov ? `2px solid ${GOLD}` : '2px solid transparent',
                  marginLeft: isHov ? 0 : 0,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease, padding-left 0.2s ease',
                  paddingLeft: isHov ? '1.5rem' : '1.25rem',
                }}
              >
                {/* Status dot + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: dot.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED, fontWeight: 300 }}>
                    {dot.label}
                  </span>
                </div>

                {/* Title */}
                <h3 className="obs-title" style={{
                  fontSize: 'clamp(1.2rem, 3vw, 1.65rem)', fontWeight: 300,
                  lineHeight: 1.2, color: task.status === 'DONE' ? '#3A3A36' : isHov ? '#FFFFFF' : CREAM,
                  textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                  margin: '0 0 0.65rem',
                  fontStyle: task.overdue ? 'italic' : 'normal',
                  transition: 'color 0.2s',
                  letterSpacing: '-0.01em',
                }}>{task.title}</h3>

                {/* Meta */}
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.72rem', color: MUTED, letterSpacing: '0.06em', fontWeight: 300, flexWrap: 'wrap' }}>
                  {task.assignee && <span>{task.assignee}</span>}
                  {task.dueLabel && (
                    <span style={{ color: task.overdue ? '#E63946' : task.dueToday ? GOLD : MUTED }}>
                      {task.overdue ? '⚠ Overdue · ' : ''}{task.dueLabel}
                    </span>
                  )}
                  {task.checklistTotal > 0 && (
                    <span style={{ color: isHov ? GOLD : MUTED }}>
                      {task.checklistDone} of {task.checklistTotal} complete
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: `1px solid ${FAINT}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span>FamilyAdmin</span>
          <span style={{ color: GOLD }}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <Switcher current={5} />
    </>
  );
}
