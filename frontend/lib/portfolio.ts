/**
 * Portfolio (finance) API client for FamilyAdmin
 * All functions use apiFetch/apiFetchMultipart from lib/api.ts (auth token injected automatically).
 */

import { apiFetch, apiFetchMultipart } from './api';
import type { User } from './auth';

// ─── Types ─────────────────────────────────────────────────────────────────

export type AnalysisType = 'WEEKLY' | 'REBALANCING' | 'ON_DEMAND';

export interface PortfolioPosition {
  id: string;
  ticker: string;
  name: string | null;
  shares: number;
  purchasePrice: number;
  purchaseDate: string; // "YYYY-MM-DD"
  currentPrice: number | null;
  currentValue: number | null;
  costBasis: number;
  gainLoss: number | null;
  gainLossPercent: number | null;
  priceUpdatedAt: string | null;
  currency: string;
}

export interface PortfolioAnalysis {
  id: string;
  analysisType: AnalysisType;
  content: string;
  createdAt: string;
}

export interface Portfolio {
  id: string;
  name: string;
  createdBy: User;
  totalCostBasis: number;
  totalCurrentValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  positions: PortfolioPosition[];
  analyses: PortfolioAnalysis[];
  sharedWith: User[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioRequest {
  name: string;
}

export interface PortfolioPositionRequest {
  ticker: string;
  name?: string;
  shares: number;
  purchasePrice: number;
  purchaseDate: string; // "YYYY-MM-DD"
}

export interface PortfolioImportResult {
  importedCount: number;
  warnings: string[];
  portfolio: Portfolio;
}

export interface PortfolioSnapshot {
  date: string; // "YYYY-MM-DD"
  totalValue: number;
}

// ─── API Functions ──────────────────────────────────────────────────────────

export async function getPortfolios(): Promise<Portfolio[]> {
  return apiFetch<Portfolio[]>('/api/portfolios');
}

export async function getPortfolio(id: string): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/api/portfolios/${id}`);
}

export async function createPortfolio(data: PortfolioRequest): Promise<Portfolio> {
  return apiFetch<Portfolio>('/api/portfolios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deletePortfolio(id: string): Promise<void> {
  return apiFetch<void>(`/api/portfolios/${id}`, { method: 'DELETE' });
}

export async function addPosition(
  portfolioId: string,
  data: PortfolioPositionRequest,
): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/api/portfolios/${portfolioId}/positions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePosition(
  portfolioId: string,
  positionId: string,
  data: PortfolioPositionRequest,
): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/api/portfolios/${portfolioId}/positions/${positionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePosition(portfolioId: string, positionId: string): Promise<void> {
  return apiFetch<void>(`/api/portfolios/${portfolioId}/positions/${positionId}`, {
    method: 'DELETE',
  });
}

export async function importPortfolioFile(
  portfolioId: string,
  file: File,
): Promise<PortfolioImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchMultipart<PortfolioImportResult>(`/api/portfolios/${portfolioId}/import`, formData);
}

export async function refreshPrices(portfolioId: string): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/api/portfolios/${portfolioId}/refresh-prices`, { method: 'POST' });
}

export async function runAnalysis(
  portfolioId: string,
  type: AnalysisType = 'ON_DEMAND',
): Promise<PortfolioAnalysis> {
  return apiFetch<PortfolioAnalysis>(
    `/api/portfolios/${portfolioId}/analyze?type=${type}`,
    { method: 'POST' },
  );
}

export async function sharePortfolio(portfolioId: string, userId: string): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/api/portfolios/${portfolioId}/shares/${userId}`, { method: 'PUT' });
}

export async function revokePortfolioShare(portfolioId: string, userId: string): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/api/portfolios/${portfolioId}/shares/${userId}`, { method: 'DELETE' });
}

export async function getPortfolioSnapshots(portfolioId: string): Promise<PortfolioSnapshot[]> {
  return apiFetch<PortfolioSnapshot[]>(`/api/portfolios/${portfolioId}/snapshots`);
}
