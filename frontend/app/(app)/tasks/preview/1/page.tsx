'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MOCK_TASKS, VARIANTS } from '../_mock';
import type { MockStatus } from '../_mock';

type Filter = 'all' | 'open' | 'in_progress' | 'done';

const STATUS_LABEL: Record<MockStatus, string> = { OPEN: 'Open', IN_PROGRESS: 'In Prog.', DONE: 'Done' };
const STATUS_COLOR: Record<MockStatus, string> = { OPEN: '#E63946', IN_PROGRESS: '#D97706', DONE: '#16A34A' };

function Switcher({ current }: { current: number }) {
  return (
    <div style={{
      position: 'fixed', bottom: '7rem', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '0.25rem', background: 'rgba(10,10,10,0.88)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderRadius: '9999px', padding: '0.4rem 0.65rem', zIndex: 9999,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
    }}>
      {VARIANTS.map(v => (
        <a key={v.id} href={`/tasks/preview/${v.id}`} style={{
          color: current === v.id ? '#fff' : 'rgba(255,255,255,0.38)',
          background: current === v.id ? 'rgba(255,255,255,0.14)' : 'transparent',
          fontSize: '0.62rem', fontWeight: current === v.id ? 700 : 400,
          textDecoration: 'none', padding: '0.25rem 0.6rem', borderRadius: '9999px',
          letterSpacing: '0.04em',
        }}>{v.id}. {v.name}</a>
      ))}
    </div>
  );
}

export default function BulletinPreview() {
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.background, body: body.style.background };
    html.style.background = '#FAF9F7';
    body.style.background = '#FAF9F7';
    return () => { html.style.background = prev.html; body.style.background = prev.body; };
  }, []);

  const filtered = MOCK_TASKS.filter(t =>
    filter === 'all' ? true :
    filter === 'open' ? t.status === 'OPEN' :
    filter === 'in_progress' ? t.status === 'IN_PROGRESS' :
    t.status === 'DONE'
  );

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');`}</style>

      <div style={{ minHeight: '100vh', background: '#FAF9F7', fontFamily: "'DM Sans', sans-serif", color: '#1A1A18' }}>

        {/* Masthead */}
        <div style={{ borderBottom: '3px solid #1A1A18', paddingBottom: '1rem', marginBottom: 0 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#AAA', marginBottom: '0.5rem' }}>
            Family Administration — Task Board
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', lineHeight: 1, color: '#1A1A18', margin: 0 }}>
              Tasks
            </h1>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E63946', marginBottom: '0.2rem' }}>
                ● Family Edition
              </div>
              <div style={{ fontSize: '0.66rem', color: '#888', letterSpacing: '0.04em' }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <Link href="/tasks/new" style={{
                display: 'inline-block', marginTop: '0.5rem',
                background: '#1A1A18', color: '#FAF9F7',
                padding: '0.3rem 0.9rem', fontSize: '0.6rem', fontWeight: 700,
                letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none',
              }}>+ New Task</Link>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #E0E0DC', marginBottom: 0 }}>
          {([
            { id: 'all' as Filter, label: 'All' },
            { id: 'open' as Filter, label: 'Open' },
            { id: 'in_progress' as Filter, label: 'In Progress' },
            { id: 'done' as Filter, label: 'Done' },
          ]).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '0.9rem 1.25rem 0.9rem 0', marginRight: '1.25rem',
              fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: filter === f.id ? '#E63946' : '#AAA',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              borderBottom: filter === f.id ? '2px solid #E63946' : '2px solid transparent',
              background: 'transparent', cursor: 'pointer',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Task list */}
        <div>
          {filtered.length === 0 && (
            <div style={{ padding: '4rem 0', textAlign: 'center', color: '#AAA' }}>
              <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.5rem', fontStyle: 'italic' }}>No tasks found.</p>
            </div>
          )}
          {filtered.map(task => (
            <div key={task.id} style={{
              borderBottom: '1px solid #E0E0DC', padding: '1.4rem 0',
              display: 'grid', gridTemplateColumns: '1fr auto',
              gap: '1.5rem', alignItems: 'center', cursor: 'pointer',
            }}>
              <div>
                <h3 style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 'clamp(1.05rem, 2.5vw, 1.4rem)', fontWeight: 400,
                  lineHeight: 1.25, marginBottom: '0.4rem',
                  color: task.status === 'DONE' ? '#C0C0BA' : task.overdue ? '#E63946' : '#1A1A18',
                  textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                  fontStyle: task.overdue ? 'italic' : 'normal',
                }}>{task.title}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', fontSize: '0.68rem', color: '#888', alignItems: 'center' }}>
                  {task.assignee ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{
                        width: '1.2rem', height: '1.2rem', borderRadius: '50%',
                        background: task.avatarColor, color: '#fff',
                        fontSize: '0.5rem', fontWeight: 800,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>{task.assignee[0]}</span>
                      {task.assignee}
                    </span>
                  ) : <span style={{ fontStyle: 'italic' }}>Unassigned</span>}
                  {task.dueLabel && (
                    <span style={{ color: task.overdue ? '#E63946' : task.dueToday ? '#D97706' : '#888' }}>
                      Due {task.dueLabel}
                    </span>
                  )}
                  {task.checklistTotal > 0 && <span>{task.checklistDone}/{task.checklistTotal} subtasks</span>}
                </div>
              </div>
              <div>
                <span style={{
                  fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: STATUS_COLOR[task.status],
                  border: `1px solid ${STATUS_COLOR[task.status]}`,
                  padding: '0.22rem 0.55rem', display: 'inline-block',
                }}>{STATUS_LABEL[task.status]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Switcher current={1} />
    </>
  );
}
