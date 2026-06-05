'use client';

import React, { useEffect, useState, useCallback } from 'react';
import internshipService, { type InternshipCohort, type InternshipTrack, type PaginatedResult } from '@/services/api/internship.service';
import { Plus, RefreshCw, Search, Calendar, Users, ChevronLeft, ChevronRight, X, Save, Clock, CheckCircle, XCircle, AlertTriangle, Trash2, Edit3 } from 'lucide-react';

const StatusBadge = ({ cohort }: { cohort: InternshipCohort }) => {
  const now = new Date();
  const startDate = new Date(cohort.start_date);
  const endDate = new Date(cohort.end_date);

  if (endDate < now) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-900/40 text-gray-400 border-gray-700/40">
        Ended
      </span>
    );
  }
  if (startDate > now) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-900/40 text-blue-300 border-blue-700/40">
        Upcoming
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-green-900/40 text-green-300 border-green-700/40">
      Active
    </span>
  );
};

const CohortsManagementPage = () => {
  const [cohorts, setCohorts] = useState<InternshipCohort[]>([]);
  const [tracks, setTracks] = useState<InternshipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [trackFilter, setTrackFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });

  // Create/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCohort, setEditingCohort] = useState<InternshipCohort | null>(null);
  const [formData, setFormData] = useState({
    track_id: '',
    cohort_name: '',
    cohort_code: '',
    start_date: '',
    end_date: '',
    capacity: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detail view
  const [selectedCohort, setSelectedCohort] = useState<InternshipCohort | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tracksResult, cohortsResult] = await Promise.all([
        internshipService.getTracks(),
        internshipService.getAdminCohorts({
          page,
          per_page: 20,
          track_id: trackFilter || undefined,
        }),
      ]);

      setTracks(Array.isArray(tracksResult) ? tracksResult : []);
      setCohorts(Array.isArray(cohortsResult.data) ? cohortsResult.data : []);
      setPagination({
        page: cohortsResult.page || 1,
        per_page: cohortsResult.per_page || 20,
        total: cohortsResult.total || 0,
        pages: cohortsResult.pages || 0,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  }, [page, trackFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setEditingCohort(null);
    setFormData({
      track_id: trackFilter || '',
      cohort_name: '',
      cohort_code: '',
      start_date: '',
      end_date: '',
      capacity: '',
      description: '',
    });
    setShowModal(true);
  };

  const openEditModal = (cohort: InternshipCohort) => {
    setEditingCohort(cohort);
    setFormData({
      track_id: cohort.track_id,
      cohort_name: cohort.cohort_name,
      cohort_code: cohort.cohort_code,
      start_date: cohort.start_date.slice(0, 16),
      end_date: cohort.end_date.slice(0, 16),
      capacity: cohort.capacity?.toString() || '',
      description: cohort.description || '',
    });
    setShowModal(true);
  };

  const generateCohortCode = (name: string) => {
    const prefix = name
      .split(' ')
      .map(w => w.charAt(0).toUpperCase())
      .join('')
      .slice(0, 3);
    const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
    return `${prefix}-${timestamp}`;
  };

  const handleSave = async () => {
    if (!formData.track_id || !formData.cohort_name || !formData.start_date || !formData.end_date) return;
    try {
      setSaving(true);
      if (editingCohort) {
        await internshipService.updateCohort(editingCohort.id, {
          cohort_name: formData.cohort_name,
          capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
          is_accepting: editingCohort.is_accepting,
          description: formData.description,
          end_date: new Date(formData.end_date).toISOString(),
        });
      } else {
        await internshipService.createCohort({
          track_id: formData.track_id,
          cohort_name: formData.cohort_name,
          cohort_code: formData.cohort_code || generateCohortCode(formData.cohort_name),
          start_date: new Date(formData.start_date).toISOString(),
          end_date: new Date(formData.end_date).toISOString(),
          capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
          description: formData.description || undefined,
        });
      }
      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to save cohort:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      await internshipService.deleteCohort(id);
      setDeleteConfirm(null);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to delete cohort:', err);
    } finally {
      setDeleting(false);
    }
  };

  const toggleAccepting = async (cohort: InternshipCohort) => {
    try {
      await internshipService.updateCohort(cohort.id, { is_accepting: !cohort.is_accepting });
      await fetchData();
    } catch (err: any) {
      console.error('Failed to toggle cohort:', err);
    }
  };

  const getTrackName = (trackId: string) => {
    return tracks.find(t => t.id === trackId)?.name || 'Unknown';
  };

  const getDaysRemaining = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const filteredCohorts = cohorts.filter(c =>
    !searchQuery ||
    c.cohort_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.cohort_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getTrackName(c.track_id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Internship Cohorts</h1>
          <p className="text-gray-400 mt-1">Manage internship cohorts, track capacity, and applications</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#162844] border border-white/10 rounded-lg hover:bg-white/5 transition text-gray-300 disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm"
          >
            <Plus className="h-4 w-4" />
            New Cohort
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#162844] rounded-xl border border-white/10 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search cohorts by name, code, or track..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
            />
          </div>
          <select
            value={trackFilter}
            onChange={e => { setTrackFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm min-w-[180px]"
          >
            <option value="">All Tracks</option>
            {tracks.map(track => (
              <option key={track.id} value={track.id}>{track.name}</option>
            ))}
          </select>
        </div>
        {pagination.total > 0 && (
          <div className="mt-3 text-sm text-gray-400">
            Showing {filteredCohorts.length} of {pagination.total} cohorts
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-200 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      )}

      {/* Cohorts Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#162844] rounded-xl border border-white/10 p-6 animate-pulse">
              <div className="space-y-3">
                <div className="h-5 bg-white/5 rounded w-2/3" />
                <div className="h-3 bg-white/5 rounded w-1/3" />
                <div className="h-3 bg-white/5 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCohorts.length > 0 ? (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#162844] rounded-xl border border-white/10 p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Total Cohorts</p>
              <p className="text-2xl font-bold text-white mt-1">{pagination.total}</p>
            </div>
            <div className="bg-[#162844] rounded-xl border border-white/10 p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Active Now</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {filteredCohorts.filter(c => {
                  const now = new Date();
                  return new Date(c.start_date) <= now && new Date(c.end_date) >= now;
                }).length}
              </p>
            </div>
            <div className="bg-[#162844] rounded-xl border border-white/10 p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Accepting Apps</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">
                {filteredCohorts.filter(c => c.is_accepting).length}
              </p>
            </div>
            <div className="bg-[#162844] rounded-xl border border-white/10 p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Full Capacity</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {filteredCohorts.filter(c => c.is_full).length}
              </p>
            </div>
          </div>

          {/* Cohorts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCohorts.map((cohort) => {
              const daysRemaining = getDaysRemaining(cohort.end_date);
              const capacityPercent = cohort.capacity
                ? Math.round((cohort.accepted_count / cohort.capacity) * 100)
                : 0;

              return (
                <div
                  key={cohort.id}
                  className="group bg-[#162844] rounded-xl border border-white/10 hover:border-blue-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-blue-900/10 overflow-hidden"
                >
                  {/* Top color bar */}
                  <div className={`h-1.5 w-full ${
                    cohort.is_full ? 'bg-red-500' :
                    cohort.is_accepting ? 'bg-green-500' : 'bg-gray-500'
                  }`} />

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold text-base truncate">{cohort.cohort_name}</h3>
                          <StatusBadge cohort={cohort} />
                        </div>
                        <p className="text-gray-500 text-xs font-mono mt-0.5">{cohort.cohort_code}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button
                          onClick={() => openEditModal(cohort)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                          title="Edit cohort"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleAccepting(cohort)}
                          className={`p-1.5 rounded-lg transition ${
                            cohort.is_accepting
                              ? 'text-green-400 hover:bg-green-900/30'
                              : 'text-gray-500 hover:bg-white/5'
                          }`}
                          title={cohort.is_accepting ? 'Stop accepting applications' : 'Start accepting applications'}
                        >
                          {cohort.is_accepting ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Track name */}
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-3">
                      <span className="text-blue-400">●</span>
                      <span>{getTrackName(cohort.track_id)}</span>
                    </div>

                    {/* Dates */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(cohort.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>→</span>
                        <span>{new Date(cohort.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      {daysRemaining > 0 && daysRemaining <= 30 && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400">
                          <Clock className="h-3 w-3" />
                          <span>{daysRemaining}d remaining</span>
                        </div>
                      )}
                    </div>

                    {/* Capacity bar */}
                    {cohort.capacity && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-400">
                            <Users className="h-3 w-3 inline mr-1" />
                            {cohort.accepted_count} / {cohort.capacity} accepted
                          </span>
                          <span className={capacityPercent >= 90 ? 'text-red-400' : capacityPercent >= 75 ? 'text-amber-400' : 'text-green-400'}>
                            {capacityPercent}%
                          </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              capacityPercent >= 90 ? 'bg-red-500' :
                              capacityPercent >= 75 ? 'bg-amber-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {cohort.description && (
                      <p className="text-gray-500 text-xs line-clamp-1 mb-3">{cohort.description}</p>
                    )}

                    {/* Footer actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        {cohort.is_accepting ? (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Accepting applications
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                            Not accepting
                          </span>
                        )}
                        {cohort.spots_available !== null && cohort.spots_available !== undefined && (
                          <span>{cohort.spots_available} spots left</span>
                        )}
                      </div>
                      <button
                        onClick={() => setDeleteConfirm(cohort.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                        title="Delete cohort"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-[#162844] rounded-xl border border-white/10">
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
        </>
      ) : (
        <div className="bg-[#162844] rounded-xl border border-white/10 p-16 text-center">
          <Calendar className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {searchQuery || trackFilter ? 'No Cohorts Found' : 'No Cohorts Yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {searchQuery || trackFilter
              ? 'Try adjusting your filters to find cohorts'
              : 'Create your first internship cohort to start grouping applicants'}
          </p>
          {!searchQuery && !trackFilter && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
            >
              <Plus className="h-4 w-4" />
              Create Your First Cohort
            </button>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingCohort ? 'Edit Cohort' : 'Create New Cohort'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Track */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Track *</label>
                <select
                  value={formData.track_id}
                  onChange={e => setFormData(prev => ({ ...prev, track_id: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                  disabled={!!editingCohort}
                >
                  <option value="">Select a track...</option>
                  {tracks.filter(t => t.is_active).map(track => (
                    <option key={track.id} value={track.id}>{track.name}</option>
                  ))}
                </select>
              </div>

              {/* Cohort Name */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Cohort Name *</label>
                <input
                  type="text"
                  value={formData.cohort_name}
                  onChange={e => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      cohort_name: name,
                      cohort_code: editingCohort ? prev.cohort_code : generateCohortCode(name),
                    }));
                  }}
                  placeholder="e.g., Spring 2026 Mobile Dev"
                  className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
                />
              </div>

              {/* Cohort Code */}
              {!editingCohort && (
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Cohort Code *</label>
                  <input
                    type="text"
                    value={formData.cohort_code}
                    onChange={e => setFormData(prev => ({ ...prev, cohort_code: e.target.value }))}
                    placeholder="SPR-26-MOB"
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm font-mono"
                  />
                  <p className="text-gray-500 text-xs mt-1">Unique identifier. Auto-generated from cohort name.</p>
                </div>
              )}

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Start Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">End Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                  />
                </div>
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Capacity (optional)</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={e => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                  placeholder="e.g., 30"
                  min={1}
                  className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
                />
                <p className="text-gray-500 text-xs mt-1">Leave empty for unlimited capacity.</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this cohort's focus, schedule, or requirements..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.track_id || !formData.cohort_name || !formData.start_date || !formData.end_date || saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
              >
                {saving ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4" /> {editingCohort ? 'Update Cohort' : 'Create Cohort'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-red-900/40 border border-red-700/40 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Delete Cohort</h2>
              <p className="text-gray-400 text-sm mt-2">
                Are you sure you want to delete this cohort? This action cannot be undone.
                <br />
                <span className="text-red-400">Cohorts with accepted applications cannot be deleted.</span>
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition font-medium text-sm"
              >
                {deleting ? 'Deleting...' : 'Delete Cohort'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CohortsManagementPage;
