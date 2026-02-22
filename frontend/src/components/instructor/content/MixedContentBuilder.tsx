'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  Plus, GripVertical, Trash2, Type, Video, FileText, 
  Image as ImageIcon, Heading1, Eye, Code, Check, X,
  BookOpen, PlayCircle, FileCheck, Sparkles, Wand2, Loader2,
  LayoutGrid, ChevronDown, Grip, ArrowUpDown, PanelTop
} from 'lucide-react';

// Type-specific accent colors
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string; badge: string }> = {
  heading: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-l-amber-400', text: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  text: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-l-blue-400', text: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-500', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  video: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-l-red-400', text: 'text-red-700 dark:text-red-300', icon: 'text-red-500', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  pdf: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-l-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', icon: 'text-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  image: { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-l-violet-400', text: 'text-violet-700 dark:text-violet-300', icon: 'text-violet-500', badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
};
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import aiAgentService from '@/services/ai-agent.service';

// Content Section Types
export interface ContentSection {
  id: string;
  type: 'text' | 'video' | 'pdf' | 'image' | 'heading';
  content: string;
  metadata?: {
    title?: string;
    caption?: string;
    url?: string;
  };
}

// Pre-built Templates
const CONTENT_TEMPLATES = [
  {
    id: 'intro-video-summary',
    name: '📚 Introduction + Video + Summary',
    description: 'Perfect for lecture-style lessons',
    sections: [
      { type: 'heading', content: 'Introduction', title: 'Introduction' },
      { type: 'text', content: 'Welcome to this lesson. In this section, you will learn about...' },
      { type: 'video', content: '', title: 'Main Video Lecture' },
      { type: 'heading', content: 'Key Takeaways', title: 'Key Takeaways' },
      { type: 'text', content: '- Point 1\n- Point 2\n- Point 3' }
    ]
  },
  {
    id: 'multi-video-notes',
    name: '🎥 Multiple Videos with Notes',
    description: 'Great for step-by-step tutorials',
    sections: [
      { type: 'heading', content: 'Part 1: Getting Started', title: 'Part 1' },
      { type: 'video', content: '', title: 'Video 1' },
      { type: 'text', content: 'Notes about this section...' },
      { type: 'heading', content: 'Part 2: Advanced Concepts', title: 'Part 2' },
      { type: 'video', content: '', title: 'Video 2' },
      { type: 'text', content: 'Additional notes...' }
    ]
  },
  {
    id: 'reading-exercises',
    name: '📖 Reading + PDF + Exercises',
    description: 'Ideal for document-based learning',
    sections: [
      { type: 'text', content: '## Overview\n\nRead through the attached document and complete the exercises below.' },
      { type: 'pdf', content: '', title: 'Study Material' },
      { type: 'heading', content: 'Practice Exercises', title: 'Exercises' },
      { type: 'text', content: '1. Question 1\n2. Question 2\n3. Question 3' }
    ]
  },
  {
    id: 'visual-guide',
    name: '🖼️ Visual Guide with Images',
    description: 'Best for visual demonstrations',
    sections: [
      { type: 'heading', content: 'Step-by-Step Guide', title: 'Guide' },
      { type: 'text', content: 'Follow these steps carefully...' },
      { type: 'image', content: '', title: 'Step 1 Screenshot' },
      { type: 'text', content: 'Explanation of step 1...' },
      { type: 'image', content: '', title: 'Step 2 Screenshot' }
    ]
  },
  {
    id: 'blank',
    name: '📝 Start from Scratch',
    description: 'Empty canvas for custom structure',
    sections: []
  }
];

interface MixedContentBuilderProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  courseTitle?: string;
  moduleTitle?: string;
  lessonTitle?: string;
  courseId?: number;
  moduleId?: number;
}

