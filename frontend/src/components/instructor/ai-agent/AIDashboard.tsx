"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Globe,
  Sparkles,
  FileText,
  BookOpen,
  HelpCircle
} from 'lucide-react';

import aiAgentService from '@/services/ai-agent.service';
import EnhancedAIContentGenerator from './EnhancedAIContentGenerator';

interface AIDashboardProps {
  courseId?: number;
  moduleId?: number;
  onContentGenerated?: (type: string, data: any) => void;
}

export const AIDashboard: React.FC<AIDashboardProps> = ({
  courseId,
  moduleId,
  onContentGenerated
}) => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeGenerator, setActiveGenerator] = useState<string | null>(null);
  const [recentGenerations, setRecentGenerations] = useState<any[]>([]);

  useEffect(() => {
    checkAIHealth();
  }, []);

  const checkAIHealth = async () => {
    try {
      const health = await aiAgentService.healthCheck();
      setHealthStatus(health);
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({
        status: 'error',
        api_configured: false,
        message: 'Unable to connect to AI service'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'error':
      default:
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
  };

  const contentTypes = [
    {
      id: 'course',
      title: 'Course Outline',
      description: 'Generate complete course structure with modules',
      icon: <BookOpen className="w-5 h-5" />,
      available: !courseId
    },
    {
      id: 'module',
      title: 'Module Content',
      description: 'Generate module content with lessons',
      icon: <FileText className="w-5 h-5" />,
      available: !!courseId
    },
    {
      id: 'lesson',
      title: 'Lesson Content',
      description: 'Generate detailed lesson with examples',
      icon: <Sparkles className="w-5 h-5" />,
      available: !!moduleId
    },
    {
      id: 'quiz',
      title: 'Quiz Questions',
      description: 'Generate quiz based on content',
      icon: <HelpCircle className="w-5 h-5" />,
      available: !!moduleId
    }
  ];

  const handleContentGenerated = (type: string, data: any) => {
    const generation = {
      id: Date.now(),
      type,
      timestamp: new Date().toISOString(),
      title: data.title || `Generated ${type}`,
      status: 'success'
    };
    
    setRecentGenerations(prev => [generation, ...prev.slice(0, 4)]);
    onContentGenerated?.(type, data);
    setActiveGenerator(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 animate-pulse" />
            <span>Checking AI service status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6" />
              <div>
                <CardTitle>AI Content Generator</CardTitle>
                <CardDescription>Intelligent content creation powered by AI</CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusIcon(healthStatus?.status)}
              <Badge 
                variant={healthStatus?.status === 'healthy' ? 'default' : 'destructive'}
                className="capitalize"
              >
                {healthStatus?.status || 'unknown'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">API Connection</p>
                <p className={`text-sm ${healthStatus?.api_configured ? 'text-green-600' : 'text-red-600'}`}>
                  {healthStatus?.api_configured ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
            
            {healthStatus?.provider_stats && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Cpu className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Active Provider</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {healthStatus.provider_stats.primary_provider || 'Auto-select'}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Performance</p>
                <p className="text-sm text-green-600">Optimal</p>
              </div>
            </div>
          </div>
          
          {healthStatus?.message && (
            <Alert className="mt-4">
              <AlertDescription>{healthStatus.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Generate Content</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          {!activeGenerator ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contentTypes.map((type) => (
                  <Card 
                    key={type.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      type.available ? 'opacity-100' : 'opacity-50'
                    }`}
                    onClick={() => type.available && setActiveGenerator(type.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        {type.icon}
                        <div>
                          <CardTitle className="text-lg">{type.title}</CardTitle>
                          <CardDescription>{type.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <Badge variant={type.available ? 'default' : 'secondary'}>
                          {type.available ? 'Available' : 'Requires Context'}
                        </Badge>
                        
                        <Button 
                          size="sm" 
                          disabled={!type.available}
                          onClick={(e) => {
                            e.stopPropagation();
                            type.available && setActiveGenerator(type.id);
                          }}
                        >
                          Generate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {!healthStatus?.api_configured && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    AI service is not fully configured. Some features may be limited.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Generate {activeGenerator.charAt(0).toUpperCase() + activeGenerator.slice(1)}
                </h3>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveGenerator(null)}
                >
                  Back to Options
                </Button>
              </div>
              
              <EnhancedAIContentGenerator
                type={activeGenerator as any}
                courseId={courseId}
                moduleId={moduleId}
                onGenerate={(data) => handleContentGenerated(activeGenerator, data)}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Generations
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              {recentGenerations.length > 0 ? (
                <div className="space-y-3">
                  {recentGenerations.map((gen) => (
                    <div key={gen.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{gen.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(gen.timestamp).toLocaleString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className="capitalize">{gen.type}</Badge>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No recent generations</p>
                  <p className="text-sm">Start generating content to see history here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Generation Settings</CardTitle>
              <CardDescription>
                Configure how the AI generates content for your courses
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertDescription>
                    Settings are automatically optimized for best results. Advanced settings coming soon.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Quality Threshold</p>
                    <p className="text-muted-foreground">50% (Balanced)</p>
                  </div>
                  
                  <div>
                    <p className="font-medium">Progress Tracking</p>
                    <p className="text-muted-foreground">Enabled</p>
                  </div>
                  
                  <div>
                    <p className="font-medium">Cache Strategy</p>
                    <p className="text-muted-foreground">Smart Caching</p>
                  </div>
                  
                  <div>
                    <p className="font-medium">Provider</p>
                    <p className="text-muted-foreground">Auto-select</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIDashboard;