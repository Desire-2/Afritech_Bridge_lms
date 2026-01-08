import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Eye, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Star,
  MessageSquare,
  Lightbulb,
  TrendingUp,
  BookOpen
} from 'lucide-react';

interface DocumentAnalysisProps {
  content?: string;
  wordCount?: number;
  expectedLength?: number;
  rubricCriteria?: Array<{
    name: string;
    description: string;
    maxPoints: number;
  }>;
}

const DocumentAnalysis: React.FC<DocumentAnalysisProps> = ({ 
  content = '', 
  wordCount,
  expectedLength,
  rubricCriteria = []
}) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (content) {
      analyzeContent();
    }
  }, [content]);

  const analyzeContent = () => {
    setLoading(true);
    
    // Perform content analysis
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Calculate readability metrics
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const avgSentencesPerParagraph = sentences.length / Math.max(paragraphs.length, 1);
    
    // Keyword analysis
    const wordFrequency: { [key: string]: number } = {};
    words.forEach(word => {
      const cleaned = word.toLowerCase().replace(/[^a-zA-Z]/g, '');
      if (cleaned.length > 3) {
        wordFrequency[cleaned] = (wordFrequency[cleaned] || 0) + 1;
      }
    });
    
    const topKeywords = Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    // Quality indicators
    const qualityScores = {
      length: calculateLengthScore(words.length, expectedLength),
      structure: calculateStructureScore(paragraphs.length, sentences.length),
      vocabulary: calculateVocabularyScore(wordFrequency),
      coherence: calculateCoherenceScore(avgWordsPerSentence, avgSentencesPerParagraph)
    };

    // Generate insights
    const insights = generateInsights(words.length, qualityScores, topKeywords);
    
    setAnalysis({
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      avgSentencesPerParagraph: Math.round(avgSentencesPerParagraph * 10) / 10,
      topKeywords,
      qualityScores,
      insights,
      readingTime: Math.ceil(words.length / 200) // ~200 words per minute
    });
    
    setLoading(false);
  };

  const calculateLengthScore = (wordCount: number, expected?: number) => {
    if (!expected) return 85; // Default good score if no expectation
    const ratio = wordCount / expected;
    if (ratio >= 0.8 && ratio <= 1.2) return 95;
    if (ratio >= 0.6 && ratio <= 1.5) return 80;
    if (ratio >= 0.4 && ratio <= 2.0) return 65;
    return 45;
  };

  const calculateStructureScore = (paragraphs: number, sentences: number) => {
    if (paragraphs === 0 || sentences === 0) return 30;
    const avgSentencesPerParagraph = sentences / paragraphs;
    if (avgSentencesPerParagraph >= 3 && avgSentencesPerParagraph <= 8) return 90;
    if (avgSentencesPerParagraph >= 2 && avgSentencesPerParagraph <= 10) return 75;
    return 60;
  };

  const calculateVocabularyScore = (frequency: { [key: string]: number }) => {
    const uniqueWords = Object.keys(frequency).length;
    const totalWords = Object.values(frequency).reduce((a, b) => a + b, 0);
    const diversity = uniqueWords / Math.max(totalWords, 1);
    return Math.min(95, Math.round(diversity * 200));
  };

  const calculateCoherenceScore = (avgWords: number, avgSentences: number) => {
    // Optimal range: 15-25 words per sentence
    let score = 85;
    if (avgWords < 10 || avgWords > 30) score -= 15;
    if (avgWords < 5 || avgWords > 40) score -= 15;
    
    // Paragraph structure
    if (avgSentences < 2) score -= 10;
    if (avgSentences > 12) score -= 10;
    
    return Math.max(40, score);
  };

  const generateInsights = (wordCount: number, scores: any, keywords: any[]) => {
    const insights = [];
    
    if (scores.length < 70) {
      if (wordCount < (expectedLength || 500) * 0.6) {
        insights.push({
          type: 'warning',
          icon: AlertCircle,
          title: 'Content Length',
          message: 'The submission appears to be shorter than expected. Consider if all requirements have been addressed.'
        });
      }
    }
    
    if (scores.structure < 70) {
      insights.push({
        type: 'info',
        icon: BookOpen,
        title: 'Document Structure',
        message: 'The document structure could be improved with better paragraph organization.'
      });
    }
    
    if (scores.vocabulary > 85) {
      insights.push({
        type: 'positive',
        icon: Star,
        title: 'Vocabulary Diversity',
        message: 'Excellent vocabulary diversity and word usage demonstrated.'
      });
    }
    
    if (keywords.length > 0) {
      insights.push({
        type: 'info',
        icon: TrendingUp,
        title: 'Key Topics',
        message: `Main focus areas include: ${keywords.slice(0, 3).map(k => k.word).join(', ')}.`
      });
    }
    
    return insights;
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 85) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 70) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  if (!content) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center text-slate-500">
          <FileText className="w-5 h-5 mr-2" />
          <span>No content to analyze</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Eye className="w-5 h-5 text-blue-500 mr-2" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Document Analysis</h3>
          </div>
          {loading && (
            <div className="flex items-center text-blue-600">
              <Clock className="w-4 h-4 mr-1 animate-spin" />
              <span className="text-sm">Analyzing...</span>
            </div>
          )}
        </div>
      </div>

      {analysis && (
        <div className="p-4 space-y-6">
          {/* Basic Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{analysis.wordCount}</p>
              <p className="text-sm text-slate-500">Words</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{analysis.paragraphCount}</p>
              <p className="text-sm text-slate-500">Paragraphs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{analysis.readingTime}m</p>
              <p className="text-sm text-slate-500">Read Time</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{analysis.avgWordsPerSentence}</p>
              <p className="text-sm text-slate-500">Avg/Sentence</p>
            </div>
          </div>

          {/* Quality Scores */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Quality Assessment</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(analysis.qualityScores).map(([key, score]: [string, any]) => (
                <div key={key} className={`p-3 rounded-lg ${getScoreBackground(score)}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                      {key}
                    </span>
                    <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                      {score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Keywords */}
          {analysis.topKeywords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Key Terms</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.topKeywords.slice(0, 8).map((keyword: any, index: number) => (
                  <span 
                    key={index}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-full text-sm font-medium"
                  >
                    {keyword.word} ({keyword.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {analysis.insights.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Insights & Suggestions</h4>
              <div className="space-y-3">
                {analysis.insights.map((insight: any, index: number) => {
                  const Icon = insight.icon;
                  const colorClasses = {
                    positive: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
                    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
                    info: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                  };
                  
                  return (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border ${colorClasses[insight.type as keyof typeof colorClasses]}`}
                    >
                      <div className="flex items-start">
                        <Icon className="w-4 h-4 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                            {insight.title}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {insight.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentAnalysis;