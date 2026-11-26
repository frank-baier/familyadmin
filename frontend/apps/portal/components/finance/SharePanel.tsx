'use client';

import { useEffect, useState } from 'react';
import { getShareableUsers } from '@/lib/document-shares';
import { sharePortfolio, revokePortfolioShare } from '@/lib/portfolio';
import type { Portfolio } from '@/lib/portfolio';
import type { ShareableUser } from '@/lib/document-shares';

export function SharePanel({
  portfolio,
  onChanged,
}: {
  portfolio: Portfolio;
  onChanged: (portfolio: Portfolio) => void;
}) {
  const [candidates, setCandidates] = useState<ShareableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getShareableUsers().then(setCandidates).catch(() => setCandidates([]));
  }, []);

  const sharedIds = new Set(portfolio.sharedWith.map((u) => u.id));
  const available = candidates.filter((c) => !sharedIds.has(c.id));

  async function handleShare() {
    if (!selectedUserId) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await sharePortfolio(portfolio.id, selectedUserId);
      onChanged(updated);
      setSelectedUserId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Freigabe fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(userId: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await revokePortfolioShare(portfolio.id, userId);
      onChanged(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zugriff konnte nicht entzogen werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-3xl p-5">
      <p className="font-semibold text-slate-900">Zugriff freigeben</p>
      <p className="text-xs text-slate-400 mt-0.5 mb-4">
        Dieses Depot ist standardmäßig nur für dich sichtbar. Gib es für weitere Familienmitglieder frei.
      </p>

      {portfolio.sharedWith.length > 0 && (
        <ul className="space-y-2 mb-4">
          {portfolio.sharedWith.map((u) => (
            <li key={u.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{u.name}</span>
              <button
                onClick={() => handleRevoke(u.id)}
                disabled={busy}
                className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <div className="flex gap-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="input-field flex-1"
          >
            <option value="">Familienmitglied auswählen…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={handleShare} disabled={busy || !selectedUserId} className="btn-secondary shrink-0">
            Freigeben
          </button>
        </div>
      ) : (
        portfolio.sharedWith.length === 0 && (
          <p className="text-sm text-slate-400">Keine weiteren Familienmitglieder verfügbar.</p>
        )
      )}

      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
