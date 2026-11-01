/**
 * Public recipe page — /share/recipes/[token]
 * Reachable without login (see PUBLIC_PATHS in proxy.ts). Server-rendered so that
 * WhatsApp & co. can build a link preview from the Open Graph tags.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSharedRecipe } from '@/lib/recipes-public';

interface PageProps {
  params: Promise<{ token: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

function formatTime(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatAmount(amount: number | null, unit: string): string {
  if (amount == null) return unit || '';
  const amtStr = Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(/\.0$/, '');
  return unit ? `${amtStr} ${unit}` : amtStr;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const recipe = await getSharedRecipe(token);
  const base: Metadata = {
    robots: { index: false, follow: false },
    // Don't leak the token to external sites linked from the recipe (e.g. sourceUrl)
    referrer: 'no-referrer',
  };
  if (!recipe) return { ...base, title: 'Rezept nicht gefunden' };

  const description = recipe.description?.slice(0, 200) ?? 'Ein Rezept aus der Familienküche';
  return {
    ...base,
    metadataBase: new URL(SITE_URL),
    title: recipe.title,
    description,
    openGraph: {
      title: recipe.title,
      description,
      type: 'article',
      ...(recipe.photoUrl ? { images: [{ url: recipe.photoUrl }] } : {}),
    },
  };
}

export default async function SharedRecipePage({ params }: PageProps) {
  const { token } = await params;
  const recipe = await getSharedRecipe(token);
  if (!recipe) notFound();

  const ingredients = [...recipe.ingredients].sort((a, b) => a.position - b.position);
  const steps = [...recipe.steps].sort((a, b) => a.position - b.position);
  const total = recipe.totalMinutes ?? ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || null);

  const meta = [
    recipe.prepMinutes != null && ['Vorbereitung', formatTime(recipe.prepMinutes)],
    recipe.cookMinutes != null && ['Kochen', formatTime(recipe.cookMinutes)],
    total != null && ['Gesamt', formatTime(total)],
    recipe.servings != null && ['Portionen', String(recipe.servings)],
    recipe.difficulty && ['Schwierigkeit', recipe.difficulty],
  ].filter(Boolean) as [string, string][];

  return (
    <main className="max-w-3xl w-full mx-auto px-4 py-6 sm:py-10">
      {recipe.photoUrl && (
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-slate-100 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recipe.photoUrl} alt={recipe.title} className="w-full h-full object-cover" />
        </div>
      )}

      <article className="glass rounded-3xl overflow-hidden">
        <header className="px-6 pt-6 pb-4">
          <h1 className="text-2xl font-bold text-slate-900 leading-snug tracking-tight">{recipe.title}</h1>
          {meta.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-slate-500">
              {meta.map(([label, value]) => (
                <span key={label}>
                  {label}: <strong className="text-slate-700">{value}</strong>
                </span>
              ))}
            </div>
          )}
        </header>

        {recipe.description && (
          <>
            <div className="hairline mx-4" />
            <div className="px-6 py-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{recipe.description}</p>
            </div>
          </>
        )}

        {ingredients.length > 0 && (
          <>
            <div className="hairline mx-4" />
            <section className="px-6 py-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Zutaten</h2>
              <ul className="space-y-2">
                {ingredients.map((ing, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span className="text-sm text-slate-500 w-24 shrink-0 text-right">
                      {formatAmount(ing.amount, ing.unit)}
                    </span>
                    <span className="text-sm text-slate-800 font-medium">{ing.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {steps.length > 0 && (
          <>
            <div className="hairline mx-4" />
            <section className="px-6 py-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Zubereitung</h2>
              <ol className="space-y-4">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed flex-1 whitespace-pre-wrap">{step.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        {(recipe.source || recipe.sourceUrl) && (
          <>
            <div className="hairline mx-4" />
            <footer className="px-6 py-4 text-xs text-slate-400">
              Quelle:{' '}
              {recipe.sourceUrl ? (
                <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
                  {recipe.source || recipe.sourceUrl}
                </a>
              ) : (
                recipe.source
              )}
            </footer>
          </>
        )}
      </article>
    </main>
  );
}
