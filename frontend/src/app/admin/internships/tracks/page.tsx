'use client';

import React, { useEffect, useState, useCallback } from 'react';
import internshipService, { type InternshipTrack } from '@/services/api/internship.service';
import { Plus, RefreshCw, Search, Edit2, Eye, EyeOff, Users, Code, Database, Globe, Smartphone, Palette, Brain, Briefcase, X, Save, Trash2, AlertTriangle } from 'lucide-react';

const TRACK_ICONS: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  mobile: { icon: <Smartphone className="h-6 w-6" />, color: 'text-emerald-400', bg: 'bg-emerald-900/40' },
  web: { icon: <Globe className="h-6 w-6" />, color: 'text-blue-400', bg: 'bg-blue-900/40' },
  frontend: { icon: <Palette className="h-6 w-6" />, color: 'text-violet-400', bg: 'bg-violet-900/40' },
  backend: { icon: <Database className="h-6 w-6" />, color: 'text-amber-400', bg: 'bg-amber-900/40' },
  data: { icon: <Brain className="h-6 w-6" />, color: 'text-rose-400', bg: 'bg-rose-900/40' },
  devops: { icon: <Code className="h-6 w-6" />, color: 'text-cyan-400', bg: 'bg-cyan-900/40' },
  design: { icon: <Palette className="h-6 w-6" />, color: 'text-pink-400', bg: 'bg-pink-900/40' },
  default: { icon: <Briefcase className="h-6 w-6" />, color: 'text-gray-400', bg: 'bg-gray-900/40' },
};

const getTrackIcon = (iconKey: string | null) => {
  return TRACK_ICONS[iconKey || 'default'] || TRACK_ICONS.default;
};

const TracksManagementPage = () => {
  const [tracks, setTracks] = useState<InternshipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingTrack, setEditingTrack] = useState<InternshipTrack | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon_key: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTracks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await internshipService.getAdminTracks();
      setTracks(Array.isArray(result) ? result : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load tracks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const openCreateModal = () => {
    setEditingTrack(null);
    setFormData({ name: '', slug: '', description: '', icon_key: '' });
    setShowModal(true);
  };

  const openEditModal = (track: InternshipTrack) => {
    setEditingTrack(track);
    setFormData({
      name: track.name,
      slug: track.slug,
      description: track.description || '',
      icon_key: track.icon_key || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) return;
    try {
      setSaving(true);

      if (editingTrack) {
        await internshipService.updateTrack(editingTrack.id, {
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
          icon_key: formData.icon_key || undefined,
        });
      } else {
        await internshipService.createTrack({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
          icon_key: formData.icon_key || undefined,
        });
      }

      setShowModal(false);
      await fetchTracks();
    } catch (err: any) {
      console.error('Failed to save track:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      await internshipService.deleteTrack(id);
      setDeleteConfirm(null);
      await fetchTracks();
    } catch (err: any) {
      console.error('Failed to delete track:', err);
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (track: InternshipTrack) => {
    try {
      await internshipService.updateTrack(track.id, { is_active: !track.is_active });
      await fetchTracks();
    } catch (err: any) {
      console.error('Failed to toggle track:', err);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const filteredTracks = tracks.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Internship Tracks</h1>
          <p className="text-gray-400 mt-1">Create and manage internship program tracks</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={fetchTracks}
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
            New Track
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search tracks by name or description..."
          className="w-full max-w-md pl-10 pr-4 py-2.5 bg-[#162844] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-200 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      )}

      {/* Tracks Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#162844] rounded-xl border border-white/10 p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-white/5" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 bg-white/5 rounded w-full" />
                <div className="h-3 bg-white/5 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTracks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTracks.map((track) => {
            const iconInfo = getTrackIcon(track.icon_key);
            const openCohorts = (track as any).cohorts?.filter((c: any) => c.is_accepting)?.length || track.open_cohorts_count || 0;

            return (
              <div
                key={track.id}
                className={`group bg-[#162844] rounded-xl border transition-all duration-200 hover:shadow-lg hover:shadow-blue-900/10 ${
                  track.is_active ? 'border-white/10 hover:border-blue-500/30' : 'border-white/5 opacity-60 hover:opacity-80'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${iconInfo.bg} flex items-center justify-center flex-shrink-0 ${iconInfo.color}`}>
                        {iconInfo.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-lg truncate">{track.name}</h3>
                        <p className="text-gray-500 text-xs font-mono mt-0.5">/{track.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(track)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                        title="Edit track"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(track)}
                        className={`p-1.5 rounded-lg transition ${
                          track.is_active
                            ? 'text-green-400 hover:bg-green-900/30'
                            : 'text-gray-500 hover:bg-white/5'
                        }`}
                        title={track.is_active ? 'Deactivate track' : 'Activate track'}
                      >
                        {track.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(track.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition"
                        title="Delete track"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {track.description && (
                    <p className="text-gray-400 text-sm mt-3 line-clamp-2 leading-relaxed">{track.description}</p>
                  )}

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <Users className="h-3.5 w-3.5" />
                      <span>{openCohorts} open cohorts</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs ${
                      track.is_active ? 'text-green-400' : 'text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${track.is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
                      {track.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#162844] rounded-xl border border-white/10 p-16 text-center">
          <Briefcase className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {searchQuery ? 'No Tracks Found' : 'No Tracks Yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {searchQuery
              ? 'Try a different search term'
              : 'Create your first internship track to start receiving applications'}
          </p>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
            >
              <Plus className="h-4 w-4" />
              Create Your First Track
            </button>
          )}
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
              <h2 className="text-lg font-semibold text-white">Delete Track</h2>
              <p className="text-gray-400 text-sm mt-2">
                Are you sure you want to delete this internship track? This action cannot be undone.
                <br />
                <span className="text-red-400">Tracks with accepted applications cannot be deleted. Deactivate them instead.</span>
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
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
              >
                {deleting ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Deleting...</>
                ) : (
                  'Delete Track'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingTrack ? 'Edit Track' : 'Create New Track'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Track Name */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Track Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => {
                    setFormData(prev => ({
                      ...prev,
                      name: e.target.value,
                      slug: editingTrack ? prev.slug : generateSlug(e.target.value),
                    }));
                  }}
                  placeholder="e.g., Mobile Development"
                  className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Slug *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="mobile-development"
                  className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm font-mono"
                />
                <p className="text-gray-500 text-xs mt-1">URL-friendly identifier. Use lowercase letters, numbers, and hyphens.</p>
              </div>

              {/* Icon Key */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Icon</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(TRACK_ICONS).map(([key, iconInfo]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon_key: key === 'default' ? '' : key }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition ${
                        (formData.icon_key || (!formData.icon_key && key === 'default'))
                          ? 'border-blue-500/50 bg-blue-900/20'
                          : 'border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <span className={iconInfo.color}>{iconInfo.icon}</span>
                      <span className="text-[10px] text-gray-400 capitalize">{key}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this internship track, required skills, and what interns will learn..."
                  rows={4}
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
                disabled={!formData.name || !formData.slug || saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
              >
                {saving ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4" /> {editingTrack ? 'Update Track' : 'Create Track'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TracksManagementPage;
