/**
 * Rubric Grading Panel - Interactive rubric-based grading interface
 */

import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, X, Award, Plus } from 'lucide-react';
import GradingService from '@/services/grading.service';

interface RubricGradingPanelProps {
  submissionType: 'assignment' | 'project';
  maxPoints: number;
  onApply: (scores: any, total: number) => void;
  onClose: () => void;
  initialScores?: any;
}

interface Rubric {
  id: number;
  title: string;
  description: string;
  total_points: number;
  criteria: RubricCriterion[];
}

interface RubricCriterion {
  id: number;
  name: string;
  description: string;
  max_points: number;
  performance_levels: PerformanceLevel[];
}

interface PerformanceLevel {
  level: string;
  points: number;
  description: string;
}

export const RubricGradingPanel: React.FC<RubricGradingPanelProps> = ({
  submissionType,
  maxPoints,
  onApply,
  onClose,
  initialScores = {}
}) => {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [selectedRubric, setSelectedRubric] = useState<Rubric | null>(null);
  const [scores, setScores] = useState<Record<number, number>>(initialScores);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRubrics();
  }, []);

  const fetchRubrics = async () => {
    try {
      const data = await GradingService.getRubrics();
      setRubrics(data);
      
      // Auto-select first rubric that matches the max points
      const matching = data.find(r => r.total_points === maxPoints);
      if (matching) {
        setSelectedRubric(matching);
      } else if (data.length > 0) {
        setSelectedRubric(data[0]);
      }
    } catch (error) {
      console.error('Failed to load rubrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCriterionScore = (criterionId: number, points: number) => {
    setScores(prev => ({
      ...prev,
      [criterionId]: points
    }));
  };

  const getTotalScore = () => {
    return Object.values(scores).reduce((sum, val) => sum + val, 0);
  };

  const handleApply = () => {
    const total = getTotalScore();
    const rubricScores = selectedRubric?.criteria.map(criterion => ({
      criterion_id: criterion.id,
      criterion_name: criterion.name,
      max_points: criterion.max_points,
      score: scores[criterion.id] || 0
    }));

    onApply(rubricScores, total);
  };

  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (rubrics.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="text-center py-8">
          <Award className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No Rubrics Available
          </h4>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Create a rubric to use consistent grading criteria
          </p>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Plus className="w-4 h-4 inline mr-2" />
            Create Rubric
          </button>
        </div>
      </div>
    );
  }

  const totalScore = getTotalScore();
  const percentage = selectedRubric ? ((totalScore / selectedRubric.total_points) * 100).toFixed(1) : '0';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Star className="w-5 h-5 text-white" />
          <h4 className="text-lg font-semibold text-white">Rubric Grading</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Rubric Selection */}
      {rubrics.length > 1 && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select Rubric
          </label>
          <select
            value={selectedRubric?.id || ''}
            onChange={(e) => {
              const rubric = rubrics.find(r => r.id === parseInt(e.target.value));
              setSelectedRubric(rubric || null);
              setScores({});
            }}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
          >
            {rubrics.map(rubric => (
              <option key={rubric.id} value={rubric.id}>
                {rubric.title} ({rubric.total_points} points)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rubric Description */}
      {selectedRubric?.description && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-300">
            {selectedRubric.description}
          </p>
        </div>
      )}

      {/* Criteria List */}
      <div className="max-h-96 overflow-y-auto">
        {selectedRubric?.criteria.map((criterion, idx) => (
          <div
            key={criterion.id}
            className="p-4 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h5 className="font-medium text-slate-900 dark:text-white mb-1">
                  {idx + 1}. {criterion.name}
                </h5>
                {criterion.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {criterion.description}
                  </p>
                )}
              </div>
              <div className="ml-4 text-right">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {scores[criterion.id] || 0}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  / {criterion.max_points}
                </div>
              </div>
            </div>

            {/* Performance Levels */}
            {criterion.performance_levels && criterion.performance_levels.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {criterion.performance_levels.map((level, levelIdx) => (
                  <button
                    key={levelIdx}
                    onClick={() => handleCriterionScore(criterion.id, level.points)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      scores[criterion.id] === level.points
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {level.level}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {level.points} pts
                        </span>
                        {scores[criterion.id] === level.points && (
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                    </div>
                    {level.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {level.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  max={criterion.max_points}
                  step="0.5"
                  value={scores[criterion.id] || 0}
                  onChange={(e) => handleCriterionScore(criterion.id, parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  / {criterion.max_points}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer - Total Score */}
      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-t border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Total Score</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {totalScore} / {selectedRubric?.total_points || maxPoints}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600 dark:text-slate-400">Percentage</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {percentage}%
            </div>
          </div>
        </div>

        <button
          onClick={handleApply}
          className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-medium transition-all flex items-center justify-center space-x-2"
        >
          <CheckCircle className="w-5 h-5" />
          <span>Apply Rubric Scores</span>
        </button>
      </div>
    </div>
  );
};
