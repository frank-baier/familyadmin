'use client';
import Link from 'next/link';
import { VARIANTS } from './_mock';

const DESCRIPTIONS = [
  'Tasks as newspaper headlines. Serif typography, hairline rules, crimson accents — authoritative and clean.',
  'CLI-inspired dashboard. Monospace font, ASCII borders, green-on-black — technical and focused.',
  'Physical pinboard energy. Pastel sticky notes, emoji status, playful rotations — warm and joyful.',
  'Graphic-design precision. Thick borders, Bauhaus typography, primary color coding — bold and no-nonsense.',
  'Premium notebook feel. Deep black, warm cream, gold hover accent — calm and refined.',
];

export default function PreviewIndex() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Tasks page — 5 design concepts</h1>
        <p className="text-sm text-slate-500 mt-1">Click any card to explore the live preview. Pick your favourite and we&apos;ll apply it.</p>
      </div>
      <div className="space-y-3">
        {VARIANTS.map((v, i) => (
          <Link
            key={v.id}
            href={`/tasks/preview/${v.id}`}
            className="glass rounded-2xl px-5 py-4 flex items-center gap-4 hover:shadow-md transition-all group no-underline"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
              style={{ background: ['#E63946','#00FF9D','#7C3AED','#1D4ED8','#C9A96E'][i], color: i === 1 ? '#050505' : '#fff' }}
            >
              {v.id}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                {v.name} <span className="text-slate-400 font-normal text-sm">— {v.sub}</span>
              </div>
              <div className="text-sm text-slate-500 mt-0.5 truncate">{DESCRIPTIONS[i]}</div>
            </div>
            <div className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
