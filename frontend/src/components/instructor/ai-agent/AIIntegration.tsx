"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles, Zap } from 'lucide-react';

import { AIDashboard } from './AIDashboard';

interface AIIntegrationProps {
  courseId?: number;
  moduleId?: number;
  lessonId?: number;
  context?: {
    type: 'course' | 'module' | 'lesson' | 'quiz';
    title?: string;
    description?: string;
  };
  onContentGenerated?: (type: string, data: any) => void;
  triggerText?: string;
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  showBadge?: boolean;
}

export const AIIntegration: React.FC<AIIntegrationProps> = ({
  courseId,
  moduleId,
  lessonId,
  context,
  onContentGenerated,
  triggerText = "Generate with AI",
  triggerVariant = "default",
  showBadge = true
}) => {
  const [open, setOpen] = useState(false);

  const handleContentGenerated = (type: string, data: any) => {
    setOpen(false);
    onContentGenerated?.(type, data);
  };

  const getContextualTitle = () => {
    if (context?.title) {
      return `AI Assistant - ${context.title}`;
    }
    
    if (lessonId) return "AI Lesson Assistant";
    if (moduleId) return "AI Module Assistant";
    if (courseId) return "AI Course Assistant";
    return "AI Content Generator";
  };

  const getContextualDescription = () => {
    if (context?.description) {
      return context.description;
    }
    
    if (lessonId) return "Generate lesson content, quizzes, and assignments using AI";
    if (moduleId) return "Generate module content and structure using AI";
    if (courseId) return "Generate course modules, lessons, and assessments using AI";
    return "Create comprehensive educational content with AI assistance";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={triggerVariant} 
          className="relative group"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            {triggerText}
            
            {showBadge && (
              <Badge 
                variant="secondary" 
                className="ml-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-700 border-purple-200"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                AI
              </Badge>
            )}
          </div>
          
          <div className="absolute inset-0 rounded-md bg-gradient-to-r from-purple-500/0 to-blue-500/0 group-hover:from-purple-500/5 group-hover:to-blue-500/5 transition-all duration-300" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            
            <div>
              <DialogTitle className="text-xl">{getContextualTitle()}</DialogTitle>
              <DialogDescription className="mt-1">
                {getContextualDescription()}
              </DialogDescription>
            </div>
            
            <div className="ml-auto">
              <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <Zap className="w-3 h-3 mr-1" />
                Powered by AI
              </Badge>
            </div>
          </div>
        </DialogHeader>
        
        <div className="mt-6">
          <AIDashboard
            courseId={courseId}
            moduleId={moduleId}
            onContentGenerated={handleContentGenerated}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIIntegration;