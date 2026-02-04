'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Clock, 
  Settings, 
  Lock, 
  Unlock, 
  CheckCircle, 
  AlertCircle,
  Info,
  Save,
  RefreshCw,
  Layers,
  CreditCard
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Course } from '@/types/api';

interface ModuleReleaseStatus {
  id: number;
  title: string;
  order: number;
  is_released: boolean;
  is_manually_released: boolean;
  is_auto_released: boolean;
  released_at: string | null;
  lesson_count: number;
}

interface ModuleReleaseData {
  course_id: number;
  start_date: string | null;
  module_release_count: number | null;
  module_release_interval: string | null;
  module_release_interval_days: number | null;
  total_modules: number;
  released_modules_count: number;
  modules: ModuleReleaseStatus[];
}

interface CourseSettingsProps {
  course: Course;
  onCourseUpdate?: (course: Course) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const CourseSettings: React.FC<CourseSettingsProps> = ({ course, onCourseUpdate }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [moduleReleaseData, setModuleReleaseData] = useState<ModuleReleaseData | null>(null);
  
  // Form state
  const [enableModuleRelease, setEnableModuleRelease] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [moduleReleaseCount, setModuleReleaseCount] = useState<number>(1);
  const [releaseInterval, setReleaseInterval] = useState<string>('manual');
  const [customIntervalDays, setCustomIntervalDays] = useState<number>(7);

  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [coursePrice, setCoursePrice] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [savingPayment, setSavingPayment] = useState(false);

  // Fetch module release status
  const fetchModuleReleaseStatus = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/courses/${course.id}/module-release-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch module release status');
      }
      
      const data: ModuleReleaseData = await response.json();
      setModuleReleaseData(data);
      
