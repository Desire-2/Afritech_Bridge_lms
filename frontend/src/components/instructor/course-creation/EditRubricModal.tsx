"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
} from 'lucide-react';

interface PerformanceLevel {
  level: string;
  points: number;
  description: string;
}

interface Criterion {
  name: string;
  description: string;
  max_points: number;
  performance_levels: PerformanceLevel[];
}

interface EditRubricModalProps {
  isOpen: boolean;
  onClose: () => void;
  criteria: Criterion[];
  onSave: (criteria: Criterion[]) => void;
  title?: string;
}

const DEFAULT_PERFORMANCE_LEVELS = [
  { level: 'Excellent', points: 10, description: 'Exceeds expectations' },
  { level: 'Good', points: 8, description: 'Meets expectations' },
  { level: 'Satisfactory', points: 6, description: 'Meets minimum requirements' },
  { level: 'Needs Improvement', points: 2, description: 'Does not meet requirements' },
];

const LEVEL_COLORS = [
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', dot: 'bg-blue-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' },
  { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', dot: 'bg-red-500' },
];

const EditRubricModal: React.FC<EditRubricModalProps> = ({
  isOpen,
  onClose,
  criteria: initialCriteria,
  onSave,
  title,
}) => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialCriteria?.length > 0) {
      // Deep clone to avoid mutating original
      const cloned = initialCriteria.map(c => ({
        name: c.name || '',
        description: c.description || '',
        max_points: c.max_points || 10,
        performance_levels: (c.performance_levels?.length > 0
          ? c.performance_levels
          : DEFAULT_PERFORMANCE_LEVELS.map(pl => ({
              ...pl,
              points: pl.points === 10 ? (c.max_points || 10) : Math.round((c.max_points || 10) * (pl.points / 10)),
            }))
        ).map(pl => ({
          level: pl.level || '',
          points: pl.points || 0,
          description: pl.description || '',
        })),
      }));
      setCriteria(cloned);
      // Auto-expand all
      const expanded: Record<number, boolean> = {};
      cloned.forEach((_, i) => { expanded[i] = true; });
      setExpandedMap(expanded);
      setError(null);
    }
  }, [isOpen, initialCriteria]);

  const toggleExpand = (idx: number) => {
    setExpandedMap(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const addCriterion = () => {
    setCriteria(prev => [
      ...prev,
      {
        name: '',
        description: '',
        max_points: 10,
        performance_levels: DEFAULT_PERFORMANCE_LEVELS.map(pl => ({
          level: pl.level,
          points: pl.points,
          description: pl.description,
        })),
      },
    ]);
    setExpandedMap(prev => ({ ...prev, [criteria.length]: true }));
  };

  const removeCriterion = (idx: number) => {
    if (criteria.length <= 1) {
      setError('Rubric must have at least one criterion.');
      return;
    }
    setCriteria(prev => prev.filter((_, i) => i !== idx));
    setExpandedMap(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    setError(null);
  };

  const updateCriterion = (idx: number, field: keyof Criterion, value: any) => {
    setCriteria(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setError(null);
  };

  const updatePerformanceLevel = (cIdx: number, plIdx: number, field: keyof PerformanceLevel, value: any) => {
    setCriteria(prev => {
      const next = [...prev];
      const levels = [...next[cIdx].performance_levels];
      levels[plIdx] = { ...levels[plIdx], [field]: value };
      next[cIdx] = { ...next[cIdx], performance_levels: levels };
      return next;
    });
  };

  const addPerformanceLevel = (cIdx: number) => {
    setCriteria(prev => {
      const next = [...prev];
      const c = next[cIdx];
      const lastPoints = c.performance_levels[c.performance_levels.length - 1]?.points || 0;
      next[cIdx] = {
        ...c,
        performance_levels: [
          ...c.performance_levels,
          { level: '', points: Math.round(lastPoints * 0.5), description: '' },
        ],
      };
      return next;
    });
  };

  const removePerformanceLevel = (cIdx: number, plIdx: number) => {
    setCriteria(prev => {
      const next = [...prev];
      const levels = next[cIdx].performance_levels.filter((_, i) => i !== plIdx);
      next[cIdx] = { ...next[cIdx], performance_levels: levels };
      return next;
    });
  };

  const handleSave = () => {
    // Validate
    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      if (!c.name.trim()) {
        setError(`Criterion ${i + 1} needs a name.`);
        return;
      }
      if (!c.max_points || c.max_points <= 0) {
        setError(`Criterion ${i + 1} needs max points > 0.`);
        return;
      }
      for (let j = 0; j < c.performance_levels.length; j++) {
        const pl = c.performance_levels[j];
        if (!pl.level.trim()) {
          setError(`Criterion ${i + 1}, Level ${j + 1} needs a name.`);
          return;
        }
      }
    }

    // Deep clone before saving
    const toSave = criteria.map(c => ({
      name: c.name,
      description: c.description,
      max_points: c.max_points,
      performance_levels: c.performance_levels.map(pl => ({
        level: pl.level,
        points: pl.points,
        description: pl.description,
      })),
    }));
    onSave(toSave);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {title || 'Edit Grading Rubric'}
              </h2>
              <p className="text-sm text-gray-500">
                Modify criteria, point values, and performance levels
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/60 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Total Points Summary */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-800">
              📊 Total Points: <strong>{criteria.reduce((sum, c) => sum + (c.max_points || 0), 0)}</strong>
            </span>
            <span className="text-xs text-indigo-600">
              {criteria.length} criter{criteria.length === 1 ? 'ion' : 'ia'}
            </span>
          </div>

          {/* Criteria List */}
          {criteria.map((criterion, idx) => (
            <div key={idx} className="border-2 border-gray-200 rounded-xl overflow-hidden">
              {/* Criterion Header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={criterion.name}
                    onChange={(e) => updateCriterion(idx, 'name', e.target.value)}
                    placeholder="Criterion name"
                    className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-gray-500">Points:</span>
                    <input
                      type="number"
                      value={criterion.max_points}
                      onChange={(e) => updateCriterion(idx, 'max_points', Math.max(1, parseInt(e.target.value) || 0))}
                      min="1"
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-center"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                    title={expandedMap[idx] ? 'Collapse' : 'Expand'}
                  >
                    {expandedMap[idx] ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </button>
                  <button
                    onClick={() => removeCriterion(idx)}
                    className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                    title="Remove criterion"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Criterion Body */}
              {expandedMap[idx] && (
                <div className="p-4 space-y-4">
                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                    <textarea
                      value={criterion.description}
                      onChange={(e) => updateCriterion(idx, 'description', e.target.value)}
                      placeholder="What does this criterion measure?"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                    />
                  </div>

                  {/* Performance Levels */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-600">Performance Levels</label>
                      <button
                        onClick={() => addPerformanceLevel(idx)}
                        className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Level
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {criterion.performance_levels.map((level, plIdx) => {
                        const color = LEVEL_COLORS[plIdx % LEVEL_COLORS.length];
                        return (
                          <div key={plIdx} className={`flex items-start gap-2 p-3 rounded-lg border ${color.bg} ${color.border}`}>
                            <div className="flex-1 grid grid-cols-3 gap-2">
                              <div>
                                <input
                                  type="text"
                                  value={level.level}
                                  onChange={(e) => updatePerformanceLevel(idx, plIdx, 'level', e.target.value)}
                                  placeholder="Level name"
                                  className={`w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-semibold ${color.text}`}
                                />
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={level.points}
                                  onChange={(e) => updatePerformanceLevel(idx, plIdx, 'points', Math.max(0, parseInt(e.target.value) || 0))}
                                  min="0"
                                  placeholder="Points"
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-center"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={level.description}
                                  onChange={(e) => updatePerformanceLevel(idx, plIdx, 'description', e.target.value)}
                                  placeholder="Description"
                                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                                />
                                {criterion.performance_levels.length > 1 && (
                                  <button
                                    onClick={() => removePerformanceLevel(idx, plIdx)}
                                    className="p-1 hover:bg-red-100 rounded transition-colors shrink-0"
                                  >
                                    <X className="w-3 h-3 text-red-400" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add Criterion Button */}
          <button
            onClick={addCriterion}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Criterion
          </button>
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 rounded-b-xl flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors font-medium flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditRubricModal;
