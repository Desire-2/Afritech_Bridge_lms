/**
 * Comment Bank Panel - Categorized feedback snippets for quick insertion
 */

import React, { useState, useEffect } from 'react';
import { Search, Tag, Star, TrendingUp, X } from 'lucide-react';
import GradingService from '@/services/grading.service';

interface CommentBankPanelProps {
  onSelectComment: (comment: string) => void;
  onClose: () => void;
}

interface FeedbackTemplate {
  id: number;
  category: string;
  title: string;
  content: string;
  usage_count: number;
  tags: string[];
}

export const CommentBankPanel: React.FC<CommentBankPanelProps> = ({
  onSelectComment,
  onClose
}) => {
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<FeedbackTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'positive', label: '👍 Positive', color: 'green' },
    { value: 'improvement', label: '📝 Improvement', color: 'yellow' },
    { value: 'technical', label: '🔧 Technical', color: 'blue' },
    { value: 'grammar', label: '✍️ Grammar', color: 'purple' },
    { value: 'format', label: '📋 Format', color: 'indigo' },
    { value: 'late', label: '⏰ Late', color: 'red' },
    { value: 'resubmission', label: '🔄 Resubmission', color: 'teal' }
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, selectedCategory, searchQuery]);

  const fetchTemplates = async () => {
    try {
      const data = await GradingService.getEnhancedFeedbackTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort by usage count
    filtered.sort((a, b) => b.usage_count - a.usage_count);

    setFilteredTemplates(filtered);
  };

  const handleSelectTemplate = async (template: FeedbackTemplate) => {
    try {
      // Track usage
      await GradingService.useFeedbackTemplate(template.id);
      
      // Apply template
      onSelectComment(template.content);
    } catch (error) {
      console.error('Failed to use template:', error);
      onSelectComment(template.content);
    }
  };

  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.color || 'slate';
  };

  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Star className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          <h4 className="text-base sm:text-lg font-semibold text-white">Comment Bank</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 sm:top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search comments, tags..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates List */}
      <div className="max-h-64 sm:max-h-96 overflow-y-auto">
        {filteredTemplates.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <p>No feedback templates found</p>
            <p className="text-sm mt-2">Try adjusting your search or category filter</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="w-full text-left p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium bg-${getCategoryColor(template.category)}-100 dark:bg-${getCategoryColor(template.category)}-900/30 text-${getCategoryColor(template.category)}-700 dark:text-${getCategoryColor(template.category)}-300`}>
                      {template.category}
                    </span>
                    <h5 className="font-medium text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                      {template.title}
                    </h5>
                  </div>
                  {template.usage_count > 0 && (
                    <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400">
                      <TrendingUp className="w-3 h-3" />
                      <span>{template.usage_count}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                  {template.content}
                </p>
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-center">
        <button
          className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
          onClick={() => {
            // TODO: Open template management
            console.log('Manage templates');
          }}
        >
          + Create New Template
        </button>
      </div>
    </div>
  );
};