      // Initialize form state from data
      setEnableModuleRelease(data.module_release_count !== null);
      setStartDate(data.start_date ? data.start_date.split('T')[0] : '');
      setModuleReleaseCount(data.module_release_count || 1);
      setReleaseInterval(data.module_release_interval || 'manual');
      setCustomIntervalDays(data.module_release_interval_days || 7);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModuleReleaseStatus();
  }, [course.id, token]);

  useEffect(() => {
    setPaymentEnabled(course.enrollment_type === 'paid');
    setCoursePrice(course.price ?? 0);
    setCurrency(course.currency || 'USD');
  }, [course]);

  // Save module release settings
  const handleSaveSettings = async () => {
    if (!token) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const settings = {
        start_date: startDate || null,
        module_release_count: enableModuleRelease ? moduleReleaseCount : null,
        module_release_interval: enableModuleRelease && releaseInterval !== 'manual' ? releaseInterval : null,
        module_release_interval_days: enableModuleRelease && releaseInterval === 'custom' ? customIntervalDays : null
      };
      
      const response = await fetch(`${API_URL}/courses/${course.id}/module-release-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      
      const data: { message: string; course?: Course } = await response.json();
      setSuccess('Module release settings saved successfully');
      
      // Refresh the status
      await fetchModuleReleaseStatus();
      
      if (onCourseUpdate && data.course) {
        onCourseUpdate(data.course);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Release or unrelease a specific module
  const handleToggleModuleRelease = async (moduleId: number, currentlyReleased: boolean) => {
    if (!token) return;
    
    try {
      const endpoint = currentlyReleased ? 'unrelease' : 'release';
      const response = await fetch(`${API_URL}/modules/${moduleId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} module`);
      }
      
      // Refresh the status
      await fetchModuleReleaseStatus();
      setSuccess(`Module ${currentlyReleased ? 'unreleased' : 'released'} successfully`);
    } catch (err: any) {
      setError(err.message || 'Failed to update module');
    }
  };

  const handleSavePaymentSettings = async () => {
    if (!token) return;

    if (paymentEnabled && (!coursePrice || coursePrice <= 0)) {
      setError('Please set a valid course price');
      return;
    }

    setSavingPayment(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        enrollment_type: paymentEnabled ? 'paid' : 'free',
        price: paymentEnabled ? coursePrice : null,
        currency: currency || 'USD'
      };

      const response = await fetch(`${API_URL}/courses/${course.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.message || 'Failed to save payment settings');
      }

      const updatedCourse: Course = await response.json();
      setSuccess('Payment settings saved successfully');

      if (onCourseUpdate) {
        onCourseUpdate(updatedCourse);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save payment settings');
    } finally {
      setSavingPayment(false);
    }
  };

  const getIntervalLabel = (interval: string) => {
    switch (interval) {
      case 'weekly': return '1 week';
      case 'bi-weekly': return '2 weeks';
      case 'monthly': return '4 weeks';
      case 'custom': return `${customIntervalDays} days`;
      default: return 'Manual';
    }
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-2" />
          <span className="text-slate-600 dark:text-slate-400">Loading settings...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-400">Success</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
        </Alert>
      )}

      {/* Module Release Settings Card */}
      <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Layers className="h-5 w-5" />
            Module Release Settings
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Control when and how modules become available to students
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Module Release Control */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="enable-release" className="text-base font-medium text-slate-900 dark:text-white">
                Enable Controlled Module Release
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                When enabled, only a specified number of modules will be available to students initially
              </p>
            </div>
            <Switch
              id="enable-release"
              checked={enableModuleRelease}
              onCheckedChange={setEnableModuleRelease}
            />
          </div>

          {enableModuleRelease && (
            <>
              <Separator />
              
              {/* Course Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start-date" className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Calendar className="h-4 w-4" />
                  Course Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="max-w-xs bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Module release calculations begin from this date. If not set, the course creation date is used.
                </p>
              </div>

              {/* Initial Module Count */}
              <div className="space-y-2">
                <Label htmlFor="module-count" className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Layers className="h-4 w-4" />
                  Initial Modules to Release
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="module-count"
                    type="number"
                    min={1}
                    max={moduleReleaseData?.total_modules || 100}
                    value={moduleReleaseCount}
                    onChange={(e) => setModuleReleaseCount(parseInt(e.target.value) || 1)}
                    className="w-24 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    of {moduleReleaseData?.total_modules || 0} total modules
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The first N modules will be available when the course starts
                </p>
              </div>

              {/* Release Interval (Future Enhancement) */}
              <div className="space-y-2">
                <Label htmlFor="release-interval" className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Clock className="h-4 w-4" />
                  Release Schedule
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-slate-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>How additional modules are released over time</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Select value={releaseInterval} onValueChange={setReleaseInterval}>
                  <SelectTrigger className="max-w-xs bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                    <SelectValue placeholder="Select schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Release Only</SelectItem>
                    <SelectItem value="weekly">Weekly (1 module per week)</SelectItem>
                    <SelectItem value="bi-weekly">Bi-Weekly (1 module every 2 weeks)</SelectItem>
                    <SelectItem value="monthly">Monthly (1 module per month)</SelectItem>
                    <SelectItem value="custom">Custom Interval</SelectItem>
                  </SelectContent>
                </Select>
                
                {releaseInterval === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Label htmlFor="custom-days" className="text-sm text-slate-600 dark:text-slate-400">
                      Release 1 module every
                    </Label>
                    <Input
                      id="custom-days"
                      type="number"
                      min={1}
                      value={customIntervalDays}
                      onChange={(e) => setCustomIntervalDays(parseInt(e.target.value) || 7)}
                      className="w-20 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">days</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Summary */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Current Configuration</h4>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• {moduleReleaseCount} module(s) available on course start</li>
                  <li>• Additional modules: {releaseInterval === 'manual' ? 'Manual release by instructor' : `Released every ${getIntervalLabel(releaseInterval)}`}</li>
                  <li>• Start date: {startDate || 'Course creation date'}</li>
                </ul>
              </div>
            </>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSaveSettings} 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Module Release Status Card */}
      {moduleReleaseData && moduleReleaseData.modules.length > 0 && (
        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-slate-900 dark:text-white">
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Module Release Status
              </span>
              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-700">
                {moduleReleaseData.released_modules_count} of {moduleReleaseData.total_modules} released
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              View and manually control which modules are available to students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {moduleReleaseData.modules.map((module, index) => (
                <div 
                  key={module.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    module.is_released 
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                      : 'bg-slate-50 border-slate-200 dark:bg-slate-700/50 dark:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      module.is_released 
                        ? 'bg-green-100 dark:bg-green-900/40'
                        : 'bg-slate-200 dark:bg-slate-600'
                    }`}>
                      {module.is_released ? (
                        <Unlock className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Lock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        Module {index + 1}: {module.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{module.lesson_count} lessons</span>
                        {module.is_released && (
                          <>
                            <span>•</span>
                            {module.is_manually_released ? (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700">
                                Manually Released
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                                Auto Released
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={module.is_manually_released ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleToggleModuleRelease(module.id, module.is_manually_released)}
                          className={module.is_manually_released 
                            ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                            : "bg-green-600 hover:bg-green-700 text-white"
                          }
                        >
                          {module.is_manually_released ? (
                            <>
                              <Lock className="h-3 w-3 mr-1" />
                              Revoke
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3 w-3 mr-1" />
                              Release
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {module.is_manually_released 
                          ? "Revoke manual release (module will follow automatic schedule)"
                          : "Manually release this module to students now"
                        }
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course Payment Settings */}
      <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <CreditCard className="h-5 w-5" />
            Course Payment Settings
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Enable paid enrollment and set a course fee
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="enable-payment" className="text-base font-medium text-slate-900 dark:text-white">
                Enable Paid Course
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Turn on payments to require mobile money payment before enrollment
              </p>
            </div>
            <Switch
              id="enable-payment"
              checked={paymentEnabled}
              onCheckedChange={setPaymentEnabled}
            />
          </div>

          {paymentEnabled && (
            <>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course-price" className="text-slate-900 dark:text-white">
                    Course Price
                  </Label>
                  <Input
                    id="course-price"
                    type="number"
                    min={1}
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(parseFloat(e.target.value) || 0)}
                    className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Set the amount students will pay</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="course-currency" className="text-slate-900 dark:text-white">
                    Currency
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="course-currency" className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GHS">GHS</SelectItem>
                      <SelectItem value="UGX">UGX</SelectItem>
                      <SelectItem value="RWF">RWF</SelectItem>
                      <SelectItem value="XOF">XOF</SelectItem>
                      <SelectItem value="XAF">XAF</SelectItem>
                      <SelectItem value="KES">KES</SelectItem>
                      <SelectItem value="ZMW">ZMW</SelectItem>
                      <SelectItem value="NGN">NGN</SelectItem>
                      <SelectItem value="TZS">TZS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSavePaymentSettings}
              disabled={savingPayment}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingPayment ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Payment Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseSettings;
