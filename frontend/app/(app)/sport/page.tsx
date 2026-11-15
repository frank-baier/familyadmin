'use client';

/**
 * Sport — /sport
 * Personal training statistics from the Strava bulk export: volume, fitness/form, VO2max, habits, records.
 * Data is per user; nobody else sees it.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SportStats } from '@/lib/sport';
import { errorMessage, getSportStats } from '@/lib/sport';
import { FitnessChart } from '@/components/sport/FitnessChart';
import { EfficiencyCard, IntensityCard, Vo2maxCard } from '@/components/sport/FitnessLevel';
import { CumulativeChart, MonthsChart, YearsChart, type Metric } from '@/components/sport/VolumeCharts';
import { HabitsCard, Heatmap, Insights, KpiTiles, LifetimeCard, RecentCard, RecordsCard } from '@/components/sport/Overview';
import { SportSettings, StravaImport } from '@/components/sport/ImportAndSettings';

export default function SportPage() {
  const [stats, setStats] = useState<SportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('distance');
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStats(await getSportStats());
    } catch (err) {
      setError(errorMessage(err, 'Statistiken konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasData = (stats?.summary.activities ?? 0) > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sport</h1>
          <p className="text-slate-500 text-sm mt-1">
            {hasData && stats?.summary.lastDate
              ? `Deine Strava-Statistiken · letzte Aktivität ${new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${stats.summary.lastDate}T00:00:00`))}`
              : 'Deine Strava-Statistiken und Fitness'}
          </p>
        </div>
        {hasData && (
          <div className="flex gap-2 items-start">
            <button onClick={() => setShowSettings((s) => !s)} className="btn-ghost" aria-expanded={showSettings}>Einstellungen</button>
            <StravaImport onImported={load} compact />
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={load} className="font-medium underline shrink-0 ml-4">Erneut versuchen</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass rounded-2xl h-24 animate-pulse" />)}</div>
          <div className="glass rounded-3xl h-80 animate-pulse" />
        </div>
      ) : !hasData ? (
        !error && <StravaImport onImported={load} />
      ) : stats && (
        <>
          {showSettings && <SportSettings onSaved={load} onClose={() => setShowSettings(false)} estimatedMaxHr={stats.fitness.maxHr} />}

          <KpiTiles stats={stats} />
          <Insights insights={stats.insights} />

          <h2 className="section-label pt-2">Fitness</h2>
          <FitnessChart fitness={stats.fitness} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Vo2maxCard fitness={stats.fitness} />
            <EfficiencyCard fitness={stats.fitness} />
            <IntensityCard fitness={stats.fitness} />
            <LifetimeCard stats={stats} />
          </div>

          <h2 className="section-label pt-2">Umfang</h2>
          <CumulativeChart days={stats.days} metric={metric} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <YearsChart years={stats.years} metric={metric} onMetric={setMetric} />
            <MonthsChart months={stats.months} years={stats.years.map((y) => y.year)} metric={metric} onMetric={setMetric} />
          </div>
          <Heatmap days={stats.days} />

          <h2 className="section-label pt-2">Du &amp; dein Training</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HabitsCard stats={stats} />
            <RecordsCard records={stats.records} />
          </div>
          <RecentCard recent={stats.recent} />

          <p className="text-xs text-slate-400 leading-relaxed pb-4">
            Fitness, Form und VO₂max sind Schätzungen aus Durchschnittswerten je Aktivität (Banister-TRIMP, ACSM-Laufformel).
            Sie zeigen Trends zuverlässig, ersetzen aber keinen Leistungstest.
          </p>
        </>
      )}
    </div>
  );
}