export default function MixedContentBuilder({
  value,
  onChange,
  courseTitle,
  moduleTitle,
  lessonTitle,
  courseId,
  moduleId
}: MixedContentBuilderProps) {
  const [sections, setSections] = useState<ContentSection[]>(() => {
    try {
      if (!value) return [];
      
      // Try to parse existing JSON
      const parsed = JSON.parse(value);
      
      // Convert old format to new format
      if (Array.isArray(parsed)) {
        return parsed.map((section: any, index: number) => {
          const mediaTypes = ['video', 'pdf', 'image'];
          const isMediaType = mediaTypes.includes(section.type);
          
          return {
            id: section.id || `section-${Date.now()}-${index}`,
            type: section.type || 'text',
            // For media types, prioritize url field; for text/heading, use content
            content: isMediaType 
              ? (section.url || section.metadata?.url || section.content || section.video_url || section.pdf_url || '')
              : (section.content || section.text || ''),
            metadata: {
              title: section.metadata?.title || section.title || section.heading || '',
              caption: section.metadata?.caption || section.caption || '',
              url: section.url || section.metadata?.url || section.video_url || section.pdf_url || ''
            }
          };
        });
      }
      
      return [];
    } catch {
      return [];
    }
  });

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(sections.length === 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [enhancingSection, setEnhancingSection] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Update sections when value prop changes (e.g., from AI generation)
  useEffect(() => {
    if (!value) return;
    
    try {
      const parsed = JSON.parse(value);
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        const newSections = parsed.map((section: any, index: number) => {
          const mediaTypes = ['video', 'pdf', 'image'];
          const isMediaType = mediaTypes.includes(section.type);
          
          return {
            id: section.id || `section-${Date.now()}-${index}`,
            type: section.type || 'text',
            // For media types, prioritize url field; for text/heading, use content
            content: isMediaType
              ? (section.url || section.metadata?.url || section.content || section.video_url || section.pdf_url || '')
              : (section.content || section.text || ''),
            metadata: {
              title: section.metadata?.title || section.title || section.heading || '',
              caption: section.metadata?.caption || section.caption || '',
              url: section.url || section.metadata?.url || section.video_url || section.pdf_url || ''
            }
          };
        });
        
        setSections(newSections);
        setShowTemplates(false); // Close template dialog if open
      }
    } catch (error) {
      console.error('Error parsing value in MixedContentBuilder:', error);
    }
  }, [value]);

  // Update parent when sections change
  const updateParent = (newSections: ContentSection[]) => {
    // Convert to format expected by backend
    const formattedSections = newSections.map(section => {
      switch (section.type) {
        case 'heading':
          return {
            type: 'heading',
            content: section.content,
            title: section.metadata?.title || section.content
          };
        case 'text':
          return {
            type: 'text',
            content: section.content
          };
        case 'video':
          return {
            type: 'video',
            url: section.metadata?.url || section.content,
            title: section.metadata?.title || '',
            description: section.metadata?.caption || ''
          };
        case 'pdf':
          return {
            type: 'pdf',
            url: section.metadata?.url || section.content,
            title: section.metadata?.title || '',
            description: section.metadata?.caption || ''
          };
        case 'image':
          return {
            type: 'image',
            url: section.metadata?.url || section.content,
            caption: section.metadata?.caption || '',
            title: section.metadata?.title || ''
          };
        default:
          return section;
      }
    });

    onChange(JSON.stringify(formattedSections, null, 2));
  };

  // Add new section
  const addSection = (type: ContentSection['type']) => {
    const newSection: ContentSection = {
      id: `section-${Date.now()}`,
      type,
      content: '',
      metadata: {}
    };
    
    const newSections = [...sections, newSection];
    setSections(newSections);
    updateParent(newSections);
    setEditingSection(newSection.id);
  };

  // Remove section
  const removeSection = (id: string) => {
    const newSections = sections.filter(s => s.id !== id);
    setSections(newSections);
    updateParent(newSections);
  };

  // Update section
  const updateSection = (id: string, updates: Partial<ContentSection>) => {
    const newSections = sections.map(s => 
      s.id === id ? { ...s, ...updates } : s
    );
    setSections(newSections);
    updateParent(newSections);
  };

  // Handle drag end
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSections(items);
    updateParent(items);
  };

  // Apply template
  const applyTemplate = async (templateId: string) => {
    const template = CONTENT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);

    // Special handling for blank template - just close and let user add sections
    if (templateId === 'blank') {
      setShowTemplates(false);
      return;
    }

    // If AI is available, offer auto-fill option
    if (courseId && moduleId && lessonTitle) {
      const templateName = template.name.includes('📚') || template.name.includes('🎥') || 
                          template.name.includes('📖') || template.name.includes('🖼️') || 
                          template.name.includes('📝') 
        ? template.name.substring(3) // Remove emoji + space
        : template.name;

      const useAI = window.confirm(
        `${templateName}\n\n` +
        `Would you like to:\n\n` +
        `✨ OK = Auto-fill with AI-generated content\n` +
        `✏️ Cancel = Create empty template form to fill manually`
      );

      if (useAI) {
        // Generate AI content for this template
        setShowTemplates(false);
        await generateAIForTemplate(templateId);
        return;
      }
    }

    // Create empty template sections (manual filling)
    const newSections: ContentSection[] = template.sections.map((section: any, index: number) => ({
      id: `section-${Date.now()}-${index}`,
      type: section.type,
      content: section.content || '', // Start empty for manual filling
      metadata: {
        title: section.title || ''
      }
    }));

    // If there are existing sections, ask before replacing or append
    if (sections.length > 0) {
      const shouldAppend = window.confirm(
        'You have existing content. Would you like to:\n\n' +
        'OK = Add template sections to existing content\n' +
        'Cancel = Replace all content with template'
      );
      
      if (shouldAppend) {
        // Append template sections to existing content
        const combined = [...sections, ...newSections];
        setSections(combined);
        updateParent(combined);
      } else {
        // Replace existing content
        setSections(newSections);
        updateParent(newSections);
      }
    } else {
      // No existing content, just use template
      setSections(newSections);
      updateParent(newSections);
    }
    
    setShowTemplates(false);
  };

  // Generate AI content for a specific template
  const generateAIForTemplate = async (templateId: string) => {
    if (!courseId || !moduleId) {
      alert('Course and Module information required for AI generation');
      return;
    }

    if (!lessonTitle) {
      alert('Please provide a lesson title before generating AI content');
      return;
    }

    setGeneratingAI(true);
    try {
      const result = await aiAgentService.generateMixedContent({
        course_id: Number(courseId),
        module_id: Number(moduleId),
        lesson_title: lessonTitle,
        template_id: templateId
      });

      if (result.success && result.data?.sections) {
        const generatedSections: ContentSection[] = result.data.sections.map((section: any, index: number) => ({
          id: `section-${Date.now()}-${index}`,
          type: section.type,
          content: section.content,
          metadata: section.metadata || { title: section.title || '' }
        }));

        // If there are existing sections, ask before replacing
        if (sections.length > 0) {
          const shouldReplace = window.confirm(
            'You have existing content. Replace it with AI-generated content?'
          );
          if (shouldReplace) {
            setSections(generatedSections);
            updateParent(generatedSections);
          }
        } else {
          setSections(generatedSections);
          updateParent(generatedSections);
        }

        alert('✨ AI content generated successfully! You can now review and edit each section.');
      } else {
        throw new Error(result.error || result.message || 'Failed to generate content');
      }
    } catch (error: any) {
      console.error('AI generation error:', error);
      alert(`Failed to generate AI content: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setGeneratingAI(false);
    }
  };



  // Enhance individual section with AI (background stepwise)
  const [enhanceProgress, setEnhanceProgress] = useState<string>('');
  
  const enhanceSection = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    if (section.type === 'video' || section.type === 'pdf' || section.type === 'image') {
      alert('AI enhancement is currently available for text and heading sections only');
      return;
    }

    if (!section.content) {
      alert('Please add some content to this section before enhancing it');
      return;
    }

    setEnhancingSection(sectionId);
    setEnhanceProgress('Starting enhancement...');
    try {
      const sectionIndex = sections.findIndex(s => s.id === sectionId);
      const previousSection = sectionIndex > 0 ? sections[sectionIndex - 1].content : '';

      const response = await aiAgentService.enhanceSectionContent(
        {
          section_type: section.type,
          section_content: section.content,
          context: {
            lesson_title: lessonTitle || 'Lesson',
            course_title: courseTitle || '',
            module_title: moduleTitle || '',
            section_position: sectionIndex === 0 ? 'beginning' : 
                             sectionIndex === sections.length - 1 ? 'end' : 'middle',
            previous_section: previousSection
          },
          course_id: courseId,
        },
        (progress) => {
          // Update progress text from background task
          const stepLabel = progress.current_step_description || `Step ${progress.current_step} of ${progress.total_steps}`;
          setEnhanceProgress(stepLabel);
        }
      );

      if (response.success && response.data?.enhanced_content) {
        updateSection(sectionId, { content: response.data.enhanced_content });
        alert('✨ Section enhanced successfully!');
      } else {
        throw new Error(response.message || 'Failed to enhance section');
      }
    } catch (error: any) {
      console.error('Section enhancement error:', error);
      alert(`Failed to enhance section: ${error.message || 'Unknown error'}`);
    } finally {
      setEnhancingSection(null);
      setEnhanceProgress('');
    }
  };

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, sectionId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      // TODO: Implement actual image upload
      // For now, create a local URL
      const imageUrl = URL.createObjectURL(file);
      updateSection(sectionId, { content: imageUrl });
    } catch (error) {
      console.error('Image upload failed:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  // Render section editor
  const renderSectionEditor = (section: ContentSection) => {
    const isEditing = editingSection === section.id;

    switch (section.type) {
      case 'heading':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={section.content}
              onChange={(e) => updateSection(section.id, { content: e.target.value })}
              onFocus={() => setEditingSection(section.id)}
              onBlur={() => setEditingSection(null)}
              placeholder="Enter heading text..."
              className="w-full px-3 py-2 text-lg font-bold border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
          </div>
        );

      case 'text':
        return (
          <div className="space-y-2">
            {isEditing ? (
              <textarea
                value={section.content}
                onChange={(e) => updateSection(section.id, { content: e.target.value })}
                onBlur={() => setEditingSection(null)}
                placeholder="Enter text content (Markdown supported)..."
                rows={6}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white font-mono text-sm"
                autoFocus
              />
            ) : (
              <div
                onClick={() => setEditingSection(section.id)}
                className="w-full min-h-[100px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md cursor-text hover:border-blue-400 dark:hover:border-blue-500 transition-colors prose dark:prose-invert max-w-none"
              >
                {section.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {section.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-slate-400 italic">Click to add text content...</p>
                )}
              </div>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={section.metadata?.title || ''}
              onChange={(e) => updateSection(section.id, { 
                metadata: { ...section.metadata, title: e.target.value }
              })}
              placeholder="Video title (optional)"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
            <input
              type="text"
              value={section.content}
              onChange={(e) => updateSection(section.id, { content: e.target.value })}
              onFocus={() => setEditingSection(section.id)}
              onBlur={() => setEditingSection(null)}
              placeholder="Enter video URL (YouTube, Vimeo, etc.)..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
            {section.content && (
              <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded text-xs text-green-700 dark:text-green-300">
                ✓ Video URL added
              </div>
            )}
          </div>
        );

      case 'pdf':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={section.metadata?.title || ''}
              onChange={(e) => updateSection(section.id, { 
                metadata: { ...section.metadata, title: e.target.value }
              })}
              placeholder="PDF title (optional)"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
            <input
              type="text"
              value={section.content}
              onChange={(e) => updateSection(section.id, { content: e.target.value })}
              onFocus={() => setEditingSection(section.id)}
              onBlur={() => setEditingSection(null)}
              placeholder="Enter PDF URL (Google Drive link, direct URL, etc.)..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
            {section.content && (
              <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded text-xs text-green-700 dark:text-green-300">
                ✓ PDF URL added
              </div>
            )}
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded text-xs text-blue-700 dark:text-blue-300">
              💡 Tip: Use Google Drive links or direct PDF URLs
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={section.metadata?.caption || ''}
              onChange={(e) => updateSection(section.id, { 
                metadata: { ...section.metadata, caption: e.target.value }
              })}
              placeholder="Image caption (optional)"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={section.content}
                onChange={(e) => updateSection(section.id, { content: e.target.value })}
                onFocus={() => setEditingSection(section.id)}
                onBlur={() => setEditingSection(null)}
                placeholder="Enter image URL or upload..."
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                {uploadingImage ? '⏳' : '📁 Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, section.id)}
                className="hidden"
              />
            </div>
            {section.content && (
              <div className="mt-2 border border-slate-300 dark:border-slate-600 rounded-md overflow-hidden">
                <img 
                  src={section.content} 
                  alt={section.metadata?.caption || 'Preview'} 
                  className="w-full h-auto max-h-48 object-contain"
                />
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Get section icon
  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'heading': return <Heading1 className="w-4 h-4" />;
      case 'text': return <Type className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'pdf': return <FileText className="w-4 h-4" />;
      case 'image': return <ImageIcon className="w-4 h-4" />;
      default: return <Type className="w-4 h-4" />;
    }
  };

  // Get section label
  const getSectionLabel = (type: string) => {
    switch (type) {
      case 'heading': return 'Heading';
      case 'text': return 'Text Block';
      case 'video': return 'Video';
      case 'pdf': return 'PDF Document';
      case 'image': return 'Image';
      default: return type;
    }
  };

  if (showTemplates) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <LayoutGrid className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Choose a Template
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Start with a structured layout</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTemplates(false)}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {sections.length > 0 ? 'Cancel' : 'Skip'}
          </button>
        </div>

        {/* AI Feature Info */}
        {courseId && moduleId && lessonTitle && (
          <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200/60 dark:border-purple-700/60 rounded-xl">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                <Wand2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm text-purple-900 dark:text-purple-100">
                <strong>AI Auto-fill Available!</strong> Select a template to auto-fill with AI-generated content or create an empty form.
              </p>
            </div>
          </div>
        )}

        {/* Info message when editing existing content */}
        {sections.length > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-700/60 rounded-xl">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>{sections.length} existing section{sections.length !== 1 ? 's' : ''}</strong> &mdash; you can append or replace when selecting a template.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CONTENT_TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template.id)}
              className="group p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md hover:shadow-purple-500/5 transition-all text-left bg-white dark:bg-slate-800"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{template.name.split(' ')[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white mb-0.5 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                    {template.name.substring(2)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {template.description}
                  </div>
                  {template.sections.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {template.sections.map((s: any, i: number) => (
                        <span key={i} className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] ${TYPE_COLORS[s.type]?.badge || 'bg-slate-100 text-slate-500'}`}>
                          {s.type === 'heading' ? 'H' : s.type === 'text' ? 'T' : s.type === 'video' ? 'V' : s.type === 'pdf' ? 'P' : 'I'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <PanelTop className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Mixed Content Builder
            </h3>
          </div>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            {sections.length} section{sections.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            className="text-xs px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors flex items-center gap-1.5 border border-purple-200/60 dark:border-purple-700/60"
          >
            <LayoutGrid className="w-3 h-3" />
            Templates
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-600"
          >
            <Eye className="w-3 h-3" />
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* AI Info Banner */}
      {(!courseId || !moduleId || !lessonTitle) && sections.length === 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            💡 <strong>Tip:</strong> Fill in the lesson title above to enable AI content generation!
          </p>
        </div>
      )}

      {/* Preview Mode */}
      {showPreview ? (
        <div className="border-2 border-slate-300 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-800">
          <div className="prose dark:prose-invert max-w-none">
            {sections.length === 0 ? (
              <p className="text-center text-slate-400 italic py-8">No content sections yet</p>
            ) : (
              sections.map((section, index) => (
                <div key={section.id} className="mb-6 last:mb-0">
                  {section.type === 'heading' && (
                    <h2 className="text-2xl font-bold mb-2">{section.content}</h2>
                  )}
                  {section.type === 'text' && (
                    <div className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {section.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {section.type === 'video' && (
                    <div className="border border-slate-300 dark:border-slate-600 rounded p-4 bg-slate-50 dark:bg-slate-700">
                      {section.metadata?.title && (
                        <h3 className="font-semibold mb-2">{section.metadata.title}</h3>
                      )}
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <PlayCircle className="w-4 h-4" />
                        <span>Video: {section.content || 'No URL provided'}</span>
                      </div>
                    </div>
                  )}
                  {section.type === 'pdf' && (
                    <div className="border border-slate-300 dark:border-slate-600 rounded p-4 bg-slate-50 dark:bg-slate-700">
                      {section.metadata?.title && (
                        <h3 className="font-semibold mb-2">{section.metadata.title}</h3>
                      )}
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <FileCheck className="w-4 h-4" />
                        <span>PDF: {section.content || 'No URL provided'}</span>
                      </div>
                    </div>
                  )}
                  {section.type === 'image' && section.content && (
                    <figure className="my-4">
                      <img 
                        src={section.content} 
                        alt={section.metadata?.caption || 'Content image'} 
                        className="w-full h-auto rounded-lg border border-slate-300 dark:border-slate-600"
                      />
                      {section.metadata?.caption && (
                        <figcaption className="text-sm text-center text-slate-600 dark:text-slate-400 mt-2">
                          {section.metadata.caption}
                        </figcaption>
                      )}
                    </figure>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Add Section Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 px-1.5 mr-0.5">Add</span>
            <button
              type="button"
              onClick={() => addSection('heading')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-amber-200 dark:border-amber-800/40 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-300 transition-colors"
            >
              <Heading1 className="w-3 h-3" />
              Heading
            </button>
            <button
              type="button"
              onClick={() => addSection('text')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-800/40 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300 transition-colors"
            >
              <Type className="w-3 h-3" />
              Text
            </button>
            <button
              type="button"
              onClick={() => addSection('video')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-red-200 dark:border-red-800/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-300 transition-colors"
            >
              <Video className="w-3 h-3" />
              Video
            </button>
            <button
              type="button"
              onClick={() => addSection('pdf')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-800/40 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 transition-colors"
            >
              <FileText className="w-3 h-3" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => addSection('image')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-violet-200 dark:border-violet-800/40 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-700 dark:text-violet-300 transition-colors"
            >
              <ImageIcon className="w-3 h-3" />
              Image
            </button>
          </div>

          {/* Sections List */}
          {sections.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center bg-slate-50/50 dark:bg-slate-800/30">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                <PanelTop className="w-7 h-7 text-purple-500 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                No content sections yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Use the toolbar above to add sections, or start with a template.
              </p>
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all shadow-sm flex items-center gap-2 mx-auto"
              >
                <LayoutGrid className="w-4 h-4" />
                Browse Templates
              </button>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="content-sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                    {sections.map((section, index) => (
                      <Draggable key={section.id} draggableId={section.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 border-l-[3px] ${TYPE_COLORS[section.type]?.border || 'border-l-slate-300'} transition-shadow ${
                              snapshot.isDragging ? 'shadow-xl ring-2 ring-blue-400/50' : 'hover:shadow-sm'
                            }`}
                          >
                            {/* Section Header */}
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-700/50">
                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 rounded text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`${TYPE_COLORS[section.type]?.icon || 'text-slate-400'}`}>
                                  {getSectionIcon(section.type)}
                                </span>
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                                  {getSectionLabel(section.type)}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                  #{index + 1}
                                </span>
                              </div>
                              {/* AI Enhance Button for text/heading sections */}
                              {(section.type === 'text' || section.type === 'heading') && section.content && (
                                <button
                                  type="button"
                                  onClick={() => enhanceSection(section.id)}
                                  disabled={enhancingSection === section.id}
                                  className="text-[11px] px-2.5 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
                                  title="Enhance this section with AI"
                                >
                                  {enhancingSection === section.id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span className="hidden sm:inline max-w-[120px] truncate">{enhanceProgress || 'Enhancing...'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Wand2 className="w-3 h-3" />
                                      <span className="hidden sm:inline">Enhance</span>
                                    </>
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeSection(section.id)}
                                className="p-1 rounded-md text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Remove section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Section Content */}
                            <div className="p-3">
                              {renderSectionEditor(section)}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </>
      )}

      {/* JSON Preview (for debugging) */}
      {process.env.NODE_ENV === 'development' && sections.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            Show JSON output
          </summary>
          <pre className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-600 overflow-x-auto">
            {value || '[]'}
          </pre>
        </details>
      )}
    </div>
  );
}
