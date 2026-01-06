"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  Settings,
  Shield,
  Zap,
  TrendingUp,
  Database,
  Cpu,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  BarChart3
} from 'lucide-react';

import aiAgentService from '@/services/ai-agent.service';

interface AIAdminPanelProps {
  onConfigUpdate?: () => void;
}

export const AIAdminPanel: React.FC<AIAdminPanelProps> = ({ onConfigUpdate }) => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [config, setConfig] = useState({
    quality_threshold: 0.5,
    enable_caching: true,
    enable_fallback: true,
    max_retries: 3,
    timeout_seconds: 300,
    enable_progress_tracking: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [health, usage] = await Promise.all([
        aiAgentService.healthCheck(),
        fetchUsageStats()
      ]);
      
      setHealthStatus(health);
      setStats(usage);
    } catch (error) {
      console.error('Failed to load AI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageStats = async () => {
    // Mock data - replace with actual API call
    return {
      total_generations: 156,
      successful_generations: 142,
      failed_generations: 14,
      average_quality_score: 0.73,
      total_tokens_used: 85420,
      average_response_time: 12.3,
      top_providers: [
        { name: 'OpenRouter', usage: 68, success_rate: 0.92 },
        { name: 'Anthropic', usage: 32, success_rate: 0.95 }
      ],
      daily_usage: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        generations: Math.floor(Math.random() * 25) + 10
      }))
    };
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      // Mock API call - replace with actual endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      onConfigUpdate?.();
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      await aiAgentService.healthCheck();
      await loadData();
    } catch (error) {
      console.error('Connection test failed:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading AI administration panel...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100">
            <Brain className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Administration</h1>
            <p className="text-muted-foreground">Manage AI content generation system</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={testConnection}>
            <Activity className="w-4 h-4 mr-2" />
            Test Connection
          </Button>
          
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Settings className="w-4 h-4 mr-2" />
            )}
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {healthStatus?.status === 'healthy' ? (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-600" />
              )}
              <div>
                <p className="text-2xl font-bold">System</p>
                <p className={`text-sm ${healthStatus?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                  {healthStatus?.status || 'Unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.total_generations || 0}</p>
                <p className="text-sm text-muted-foreground">Total Generations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{Math.round((stats?.successful_generations / stats?.total_generations) * 100) || 0}%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.average_quality_score?.toFixed(2) || '0.00'}</p>
                <p className="text-sm text-muted-foreground">Avg Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="configuration" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quality Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Quality Control
                </CardTitle>
                <CardDescription>
                  Configure content quality thresholds and validation
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <Label>Quality Threshold: {config.quality_threshold}</Label>
                  <Slider
                    value={[config.quality_threshold]}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, quality_threshold: value[0] }))}
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Minimum quality score required for generated content
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Content Caching</Label>
                    <p className="text-sm text-muted-foreground">Cache successful generations for performance</p>
                  </div>
                  <Switch
                    checked={config.enable_caching}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enable_caching: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Progress Tracking</Label>
                    <p className="text-sm text-muted-foreground">Show real-time generation progress</p>
                  </div>
                  <Switch
                    checked={config.enable_progress_tracking}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enable_progress_tracking: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Performance Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5" />
                  Performance Settings
                </CardTitle>
                <CardDescription>
                  Configure timeouts, retries, and fallback behavior
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <Label>Timeout (seconds): {config.timeout_seconds}</Label>
                  <Slider
                    value={[config.timeout_seconds]}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, timeout_seconds: value[0] }))}
                    min={30}
                    max={600}
                    step={30}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Maximum time to wait for AI response
                  </p>
                </div>
                
                <div>
                  <Label>Max Retries: {config.max_retries}</Label>
                  <Slider
                    value={[config.max_retries]}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, max_retries: value[0] }))}
                    min={0}
                    max={5}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Number of retry attempts on failure
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Provider Fallback</Label>
                    <p className="text-sm text-muted-foreground">Use backup providers on failure</p>
                  </div>
                  <Switch
                    checked={config.enable_fallback}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enable_fallback: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {healthStatus?.message && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{healthStatus.message}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                AI Provider Status
              </CardTitle>
              <CardDescription>
                Monitor AI provider performance and configuration
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats?.top_providers?.map((provider: any, index: number) => (
                  <div key={provider.name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{provider.name}</h3>
                      <Badge variant={provider.success_rate > 0.9 ? 'default' : 'secondary'}>
                        {index === 0 ? 'Primary' : 'Backup'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Usage:</span>
                        <span>{provider.usage} requests</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Success Rate:</span>
                        <span className={provider.success_rate > 0.9 ? 'text-green-600' : 'text-yellow-600'}>
                          {Math.round(provider.success_rate * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Usage Analytics
              </CardTitle>
              <CardDescription>
                View AI generation statistics and trends
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Total Generations</p>
                  <p className="text-3xl font-bold text-blue-600">{stats?.total_generations || 0}</p>
                  <p className="text-sm text-muted-foreground">All time</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Average Response Time</p>
                  <p className="text-3xl font-bold text-green-600">{stats?.average_response_time || 0}s</p>
                  <p className="text-sm text-muted-foreground">Last 30 days</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Token Usage</p>
                  <p className="text-3xl font-bold text-purple-600">{(stats?.total_tokens_used || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total tokens</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                System Monitoring
              </CardTitle>
              <CardDescription>
                Real-time system health and performance metrics
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-3">Connection Status</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">API Connection:</span>
                      <Badge variant={healthStatus?.api_configured ? 'default' : 'destructive'}>
                        {healthStatus?.api_configured ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Database:</span>
                      <Badge variant="default">Connected</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Cache System:</span>
                      <Badge variant={config.enable_caching ? 'default' : 'secondary'}>
                        {config.enable_caching ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-3">Error Monitoring</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Failed Generations:</span>
                      <span className="text-red-600">{stats?.failed_generations || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Error Rate:</span>
                      <span className={`${(stats?.failed_generations / stats?.total_generations) < 0.1 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.round((stats?.failed_generations / stats?.total_generations) * 100) || 0}%
                      </span>
                    </div>
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

export default AIAdminPanel;