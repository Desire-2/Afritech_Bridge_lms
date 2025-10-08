/**
 * Contextual Help Dialog Component
 * Provides context-aware help and guidance
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  BookOpen,
  Video,
  MessageSquare,
  Users,
  ExternalLink,
  Lightbulb,
  Clock,
  Target,
  CheckCircle,
  X,
  Send,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ContextualHelpProps {
  isOpen: boolean;
  onClose: () => void;
  context: {
    moduleId: number;
    moduleName: string;
    lessonId?: number;
    lessonName?: string;
    difficulty?: string;
  };
  strugglingAreas?: string[];
}

const ContextualHelpDialog: React.FC<ContextualHelpProps> = ({
  isOpen,
  onClose,
  context,
  strugglingAreas = [],
}) => {
  const [activeTab, setActiveTab] = useState('quick-tips');
  const [helpMessage, setHelpMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRequestHelp = async () => {
    if (!helpMessage.trim()) return;

    setSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSubmitting(false);
    setSubmitted(true);

    setTimeout(() => {
      setSubmitted(false);
      setHelpMessage('');
    }, 3000);
  };

  const quickTips = [
    {
      title: 'Review the Basics',
      description: 'Go back to earlier lessons if concepts feel unclear',
      icon: BookOpen,
      action: 'Review Previous Lessons',
    },
    {
      title: 'Watch Tutorial Videos',
      description: 'Visual explanations can help clarify complex topics',
      icon: Video,
      action: 'Watch Videos',
    },
    {
      title: 'Practice Problems',
      description: 'Hands-on practice reinforces learning',
      icon: Target,
      action: 'Start Practice',
    },
    {
      title: 'Take a Break',
      description: 'Sometimes stepping away helps things click',
      icon: Clock,
      action: 'Set Reminder',
    },
  ];

  const studyStrategies = [
    'Break down complex problems into smaller steps',
    'Create summaries or mind maps of key concepts',
    'Explain the topic to someone else (or yourself)',
    'Practice actively rather than passively reading',
    'Focus on understanding WHY, not just memorizing',
    'Review regularly to reinforce learning',
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            <span>Learning Help & Resources</span>
          </DialogTitle>
          <DialogDescription>
            Get help with <span className="font-semibold">{context.moduleName}</span>
            {context.lessonName && (
              <span> - {context.lessonName}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quick-tips">
              <Lightbulb className="h-4 w-4 mr-2" />
              Quick Tips
            </TabsTrigger>
            <TabsTrigger value="strategies">
              <Target className="h-4 w-4 mr-2" />
              Strategies
            </TabsTrigger>
            <TabsTrigger value="resources">
              <BookOpen className="h-4 w-4 mr-2" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="get-help">
              <MessageSquare className="h-4 w-4 mr-2" />
              Get Help
            </TabsTrigger>
          </TabsList>

          {/* Quick Tips Tab */}
          <TabsContent value="quick-tips" className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {strugglingAreas.length > 0 && (
                  <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>Areas Needing Attention</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {strugglingAreas.map((area, i) => (
                          <div key={i} className="flex items-center space-x-2 text-sm">
                            <Badge variant="outline">{area}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {quickTips.map((tip, index) => {
                  const Icon = tip.icon;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start space-x-4">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold mb-1">{tip.title}</h4>
                              <p className="text-sm text-muted-foreground mb-3">
                                {tip.description}
                              </p>
                              <Button variant="outline" size="sm">
                                {tip.action}
                                <ExternalLink className="h-3 w-3 ml-2" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Study Strategies Tab */}
          <TabsContent value="strategies" className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Proven Learning Strategies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {studyStrategies.map((strategy, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50"
                    >
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{strategy}</p>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Time Management Tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>• Study in 25-minute focused sessions (Pomodoro Technique)</p>
                  <p>• Schedule learning during your peak energy hours</p>
                  <p>• Set specific, achievable goals for each session</p>
                  <p>• Eliminate distractions during study time</p>
                  <p>• Review within 24 hours to improve retention</p>
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Additional Learning Materials</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      <Video className="h-4 w-4 mr-2" />
                      Video Tutorials
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Reading Materials
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Target className="h-4 w-4 mr-2" />
                      Practice Exercises
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Community Resources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      Study Groups
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Discussion Forums
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Get Help Tab */}
          <TabsContent value="get-help" className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Request Personalized Help</CardTitle>
                  <DialogDescription>
                    Describe what you're struggling with and we'll connect you with the right resources
                  </DialogDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={helpMessage}
                    onChange={(e) => setHelpMessage(e.target.value)}
                    placeholder="What are you having trouble with? Be as specific as possible..."
                    className="min-h-[150px]"
                    disabled={submitting || submitted}
                  />

                  <AnimatePresence mode="wait">
                    {submitted ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center space-x-2 text-green-600 p-4 bg-green-50 dark:bg-green-950 rounded-lg"
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Help request submitted! We'll get back to you soon.</span>
                      </motion.div>
                    ) : (
                      <Button
                        onClick={handleRequestHelp}
                        disabled={!helpMessage.trim() || submitting}
                        className="w-full"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Help Request
                          </>
                        )}
                      </Button>
                    )}
                  </AnimatePresence>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Instant Support Options:</h4>
                    <Button variant="outline" className="w-full justify-start">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chat with AI Assistant
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      Join Study Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContextualHelpDialog;
