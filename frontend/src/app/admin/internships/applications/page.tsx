'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import internshipService, { type InternshipApplication, type InternshipTrack, type InternshipCohort, type InternshipStats } from '@/services/api/internship.service';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Eye, FileText, RefreshCw, CheckSquare, Square, Tag, Users, X, Send, CheckCircle, Award, Download, Calendar, List } from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    reviewing: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
    shortlisted: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
    interview_scheduled: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/40',
    accepted: 'bg-green-900/40 text-green-300 border-green-700/40',
    rejected: 'bg-red-900/40 text-red-300 border-red-700/40',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status] || 'bg-gray-900/40 text-gray-300'}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const InternshipApplicationsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [applications, setApplications] = useState<InternshipApplication[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [tracks, setTracks] = useState<InternshipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [trackFilter, setTrackFilter] = useState(searchParams.get('track_id') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [applicantTypeFilter, setApplicantTypeFilter] = useState(searchParams.get('applicant_type') || '');
  const [startDate, setStartDate] = useState(searchParams.get('start_date') || '');
  const [endDate, setEndDate] = useState(searchParams.get('end_date') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [perPage, setPerPage] = useState(parseInt(searchParams.get('per_page') || '20'));
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Stats summary
  const [stats, setStats] = useState<InternshipStats | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchStatusModal, setShowBatchStatusModal] = useState(false);
  const [showBatchCohortModal, setShowBatchCohortModal] = useState(false);
  const [showBatchOfferModal, setShowBatchOfferModal] = useState(false);
  const [cohorts, setCohorts] = useState<InternshipCohort[]>([]);
  const [batchStatus, setBatchStatus] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [batchCohortId, setBatchCohortId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    updated: { id: string; name: string }[];
    skipped: { id: string; name: string; reason: string }[];
    errors: { id: string; reason: string }[];
  } | null>(null);
  const [offerBatchResult, setOfferBatchResult] = useState<{
    sent: { id: string; name: string; offer_number: string; username: string }[];
    skipped: { id: string; name: string; reason: string }[];
    errors: { id: string; reason: string }[];
  } | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await internshipService.getApplications({
        status: statusFilter || undefined,
        track_id: trackFilter || undefined,
        search: searchQuery || undefined,
        applicant_type: applicantTypeFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        per_page: perPage,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setApplications(Array.isArray(result.data) ? result.data : []);
      setPagination({ page: result.page, per_page: result.per_page, total: result.total, pages: result.pages });
    } catch (err: any) {
      setError(err?.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, trackFilter, searchQuery, applicantTypeFilter, startDate, endDate, page, perPage, sortBy, sortOrder]);

  const fetchTracks = useCallback(async () => {
    try {
      const result = await internshipService.getTracks();
      setTracks(Array.isArray(result) ? result : []);
    } catch { /* ignore */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const result = await internshipService.getStats();
      setStats(result);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchTracks();
    fetchStats();
  }, [fetchTracks, fetchStats]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Deselect on page change
  useEffect(() => {
    setSelectedIds(new Set());
    setBatchResult(null);
  }, [page, statusFilter, trackFilter, searchQuery]);

  // ═══════════ Selection Handlers ═══════════

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const appArray = Array.isArray(applications) ? applications : [];
    if (selectedIds.size === appArray.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(appArray.map(a => a.id)));
    }
  };

  const selectedApps = Array.isArray(applications) ? applications.filter(a => selectedIds.has(a.id)) : [];
  const allSelectedAccepted = selectedApps.length > 0 && selectedApps.every(a => a.status === 'accepted');

  // ═══════════ Batch Status Update ═══════════

  const handleBatchStatus = async () => {
    if (!batchStatus || selectedIds.size === 0) return;
    try {
      setProcessing(true);
      const result = await internshipService.batchUpdateStatus({
        application_ids: Array.from(selectedIds),
        status: batchStatus,
        note: batchNote || undefined,
      });
      setBatchResult(result);
      if (result.errors.length === 0 && result.skipped.length === 0) {
        setShowBatchStatusModal(false);
        setBatchStatus('');
        setBatchNote('');
        setSelectedIds(new Set());
        await fetchApplications();
      }
    } catch (err: any) {
      console.error('Batch status update failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  // ═══════════ Batch Offer Letter Generation ═══════════

  const handleBatchOffer = async () => {
    if (selectedIds.size === 0) return;
    try {
      setProcessing(true);
      const result = await internshipService.batchGenerateOffers({
        application_ids: Array.from(selectedIds),
      });
      setOfferBatchResult(result);
      if (result.errors.length === 0 && result.skipped.length === 0) {
        setShowBatchOfferModal(false);
        setSelectedIds(new Set());
        await fetchApplications();
      }
    } catch (err: any) {
      console.error('Batch offer generation failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  // ═══════════ Batch Cohort Assignment ═══════════

  const openBatchCohortModal = async () => {
    setShowBatchCohortModal(true);
    setBatchCohortId('');
    setBatchResult(null);
    try {
      const result = await internshipService.getAdminCohorts({ per_page: 100 });
      setCohorts(Array.isArray(result.data) ? result.data : []);
    } catch { /* ignore */ }
  };

  const handleBatchCohortAssign = async () => {
    if (!batchCohortId || selectedIds.size === 0) return;
    try {
      setProcessing(true);
      const result = await internshipService.batchAssignCohort({
        application_ids: Array.from(selectedIds),
        cohort_id: batchCohortId,
      });
      setBatchResult(result);
      if (result.errors.length === 0 && result.skipped.length === 0) {
        setShowBatchCohortModal(false);
        setBatchCohortId('');
        setSelectedIds(new Set());
        await fetchApplications();
      }
    } catch (err: any) {
      console.error('Batch cohort assign failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchApplications();
  };

  const clearFilters = () => {
    setStatusFilter('');
    setTrackFilter('');
    setSearchQuery('');
    setApplicantTypeFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasFilters = statusFilter || trackFilter || searchQuery || applicantTypeFilter || startDate || endDate;

  // CSV Export
  const handleExportCSV = () => {
    const url = internshipService.getApplicationsExportUrl({
      status: statusFilter || undefined,
      track_id: trackFilter || undefined,
      search: searchQuery || undefined,
      applicant_type: applicantTypeFilter || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    });
    window.open(url, '_blank');
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewing', label: 'Reviewing' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interview_scheduled', label: 'Interview Scheduled' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const perPageOptions = [10, 20, 50, 100];

  // Stats cards data
  const statCards = stats ? [
    { label: 'Total', value: stats.total_applications, color: 'text-blue-400', bg: 'bg-blue-900/40' },
    { label: 'Pending', value: stats.by_status?.pending || 0, color: 'text-yellow-400', bg: 'bg-yellow-900/40' },
    { label: 'Reviewing', value: stats.by_status?.reviewing || 0, color: 'text-blue-400', bg: 'bg-blue-900/40' },
    { label: 'Shortlisted', value: stats.by_status?.shortlisted || 0, color: 'text-purple-400', bg: 'bg-purple-900/40' },
    { label: 'Interview', value: stats.by_status?.interview_scheduled || 0, color: 'text-indigo-400', bg: 'bg-indigo-900/40' },
    { label: 'Accepted', value: stats.by_status?.accepted || 0, color: 'text-green-400', bg: 'bg-green-900/40' },
    { label: 'Rejected', value: stats.by_status?.rejected || 0, color: 'text-red-400', bg: 'bg-red-900/40' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Internship Applications</h1>
          <p className="text-gray-400 mt-1">Review and manage all internship applications</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={pagination.total === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={fetchApplications}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#162844] border border-white/10 rounded-lg hover:bg-white/5 transition text-gray-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {statCards.map((card, i) => (
            <div key={i} className="bg-[#162844] rounded-xl border border-white/10 p-3 text-center hover:shadow-lg hover:shadow-blue-900/10 transition-all">
              <p className="text-lg font-bold text-white">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#162844] rounded-xl border border-white/10 p-4">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or ref code..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Track Filter */}
          <select
            value={trackFilter}
            onChange={e => { setTrackFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
          >
            <option value="">All Tracks</option>
            {tracks.map(track => (
              <option key={track.id} value={track.id}>{track.name}</option>
            ))}
          </select>

          {/* Applicant Type Filter */}
          <select
            value={applicantTypeFilter}
            onChange={e => { setApplicantTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
          >
            <option value="">All Types</option>
            <option value="graduate">Graduate</option>
            <option value="short_course_alumni">Short Course Alumni</option>
            <option value="external">External</option>
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-gray-500 ml-1" />
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="px-2 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm w-[140px]"
              title="Start date"
            />
            <span className="text-gray-500 text-xs">—</span>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="px-2 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm w-[140px]"
              title="End date"
            />
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm"
          >
            Search
          </button>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-400 hover:text-white transition text-sm"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {/* Results summary */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {pagination.total > 0 ? (
              <span>Showing {((page - 1) * pagination.per_page) + 1}-{Math.min(page * pagination.per_page, pagination.total)} of {pagination.total} applications</span>
            ) : (
              <span>No applications found</span>
            )}
          </p>
          {/* Per page selector */}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <List className="h-3.5 w-3.5" />
            <span>Per page:</span>
            <select
              value={perPage}
              onChange={e => { setPerPage(parseInt(e.target.value)); setPage(1); }}
              className="px-2 py-1 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-xs"
            >
              {perPageOptions.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-200 rounded-xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Batch Action Toolbar */}
      {selectedIds.size > 0 && !loading && (
        <div className="bg-[#162844] rounded-xl border border-blue-500/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-blue-300 font-medium flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4" />
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setBatchResult(null);
                setBatchStatus('');
                setBatchNote('');
                setShowBatchStatusModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs font-medium"
            >
              <Tag className="h-3.5 w-3.5" />
              Update Status
            </button>
            {allSelectedAccepted && (
              <button
                onClick={() => {
                  setOfferBatchResult(null);
                  setShowBatchOfferModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white rounded-lg transition text-xs font-medium shadow-lg shadow-teal-900/30"
              >
                <Award className="h-3.5 w-3.5" />
                Generate Offer Letter
              </button>
            )}
            {allSelectedAccepted && (
              <button
                onClick={openBatchCohortModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-xs font-medium"
              >
                <Users className="h-3.5 w-3.5" />
                Assign Cohort
              </button>
            )}
          </div>
        </div>
      )}

      {/* Applications Table */}
      {loading ? (
        <div className="bg-[#162844] rounded-xl border border-white/10 p-12">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      ) : Array.isArray(applications) && applications.length > 0 ? (
        <div className="bg-[#162844] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#0a1628]/50">
                  <th className="w-10 py-3.5 px-3 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="text-gray-400 hover:text-white transition"
                      title={Array.isArray(applications) && selectedIds.size === applications.length ? 'Deselect all' : 'Select all'}
                    >
                      {selectedIds.size === (Array.isArray(applications) ? applications.length : 0) ? (
                        <CheckSquare className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-white transition">
                      Applicant <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Contact</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Ref Code</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Track</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-white transition">
                      Status <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Cohort</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 hover:text-white transition ml-auto">
                      Date <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr
                    key={app.id}
                    className={`border-b border-white/5 transition ${
                      selectedIds.has(app.id) ? 'bg-blue-900/15 hover:bg-blue-900/25' : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="py-3.5 px-3 text-center">
                      <button
                        onClick={() => toggleSelect(app.id)}
                        className="text-gray-400 hover:text-white transition"
                      >
                        {selectedIds.has(app.id) ? (
                          <CheckSquare className="h-4 w-4 text-blue-400" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-white font-medium">{app.full_name}</p>
                      <p className="text-gray-500 text-xs">{app.applicant_type.replace('_', ' ')}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-gray-300 text-xs">{app.email}</p>
                      <p className="text-gray-500 text-xs">{app.phone}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded">
                        {app.reference_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">{app.track_name}</td>
                    <td className="py-3.5 px-4"><StatusBadge status={app.status} /></td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs">{app.cohort_code || '—'}</td>
                    <td className="py-3.5 px-4 text-right text-gray-400 text-xs">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Link
                        href={`/admin/internships/applications/${app.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/40 transition text-xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-[#0a1628]/50">
              <p className="text-sm text-gray-400">
                Page {pagination.page} of {pagination.pages}
              </p>
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
                        pageNum === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#0a1628] border border-white/10 text-gray-400 hover:bg-white/5'
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
          <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Applications Found</h3>
          <p className="text-gray-400 mb-6">
            {hasFilters ? 'Try adjusting your filters to find applications' : 'No internship applications have been submitted yet'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium">
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* ═══════════ Batch Status Update Modal ═══════════ */}
      {showBatchStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowBatchStatusModal(false); setBatchResult(null); }} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Tag className="h-5 w-5 text-blue-400" />
                Batch Update Status
              </h2>
              <button onClick={() => { setShowBatchStatusModal(false); setBatchResult(null); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {batchResult ? (
              <div className="p-6 space-y-4">
                <h3 className="text-white font-medium">Results</h3>
                {batchResult.updated.length > 0 && (
                  <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-4">
                    <p className="text-green-300 font-medium text-sm flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" />
                      {batchResult.updated.length} application(s) updated successfully
                    </p>
                    <ul className="mt-2 space-y-1">
                      {batchResult.updated.map(u => (
                        <li key={u.id} className="text-green-400/70 text-xs">{u.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {batchResult.skipped.length > 0 && (
                  <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
                    <p className="text-amber-300 font-medium text-sm">{batchResult.skipped.length} application(s) skipped</p>
                    <ul className="mt-2 space-y-1">
                      {batchResult.skipped.map(s => (
                        <li key={s.id} className="text-amber-400/70 text-xs">{s.name}: {s.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {batchResult.errors.length > 0 && (
                  <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-4">
                    <p className="text-red-300 font-medium text-sm">{batchResult.errors.length} error(s)</p>
                    <ul className="mt-2 space-y-1">
                      {batchResult.errors.map(e => (
                        <li key={e.id} className="text-red-400/70 text-xs">{e.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowBatchStatusModal(false);
                      setBatchResult(null);
                      setSelectedIds(new Set());
                      fetchApplications();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3">
                  <p className="text-blue-300 text-sm">
                    Updating status for <strong>{selectedIds.size}</strong> selected application(s).
                    Only valid status transitions will be applied. Invalid transitions are skipped.
                  </p>
                </div>

                {/* Status Select */}
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">New Status *</label>
                  <select
                    value={batchStatus}
                    onChange={e => setBatchStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                  >
                    <option value="">Select status...</option>
                    {statusOptions.slice(1).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Note (optional)</label>
                  <textarea
                    value={batchNote}
                    onChange={e => setBatchNote(e.target.value)}
                    placeholder="Add a note for the status change..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm resize-none"
                  />
                </div>
              </div>
            )}

            {!batchResult && (
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                <button
                  onClick={() => { setShowBatchStatusModal(false); setBatchResult(null); }}
                  className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchStatus}
                  disabled={!batchStatus || processing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
                >
                  {processing ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Processing...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Update {selectedIds.size} Application(s)</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ Batch Cohort Assignment Modal ═══════════ */}
      {showBatchCohortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowBatchCohortModal(false); setBatchResult(null); }} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-green-400" />
                Batch Assign Cohort
              </h2>
              <button onClick={() => { setShowBatchCohortModal(false); setBatchResult(null); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {batchResult ? (
              <div className="p-6 space-y-4">
                <h3 className="text-white font-medium">Results</h3>
                {batchResult.updated.length > 0 && (
                  <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-4">
                    <p className="text-green-300 font-medium text-sm flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" />
                      {batchResult.updated.length} application(s) assigned to cohort
                    </p>
                    <ul className="mt-2 space-y-1">
                      {batchResult.updated.map(u => (
                        <li key={u.id} className="text-green-400/70 text-xs">{u.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {batchResult.skipped.length > 0 && (
                  <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
                    <p className="text-amber-300 font-medium text-sm">{batchResult.skipped.length} skipped</p>
                    <ul className="mt-2 space-y-1">
                      {batchResult.skipped.map(s => (
                        <li key={s.id} className="text-amber-400/70 text-xs">{s.name}: {s.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {batchResult.errors.length > 0 && (
                  <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-4">
                    <p className="text-red-300 font-medium text-sm">{batchResult.errors.length} error(s)</p>
                    <ul className="mt-2 space-y-1">
                      {batchResult.errors.map(e => (
                        <li key={e.id} className="text-red-400/70 text-xs">{e.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowBatchCohortModal(false);
                      setBatchResult(null);
                      setSelectedIds(new Set());
                      fetchApplications();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-3">
                  <p className="text-green-300 text-sm">
                    Assigning <strong>{selectedIds.size}</strong> accepted application(s) to a cohort.
                    Only accepted applications can be assigned to cohorts.
                  </p>
                </div>

                {/* Cohort Select */}
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Cohort *</label>
                  <select
                    value={batchCohortId}
                    onChange={e => setBatchCohortId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                  >
                    <option value="">Select a cohort...</option>
                    {cohorts.filter(c => !c.is_full).map(cohort => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.cohort_name} ({cohort.cohort_code}) — {cohort.spots_available ?? '∞'} spots
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {!batchResult && (
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                <button
                  onClick={() => { setShowBatchCohortModal(false); setBatchResult(null); }}
                  className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchCohortAssign}
                  disabled={!batchCohortId || processing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
                >
                  {processing ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Assigning...</>
                  ) : (
                    <><Users className="h-4 w-4" /> Assign {selectedIds.size} Application(s)</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ Batch Offer Letter Modal ═══════════ */}
      {showBatchOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowBatchOfferModal(false); setOfferBatchResult(null); }} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-400" />
                Generate Offer Letters
              </h2>
              <button onClick={() => { setShowBatchOfferModal(false); setOfferBatchResult(null); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {offerBatchResult ? (
              <div className="p-6 space-y-4">
                <h3 className="text-white font-medium">Results</h3>

                {/* Sent successfully */}
                {offerBatchResult.sent.length > 0 && (
                  <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-4">
                    <p className="text-green-300 font-medium text-sm flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" />
                      {offerBatchResult.sent.length} offer letter(s) generated & sent
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {offerBatchResult.sent.map(s => (
                        <li key={s.id} className="flex items-center justify-between text-xs">
                          <span className="text-green-400/70">{s.name}</span>
                          <span className="text-teal-400 font-mono">{s.offer_number}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-green-500/60 text-xs mt-2">
                      Emails with login credentials have been sent to each applicant.
                    </p>
                  </div>
                )}

                {/* Skipped */}
                {offerBatchResult.skipped.length > 0 && (
                  <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
                    <p className="text-amber-300 font-medium text-sm">{offerBatchResult.skipped.length} skipped</p>
                    <ul className="mt-2 space-y-1">
                      {offerBatchResult.skipped.map(s => (
                        <li key={s.id} className="text-amber-400/70 text-xs">{s.name}: {s.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Errors */}
                {offerBatchResult.errors.length > 0 && (
                  <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-4">
                    <p className="text-red-300 font-medium text-sm">{offerBatchResult.errors.length} error(s)</p>
                    <ul className="mt-2 space-y-1">
                      {offerBatchResult.errors.map(e => (
                        <li key={e.id} className="text-red-400/70 text-xs">{e.name ? `${e.name}: ` : ''}{e.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowBatchOfferModal(false);
                      setOfferBatchResult(null);
                      setSelectedIds(new Set());
                      fetchApplications();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="bg-gradient-to-r from-teal-900/20 to-blue-900/20 border border-teal-700/30 rounded-lg p-4">
                  <p className="text-teal-300 text-sm">
                    Generate offer letters for <strong>{selectedIds.size}</strong> selected applicant(s).
                    Each applicant will receive a tamper-proof PDF offer letter via email
                    with auto-generated login credentials to access the platform.
                  </p>
                </div>

                {/* Selected applicants list */}
                <div className="bg-[#0a1628] rounded-lg p-3 max-h-40 overflow-y-auto border border-white/5">
                  <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider font-semibold">Selected Applicants</p>
                  <ul className="space-y-1">
                    {selectedApps.map(app => (
                      <li key={app.id} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 text-teal-400 flex-shrink-0" />
                        <span className="text-gray-300">{app.full_name}</span>
                        <span className="text-gray-500">({app.reference_code})</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Warning if not all have cohorts */}
                {selectedApps.some(app => !app.cohort_id) && (
                  <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
                    <p className="text-amber-300 text-xs">
                      ⚠️ Some selected applicants don't have a cohort assigned.
                      Consider assigning cohorts before generating offers.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!offerBatchResult && (
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                <button
                  onClick={() => { setShowBatchOfferModal(false); setOfferBatchResult(null); }}
                  className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchOffer}
                  disabled={processing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm shadow-lg shadow-teal-900/30"
                >
                  {processing ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Generating...</>
                  ) : (
                    <><Award className="h-4 w-4" /> Generate {selectedIds.size} Offer Letter(s)</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InternshipApplicationsPage;
