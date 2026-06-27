'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MOCK_TASKS, VARIANTS } from '../_mock';
import type { MockStatus } from '../_mock';

type Filter = 'all' | 'open' | 'doing' | 'done';

const PASTELS = [
  { bg: '#FFE5D9', pin: '#E65C2A', shadow: 'rgba(230,92,42,0.18)' },
  { bg: '#E8E0F7', pin: '#7C3AED', shadow: 'rgba(124,58,237,0.18)' },
  { bg: '#D4F5E9', pin: '#059669', shadow: 'rgba(5,150,105,0.18)' },
  { bg: '#FFF8D6', pin: '#D97706', shadow: 'rgba(217,119,6,0.18)' },
  { bg: '#FFE0E9', pin: '#E11D48', shadow: 'rgba(225,29,72,0.18)' },
];

const ROTATIONS = [-1.4, 0.9, -0.6, 1.2, -0.8, 0.7, -1.1];
const STATUS_EMOJI: Record<MockStatus, string> = { OPEN: '🔴', IN_PROGRESS: '🟡', DONE: '✅' };
const STATUS_LABEL: Record<MockStatus, string> = { OPEN: 'To do', IN_PROGRESS: 'Doing', DONE: 'Done!' };

function Switcher({ current }: { current: number }) {
  return (
    <div style={{
      position: 'fixed', bottom: '7rem', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '0.25rem', background: 'rgba(10,10,10,0.88)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderRadius: '9999px', padding: '0.4rem 0.65rem', zIndex: 9999,
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
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

export default function StickyPreview() {
  const [filter, setFilter] = useState<Filter>('all');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.background, body: body.style.background };
    html.style.background = '#F5EDD6';
    body.style.background = '#F5EDD6';
    return () => { html.style.background = prev.html; body.style.background = prev.body; };
  }, []);

  const filtered = MOCK_TASKS.filter(t =>
    filter === 'all' ? true :
    filter === 'open' ? t.status === 'OPEN' :
    filter === 'doing' ? t.status === 'IN_PROGRESS' :
    t.status === 'DONE'
  );

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        .sticky-page { font-family: 'Nunito', 'Helvetica Rounded', sans-serif; }
      `}</style>

      <div className="sticky-page" style={{ minHeight: '100vh', background: '#F5EDD6', color: '#2D2010' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontFamily: 'Nunito, sans-serif', fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 900, color: '#2D2010', lineHeight: 1.1, margin: 0 }}>
                📋 Our Tasks
              </h1>
              <p style={{ fontSize: '0.85rem', color: '#8B6F4A', marginTop: '0.3rem', fontWeight: 600 }}>
                {MOCK_TASKS.filter(t => t.status !== 'DONE').length} things to do 💪
              </p>
            </div>
            <Link href="/tasks/new" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: '#2D2010', color: '#F5EDD6',
              padding: '0.55rem 1.1rem', borderRadius: '9999px',
              fontSize: '0.8rem', fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(45,32,16,0.25)',
              fontFamily: 'Nunito, sans-serif',
            }}>+ New</Link>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
          {([
            { id: 'all' as Filter, label: '🗂️ All' },
            { id: 'open' as Filter, label: '🔴 To do' },
            { id: 'doing' as Filter, label: '🟡 Doing' },
            { id: 'done' as Filter, label: '✅ Done' },
          ]).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              fontFamily: 'Nunito, sans-serif', fontSize: '0.8rem', fontWeight: 700,
              padding: '0.4rem 1rem', borderRadius: '9999px', cursor: 'pointer',
              background: filter === f.id ? '#2D2010' : 'rgba(45,32,16,0.08)',
              color: filter === f.id ? '#F5EDD6' : '#8B6F4A',
              border: 'none', transition: 'all 0.15s',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Sticky note grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#8B6F4A', fontSize: '1.1rem', fontWeight: 700 }}>
              Nothing here yet! 🎉
            </div>
          )}
          {filtered.map((task, i) => {
            const p = PASTELS[i % PASTELS.length];
            const rot = ROTATIONS[i % ROTATIONS.length];
            const isHov = hovered === task.id;
            return (
              <div
                key={task.id}
                onMouseEnter={() => setHovered(task.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: p.bg,
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transform: isHov ? `rotate(0deg) scale(1.04) translateY(-4px)` : `rotate(${rot}deg)`,
                  boxShadow: isHov
                    ? `0 12px 32px ${p.shadow}, 0 2px 8px rgba(0,0,0,0.1)`
                    : `0 4px 16px ${p.shadow}, 0 1px 4px rgba(0,0,0,0.08)`,
                  transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease',
                  position: 'relative',
                  minHeight: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Pin */}
                <div style={{
                  position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: p.pin, boxShadow: `0 2px 6px ${p.shadow}`,
                  border: '2px solid rgba(255,255,255,0.6)',
                }} />

                {/* Status emoji */}
                <div style={{ fontSize: '1.6rem', marginBottom: '0.6rem', marginTop: '0.35rem' }}>
                  {STATUS_EMOJI[task.status]}
                </div>

                {/* Title */}
                <h3 style={{
                  fontFamily: 'Nunito, sans-serif', fontSize: '0.92rem', fontWeight: 800,
                  color: '#2D2010', lineHeight: 1.3, margin: '0 0 0.5rem',
                  textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                  opacity: task.status === 'DONE' ? 0.5 : 1,
                  flex: 1,
                }}>{task.title}</h3>

                {/* Meta */}
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: p.pin, marginBottom: '0.25rem' }}>
                    {STATUS_LABEL[task.status]}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#8B6F4A', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{task.assignee ?? 'Anyone'}</span>
                    <span>{task.dueLabel ? `📅 ${task.dueLabel}` : ''}</span>
                  </div>
                  {task.checklistTotal > 0 && (
                    <div style={{ marginTop: '0.5rem', height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '9999px',
                        background: p.pin,
                        width: `${Math.round((task.checklistDone / task.checklistTotal) * 100)}%`,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Switcher current={3} />
    </>
  );
}
