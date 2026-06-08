'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import internshipService, {
  type InternshipApplication,
  type InternshipTrack,
  type InternshipCohort,
} from '@/services/api/internship.service';
import {
  Search, ChevronLeft, ChevronRight, ArrowUpDown, Eye, FileText, RefreshCw,
  Download, Users, GraduationCap, Award, CheckCircle, XCircle, Clock,
  TrendingUp, Activity, Star, X, Mail, Phone, Calendar,
  ExternalLink, User, BookOpen, AlertTriangle, Send, Share2
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────

const formatDate = (d: string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const formatDateTime = (d: string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const OFFER_STATUS_COLORS: Record<string, string> = {
  sent: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  accepted: 'bg-green-900/40 text-green-300 border-green-700/40',
  declined: 'bg-red-900/40 text-red-300 border-red-700/40',
  revoked: 'bg-gray-900/40 text-gray-400 border-gray-700/40',
};

const ProgressBar = ({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) => {
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' };
  const colors = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : value >= 25 ? 'bg-blue-500' : 'bg-gray-500';
  return (
    <div className={`w-full ${heights[size]} bg-white/10 rounded-full overflow-hidden`}>
      <div
        className={`${heights[size]} ${colors} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
};

const StatCard = ({ title, value, icon, color, bgColor, sub }: {
  title: string; value: number | string; icon: React.ReactNode;
  color: string; bgColor: string; sub?: string;
}) => (
  <div className="bg-[#162844] rounded-xl border border-white/10 p-5 hover:shadow-lg hover:shadow-blue-900/10 transition-all duration-200 group">
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2.5 rounded-lg ${bgColor} group-hover:scale-110 transition-transform`}>
        <span className={color}>{icon}</span>
      </div>
    </div>
    <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide">{title}</h3>
    <p className="text-2xl font-bold text-white mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
  </div>
);

// ═════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════

const AdminInternsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [interns, setInterns] = useState<any[]>([]);
  const [summary, setSummary] = useState<{
    total_accepted: number; with_cohort: number; unassigned: number;
    with_offers: number; offers_accepted: number;
  } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 50, total: 0, pages: 0 });
  const [tracks, setTracks] = useState<InternshipTrack[]>([]);
  const [cohorts, setCohorts] = useState<InternshipCohort[]>([]);

  // Filters
  const [cohortFilter, setCohortFilter] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [offerStatusFilter, setOfferStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('full_name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Detail modal
  const [selectedIntern, setSelectedIntern] = useState<any>(null);

  // Export
  const [exporting, setExporting] = useState(false);

  // Batch
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Data Fetching ──────────────────────────────────────────────────

  const fetchInterns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await internshipService.getAdminInterns({
        cohort_id: cohortFilter || undefined,
        track_id: trackFilter || undefined,
        search: searchQuery || undefined,
        offer_status: offerStatusFilter || undefined,
        page,
        per_page: 50,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setInterns(Array.isArray(result.data) ? result.data : []);
      setPagination({ page: result.page, per_page: result.per_page, total: result.total, pages: result.pages });
      if ((result as any).summary) setSummary((result as any).summary);
    } catch (err: any) {
      setError(err?.message || 'Failed to load interns');
    } finally {
      setLoading(false);
    }
  }, [cohortFilter, trackFilter, searchQuery, offerStatusFilter, page, sortBy, sortOrder]);

  const fetchFilters = useCallback(async () => {
    try {
      const [tracksResult, cohortsResult] = await Promise.all([
        internshipService.getAdminTracks(),
        internshipService.getAdminCohorts({ per_page: 100 }),
      ]);
      setTracks(Array.isArray(tracksResult) ? tracksResult : []);
      setCohorts(Array.isArray(cohortsResult.data) ? cohortsResult.data : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchInterns(); }, [fetchInterns]);

  // Deselect on page/filter change
  useEffect(() => { setSelectedIds(new Set()); }, [page, cohortFilter, trackFilter, searchQuery, offerStatusFilter]);

  // ── Selection ──────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === interns.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(interns.map(i => i.id)));
  };

  // ── Sorting ────────────────────────────────────────────────────────

  const handleSort = (column: string) => {
    if (sortBy === column) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(column); setSortOrder('asc'); }
    setPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => (
    <ArrowUpDown className={`h-3 w-3 inline ml-0.5 ${sortBy === column ? 'text-blue-400' : 'text-gray-500'}`} />
  );

  // ── Export CSV ─────────────────────────────────────────────────────

  const handleExport = () => {
    setExporting(true);
    try {
      const url = internshipService.getInternsExportUrl({
        cohort_id: cohortFilter || undefined,
        track_id: trackFilter || undefined,
      });
      window.open(url, '_blank');
      setTimeout(() => setExporting(false), 2000);
    } catch {
      setExporting(false);
    }
  };

  // ── Clear Filters ──────────────────────────────────────────────────

  const clearFilters = () => {
    setCohortFilter('');
    setTrackFilter('');
    setSearchQuery('');
    setOfferStatusFilter('');
    setPage(1);
  };

  const hasFilters = cohortFilter || trackFilter || searchQuery || offerStatusFilter;

  // ── Loading ────────────────────────────────────────────────────────

  if (loading && interns.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading interns...</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Intern Management</h1>
          <p className="text-gray-400 mt-1">Manage accepted interns, track progress, and oversee offerings</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting || interns.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={fetchInterns}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#162844] border border-white/10 rounded-lg hover:bg-white/5 transition text-gray-300 disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ═══ Stats Summary ═══ */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            title="Total Interns"
            value={summary.total_accepted}
            icon={<Users className="h-5 w-5" />}
            color="text-blue-400"
            bgColor="bg-blue-900/40"
          />
          <StatCard
            title="In Cohorts"
            value={summary.with_cohort}
            icon={<GraduationCap className="h-5 w-5" />}
            color="text-green-400"
            bgColor="bg-green-900/40"
            sub={`${summary.unassigned} unassigned`}
          />
          <StatCard
            title="Offers Sent"
            value={summary.with_offers}
            icon={<Award className="h-5 w-5" />}
            color="text-purple-400"
            bgColor="bg-purple-900/40"
          />
          <StatCard
            title="Offers Accepted"
            value={summary.offers_accepted}
            icon={<CheckCircle className="h-5 w-5" />}
            color="text-teal-400"
            bgColor="bg-teal-900/40"
          />
          <StatCard
            title="Placement Rate"
            value={summary.total_accepted > 0 ? `${Math.round((summary.offers_accepted / summary.total_accepted) * 100)}%` : '0%'}
            icon={<TrendingUp className="h-5 w-5" />}
            color="text-amber-400"
            bgColor="bg-amber-900/40"
            sub={`${summary.total_accepted - summary.with_offers} pending offers`}
          />
        </div>
      )}

      {/* ═══ Unassigned Alert ═══ */}
      {summary && summary.unassigned > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-300 font-medium text-sm">
                {summary.unassigned} accepted intern(s) not assigned to any cohort
              </p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                <Link href="/admin/internships/cohorts" className="underline hover:text-amber-300">
                  Create or assign cohorts
                </Link>{' '}
                to help track their progress and assign tasks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Filters ═══ */}
      <div className="bg-[#162844] rounded-xl border border-white/10 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search by name, email, or reference code..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
            />
          </div>

          {/* Cohort Filter */}
          <select
            value={cohortFilter}
            onChange={e => { setCohortFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm min-w-[160px]"
          >
            <option value="">All Cohorts</option>
            {cohorts.map(c => (
              <option key={c.id} value={c.id}>{c.cohort_name} ({c.cohort_code})</option>
            ))}
          </select>

          {/* Track Filter */}
          <select
            value={trackFilter}
            onChange={e => { setTrackFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm min-w-[140px]"
          >
            <option value="">All Tracks</option>
            {tracks.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Offer Status Filter */}
          <select
            value={offerStatusFilter}
            onChange={e => { setOfferStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm min-w-[130px]"
          >
            <option value="">All Offers</option>
            <option value="sent">Offer Sent</option>
            <option value="accepted">Offer Accepted</option>
            <option value="declined">Offer Declined</option>
            <option value="revoked">Offer Revoked</option>
          </select>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-400 hover:text-white transition text-sm"
              title="Clear filters"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {pagination.total > 0
              ? `${interns.length} of ${pagination.total} intern${pagination.total !== 1 ? 's' : ''}`
              : 'No interns found'}
          </p>
          {selectedIds.size > 0 && (
            <p className="text-xs text-blue-400 font-medium">{selectedIds.size} selected</p>
          )}
        </div>
      </div>

      {/* ═══ Error ═══ */}
      {error && (
        <div className="bg-red-900/20 border border-red-200 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      )}

      {/* ═══ Interns Table ═══ */}
      {interns.length > 0 ? (
        <div className="bg-[#162844] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#0a1628]/50">
                  <th className="w-10 py-3.5 px-3 text-center">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white transition">
                      {selectedIds.size === interns.length ? (
                        <span className="h-4 w-4 inline-flex items-center justify-center bg-blue-500 text-white rounded text-[10px] font-bold">✓</span>
                      ) : (
                        <span className="h-4 w-4 inline-block border border-white/30 rounded" />
                      )}
                    </button>
                  </th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('full_name')} className="flex items-center gap-1 hover:text-white transition">
                      Intern <SortIcon column="full_name" />
                    </button>
                  </th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Contact</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Ref Code</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Track</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Cohort</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Progress</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Avg Score</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Offer</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {interns.map((intern) => {
                  const ts = intern.task_stats || {};
                  const pct = ts.progress_pct || 0;
                  return (
                    <tr
                      key={intern.id}
                      className={`border-b border-white/5 transition ${
                        selectedIds.has(intern.id) ? 'bg-blue-900/15 hover:bg-blue-900/25' : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Select */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => toggleSelect(intern.id)}
                          className="text-gray-400 hover:text-white transition"
                        >
                          {selectedIds.has(intern.id) ? (
                            <span className="h-4 w-4 inline-flex items-center justify-center bg-blue-500 text-white rounded text-[10px] font-bold">✓</span>
                          ) : (
                            <span className="h-4 w-4 inline-block border border-white/30 rounded" />
                          )}
                        </button>
                      </td>

                      {/* Name + Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-white">{intern.full_name?.charAt(0) || '?'}</span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{intern.full_name}</p>
                            <p className="text-gray-500 text-xs capitalize">{intern.applicant_type?.replace('_', ' ') || '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <p className="text-gray-300 text-xs">{intern.email}</p>
                        <p className="text-gray-500 text-xs">{intern.phone}</p>
                      </td>

                      {/* Ref Code */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded">
                          {intern.reference_code}
                        </span>
                      </td>

                      {/* Track */}
                      <td className="py-3.5 px-4 text-gray-300 text-xs">{intern.track_name || '—'}</td>

                      {/* Cohort */}
                      <td className="py-3.5 px-4">
                        {intern.cohort_code ? (
                          <span className="text-gray-300 text-xs font-mono">{intern.cohort_code}</span>
                        ) : (
                          <span className="text-amber-500 text-xs">Unassigned</span>
                        )}
                      </td>

                      {/* Progress */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1">
                            <ProgressBar value={pct} size="sm" />
                          </div>
                          <span className={`text-xs font-medium w-8 text-right ${
                            pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-amber-400' : 'text-gray-400'
                          }`}>
                            {pct}%
                          </span>
                        </div>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {ts.completed || 0}/{ts.total_assigned || 0} done
                        </p>
                      </td>

                      {/* Avg Score */}
                      <td className="py-3.5 px-4 text-center">
                        {ts.avg_score !== null && ts.avg_score !== undefined ? (
                          <span className={`text-sm font-semibold ${
                            ts.avg_score >= 80 ? 'text-green-400' : ts.avg_score >= 60 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {ts.avg_score}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Offer Status */}
                      <td className="py-3.5 px-4">
                        {intern.offer ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${OFFER_STATUS_COLORS[intern.offer.status] || ''}`}>
                            {intern.offer.status === 'accepted' ? (
                              <><CheckCircle className="h-3 w-3 inline mr-0.5" /> Accepted</>
                            ) : intern.offer.status === 'sent' ? (
                              <><Send className="h-3 w-3 inline mr-0.5" /> Sent</>
                            ) : (
                              intern.offer.status
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedIntern(intern)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/40 transition text-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-[#0a1628]/50">
              <p className="text-sm text-gray-400">Page {pagination.page} of {pagination.pages}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 bg-[#0a1628] border border-white/10 rounded-lg hover:bg-white/5 transition disabled:opacity-50 text-gray-400"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(5, pagination.pages) }).map((_, i) => {
                  const pageNum = Math.max(1, Math.min(pagination.pages - 4, page - 2)) + i;
                  if (pageNum > pagination.pages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        pageNum === page ? 'bg-blue-600 text-white' : 'bg-[#0a1628] border border-white/10 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                  className="p-2 bg-[#0a1628] border border-white/10 rounded-lg hover:bg-white/5 transition disabled:opacity-50 text-gray-400"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#162844] rounded-xl border border-white/10 p-16 text-center">
          <Users className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {hasFilters ? 'No Interns Found' : 'No Accepted Interns Yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {hasFilters
              ? 'Try adjusting your filters to find interns'
              : 'Accept internship applications to start managing interns here'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium">
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          INTERN DETAIL MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {selectedIntern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedIntern(null)} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* ── Modal Header ── */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#162844] z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">{selectedIntern.full_name?.charAt(0) || '?'}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedIntern.full_name}</h2>
                  <p className="text-gray-400 text-sm">
                    {selectedIntern.track_name || 'No track'} · Ref: <span className="font-mono text-blue-400">{selectedIntern.reference_code}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedIntern(null)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* ── Quick Info Grid ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#0a1628] rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </div>
                  <p className="text-white text-sm truncate">{selectedIntern.email}</p>
                </div>
                <div className="bg-[#0a1628] rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Phone className="h-3.5 w-3.5" /> Phone
                  </div>
                  <p className="text-white text-sm">{selectedIntern.phone || '—'}</p>
                </div>
                <div className="bg-[#0a1628] rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Calendar className="h-3.5 w-3.5" /> Applied
                  </div>
                  <p className="text-white text-sm">{formatDate(selectedIntern.created_at)}</p>
                </div>
                <div className="bg-[#0a1628] rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <User className="h-3.5 w-3.5" /> Type
                  </div>
                  <p className="text-white text-sm capitalize">{selectedIntern.applicant_type?.replace('_', ' ') || '—'}</p>
                </div>
              </div>

              {/* ── Cohort & Offer Status ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cohort Info */}
                <div className="bg-[#0a1628] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-green-400" />
                    Cohort Assignment
                  </h3>
                  {selectedIntern.cohort_code ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white font-medium">{selectedIntern.cohort_code}</span>
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-400">{selectedIntern.track_name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <span className="text-amber-400 text-sm">Not assigned to any cohort</span>
                    </div>
                  )}
                  <Link
                    href={`/admin/internships/applications/${selectedIntern.id}`}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="h-3 w-3" /> View full application
                  </Link>
                </div>

                {/* Offer Info */}
                <div className="bg-[#0a1628] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-400" />
                    Offer Letter
                  </h3>
                  {selectedIntern.offer ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">#{selectedIntern.offer.offer_number}</span>
                        <span className={`px-2.5 py-0.5 rounded text-xs font-medium border ${OFFER_STATUS_COLORS[selectedIntern.offer.status] || ''}`}>
                          {selectedIntern.offer.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">Sent: {formatDateTime(selectedIntern.offer.sent_at)}</p>
                      {selectedIntern.offer.social_shares > 0 && (
                        <p className="text-gray-500 text-xs flex items-center gap-1">
                          <Share2 className="h-3 w-3" /> Shared {selectedIntern.offer.social_shares} time(s)
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-400 text-sm">No offer letter generated yet</span>
                    </div>
                  )}
                  <Link
                    href={`/admin/internships/applications/${selectedIntern.id}`}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Award className="h-3 w-3" /> {selectedIntern.offer ? 'View / Manage Offer' : 'Generate Offer'}
                  </Link>
                </div>
              </div>

              {/* ── Task Progress ── */}
              {selectedIntern.task_stats && (
                <div className="bg-[#0a1628] rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-400" />
                    Task Progress
                  </h3>

                  {/* Progress Overview */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Overall Progress</span>
                      <span className={`text-lg font-bold ${
                        (selectedIntern.task_stats.progress_pct || 0) >= 80 ? 'text-green-400' :
                        (selectedIntern.task_stats.progress_pct || 0) >= 50 ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {selectedIntern.task_stats.progress_pct || 0}%
                      </span>
                    </div>
                    <ProgressBar value={selectedIntern.task_stats.progress_pct || 0} size="lg" />
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-5 gap-3">
                    <div className="bg-[#0a1628]/50 border border-white/5 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-400">{selectedIntern.task_stats.total_assigned || 0}</p>
                      <p className="text-[10px] text-gray-500 mt-1">Total Tasks</p>
                    </div>
                    <div className="bg-[#0a1628]/50 border border-white/5 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-green-400">{selectedIntern.task_stats.completed || 0}</p>
                      <p className="text-[10px] text-gray-500 mt-1">Completed</p>
                    </div>
                    <div className="bg-[#0a1628]/50 border border-white/5 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-purple-400">{selectedIntern.task_stats.submitted || 0}</p>
                      <p className="text-[10px] text-gray-500 mt-1">Submitted</p>
                    </div>
                    <div className="bg-[#0a1628]/50 border border-white/5 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-amber-400">{selectedIntern.task_stats.in_progress || 0}</p>
                      <p className="text-[10px] text-gray-500 mt-1">In Progress</p>
                    </div>
                    <div className="bg-[#0a1628]/50 border border-white/5 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-400">{selectedIntern.task_stats.pending || 0}</p>
                      <p className="text-[10px] text-gray-500 mt-1">Pending</p>
                    </div>
                  </div>

                  {/* Avg Score */}
                  {selectedIntern.task_stats.avg_score !== null && selectedIntern.task_stats.avg_score !== undefined && (
                    <div className="mt-4 flex items-center gap-2 bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                      <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                      <div>
                        <span className="text-white font-semibold text-lg">{selectedIntern.task_stats.avg_score}</span>
                        <span className="text-gray-400 text-sm ml-1">average score across {selectedIntern.task_stats.completed || 0} completed task(s)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Contact & Links ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0a1628] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-purple-400" />
                    Links
                  </h3>
                  <div className="space-y-2">
                    {selectedIntern.portfolio_url && (
                      <a href={selectedIntern.portfolio_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                        <ExternalLink className="h-3.5 w-3.5" /> Portfolio
                      </a>
                    )}
                    {selectedIntern.github_url && (
                      <a href={selectedIntern.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                        <ExternalLink className="h-3.5 w-3.5" /> GitHub
                      </a>
                    )}
                    {selectedIntern.linkedin_url && (
                      <a href={selectedIntern.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                        <ExternalLink className="h-3.5 w-3.5" /> LinkedIn
                      </a>
                    )}
                    {!selectedIntern.portfolio_url && !selectedIntern.github_url && !selectedIntern.linkedin_url && (
                      <p className="text-gray-500 text-sm">No links provided</p>
                    )}
                  </div>
                </div>

                <div className="bg-[#0a1628] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-400" />
                    Timeline
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Applied</span>
                      <span className="text-white">{formatDateTime(selectedIntern.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Accepted</span>
                      <span className="text-white">{formatDateTime(selectedIntern.reviewed_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Updated</span>
                      <span className="text-white">{formatDateTime(selectedIntern.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <Link
                href={`/admin/internships/applications/${selectedIntern.id}`}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm"
              >
                <ExternalLink className="h-4 w-4" /> Full Application Details
              </Link>
              <button
                onClick={() => setSelectedIntern(null)}
                className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInternsPage;
