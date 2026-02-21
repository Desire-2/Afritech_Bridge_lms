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
  CreditCard,
  Plus,
  Trash
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
  const [savingApplication, setSavingApplication] = useState(false);
  
  // Form state
  const [enableModuleRelease, setEnableModuleRelease] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [moduleReleaseCount, setModuleReleaseCount] = useState<number>(1);
  const [releaseInterval, setReleaseInterval] = useState<string>('manual');
  const [customIntervalDays, setCustomIntervalDays] = useState<number>(7);

  const [applicationStartDate, setApplicationStartDate] = useState<string>('');
  const [applicationEndDate, setApplicationEndDate] = useState<string>('');
  const [cohortStartDate, setCohortStartDate] = useState<string>('');
  const [cohortEndDate, setCohortEndDate] = useState<string>('');
  const [cohortLabel, setCohortLabel] = useState<string>('');
  const [applicationTimezone, setApplicationTimezone] = useState<string>('UTC');
  const [additionalCohorts, setAdditionalCohorts] = useState<Array<{
    id: string;
    label: string;
    opensAt: string;
    closesAt: string;
    startDate: string;
    endDate: string;
    status: 'open' | 'upcoming' | 'closed';
  }>>([]);

  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [coursePrice, setCoursePrice] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [savingPayment, setSavingPayment] = useState(false);

  // Enhanced payment settings
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial'>('full');
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<number>(0);
  const [partialPaymentPercentage, setPartialPaymentPercentage] = useState<number>(50);
  const [partialType, setPartialType] = useState<'amount' | 'percentage'>('percentage');
  const [paypalEnabled, setPaypalEnabled] = useState(true);
  const [mobileMoneyEnabled, setMobileMoneyEnabled] = useState(true);
  const [bankTransferEnabled, setBankTransferEnabled] = useState(false);
  const [bankTransferDetails, setBankTransferDetails] = useState<string>('');
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [kpayEnabled, setKpayEnabled] = useState(true);
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] = useState<number>(3);
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState<number>(30);
  const [requirePaymentBeforeApplication, setRequirePaymentBeforeApplication] = useState(false);
  const [paymentDeadlineDays, setPaymentDeadlineDays] = useState<number>(0);

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
    // Enhanced payment fields
    setPaymentMode(course.payment_mode || 'full');
    setPartialPaymentAmount(course.partial_payment_amount ?? 0);
    setPartialPaymentPercentage(course.partial_payment_percentage ?? 50);
    setPartialType(course.partial_payment_amount ? 'amount' : 'percentage');
    setPaypalEnabled(course.paypal_enabled !== false);
    setMobileMoneyEnabled(course.mobile_money_enabled !== false);
    setBankTransferEnabled(course.bank_transfer_enabled === true);
    setBankTransferDetails(course.bank_transfer_details || '');
    // Stripe and K-Pay are stored both via payment_methods array and dedicated boolean columns
    setStripeEnabled(Array.isArray(course.payment_methods) && course.payment_methods.includes('stripe'));
    // K-Pay: prefer kpay_enabled field; fall back to checking payment_methods or defaulting to true
    setKpayEnabled(course.kpay_enabled !== false);
    setInstallmentEnabled(course.installment_enabled === true);
    setInstallmentCount(course.installment_count ?? 3);
    setInstallmentIntervalDays(course.installment_interval_days ?? 30);
    setRequirePaymentBeforeApplication(course.require_payment_before_application === true);
    setPaymentDeadlineDays(course.payment_deadline_days ?? 0);
    setApplicationStartDate(course.application_start_date ? course.application_start_date.split('T')[0] : '');
    setApplicationEndDate(course.application_end_date ? course.application_end_date.split('T')[0] : '');
    setCohortStartDate(course.cohort_start_date ? course.cohort_start_date.split('T')[0] : '');
    setCohortEndDate(course.cohort_end_date ? course.cohort_end_date.split('T')[0] : '');
    setCohortLabel(course.cohort_label || '');
    setApplicationTimezone(course.application_timezone || 'UTC');

    // Hydrate multi-cohort data if available
    const windows = course.application_windows || [];
    if (windows.length > 0) {
      setAdditionalCohorts(
        windows.map((w, idx) => ({
          id: (w.id ?? `${course.id}-cohort-${idx}`).toString(),
          label: w.cohort_label || `Cohort ${idx + 1}`,
          opensAt: (w.opens_at || '').split('T')[0] || '',
          closesAt: (w.closes_at || '').split('T')[0] || '',
          startDate: (w.cohort_start || '').split('T')[0] || '',
          endDate: (w.cohort_end || '').split('T')[0] || '',
          status: (w.status || 'open') as 'open' | 'upcoming' | 'closed',
        }))
      );
    } else {
      setAdditionalCohorts([]);
    }
  }, [course]);

  const handleSaveApplicationWindow = async () => {
    if (!token) return;

    setSavingApplication(true);
    setError(null);
    setSuccess(null);

    try {
      // Combine primary window with any additional cohorts
      const application_windows = [
        {
          cohort_label: cohortLabel || 'Primary Cohort',
          opens_at: applicationStartDate || null,
          closes_at: applicationEndDate || null,
          cohort_start: cohortStartDate || null,
          cohort_end: cohortEndDate || null,
          status: 'open',
        },
        ...additionalCohorts.map(c => ({
          cohort_label: c.label || 'Cohort',
          opens_at: c.opensAt || null,
          closes_at: c.closesAt || null,
          cohort_start: c.startDate || null,
          cohort_end: c.endDate || null,
          status: c.status || 'open',
        })),
      ];

      const payload = {
        application_start_date: applicationStartDate || null,
        application_end_date: applicationEndDate || null,
        cohort_start_date: cohortStartDate || null,
        cohort_end_date: cohortEndDate || null,
        cohort_label: cohortLabel || null,
        application_timezone: applicationTimezone || 'UTC',
        application_windows,
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
        throw new Error((errorData as any)?.message || 'Failed to save application window');
      }

      const updatedCourse: Course = await response.json();
      setSuccess('Application window updated successfully');

      if (onCourseUpdate) {
        onCourseUpdate(updatedCourse);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save application window');
    } finally {
      setSavingApplication(false);
    }
  };

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

    if (paymentEnabled && !paypalEnabled && !mobileMoneyEnabled && !bankTransferEnabled && !stripeEnabled && !kpayEnabled) {
      setError('Please enable at least one payment method');
      return;
    }

    setSavingPayment(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        enrollment_type: paymentEnabled ? 'paid' : 'free',
        price: paymentEnabled ? coursePrice : null,
        currency: currency || 'USD',
        // Enhanced payment fields
        payment_mode: paymentEnabled ? paymentMode : 'full',
        partial_payment_amount: paymentEnabled && paymentMode === 'partial' && partialType === 'amount' ? partialPaymentAmount : null,
        partial_payment_percentage: paymentEnabled && paymentMode === 'partial' && partialType === 'percentage' ? partialPaymentPercentage : null,
        paypal_enabled: paypalEnabled,
        mobile_money_enabled: mobileMoneyEnabled,
        bank_transfer_enabled: bankTransferEnabled,
        kpay_enabled: kpayEnabled,
        bank_transfer_details: bankTransferEnabled ? bankTransferDetails : null,
        installment_enabled: installmentEnabled,
        installment_count: installmentEnabled ? installmentCount : null,
        installment_interval_days: installmentEnabled ? installmentIntervalDays : null,
        require_payment_before_application: requirePaymentBeforeApplication,
        payment_deadline_days: paymentDeadlineDays > 0 ? paymentDeadlineDays : null,
        // Build methods array from toggles
        payment_methods: [
          ...(paypalEnabled ? ['paypal'] : []),
          ...(mobileMoneyEnabled ? ['mobile_money'] : []),
          ...(bankTransferEnabled ? ['bank_transfer'] : []),
          ...(stripeEnabled ? ['stripe'] : []),
          ...(kpayEnabled ? ['kpay'] : []),
        ],
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
        throw new Error((errorData as any)?.message || 'Failed to save payment settings');
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

      {/* Application & Cohort Settings */}
      <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Calendar className="h-5 w-5" />
            Application & Cohort Settings
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Configure application windows and cohort timing for this course
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="application-start" className="text-slate-900 dark:text-white">Application Start</Label>
              <Input
                id="application-start"
                type="date"
                value={applicationStartDate}
                onChange={(e) => setApplicationStartDate(e.target.value)}
                className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="application-end" className="text-slate-900 dark:text-white">Application Deadline</Label>
              <Input
                id="application-end"
                type="date"
                value={applicationEndDate}
                onChange={(e) => setApplicationEndDate(e.target.value)}
                className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cohort-start" className="text-slate-900 dark:text-white">Cohort Start</Label>
              <Input
                id="cohort-start"
                type="date"
                value={cohortStartDate}
                onChange={(e) => setCohortStartDate(e.target.value)}
                className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cohort-end" className="text-slate-900 dark:text-white">Cohort End</Label>
              <Input
                id="cohort-end"
                type="date"
                value={cohortEndDate}
                onChange={(e) => setCohortEndDate(e.target.value)}
                className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cohort-label" className="text-slate-900 dark:text-white">Cohort Label</Label>
              <Input
                id="cohort-label"
                type="text"
                value={cohortLabel}
                onChange={(e) => setCohortLabel(e.target.value)}
                placeholder="e.g., January 2025 Cohort"
                className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="application-timezone" className="text-slate-900 dark:text-white">Application Timezone</Label>
              <Input
                id="application-timezone"
                type="text"
                value={applicationTimezone}
                onChange={(e) => setApplicationTimezone(e.target.value)}
                placeholder="UTC"
                className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Used to evaluate window open/close times.</p>
            </div>
          </div>

          {course.application_window && (
            <Alert className="bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-1">
                <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <Badge variant="outline" className="uppercase">
                    {course.application_window.status}
                  </Badge>
                  {course.application_window.cohort_label && (
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {course.application_window.cohort_label}
                    </span>
                  )}
                </div>
                {course.application_window.reason && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">{course.application_window.reason}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Additional Cohorts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium text-slate-900 dark:text-white">Additional Cohorts</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Add multiple cohorts/windows for this course</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAdditionalCohorts([...additionalCohorts, {
                  id: `${Date.now()}`,
                  label: `Cohort ${additionalCohorts.length + 2}`,
                  opensAt: '',
                  closesAt: '',
                  startDate: '',
                  endDate: '',
                  status: 'open',
                }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Add cohort
              </Button>
            </div>

            {additionalCohorts.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">No extra cohorts yet.</p>
            )}

            <div className="space-y-4">
              {additionalCohorts.map((cohort, idx) => (
                <div key={cohort.id} className="p-4 border rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900 dark:text-white">Cohort {idx + 2}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAdditionalCohorts(additionalCohorts.filter((c) => c.id !== cohort.id))}
                    >
                      <Trash className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Label</Label>
                      <Input
                        value={cohort.label}
                        onChange={(e) => setAdditionalCohorts(additionalCohorts.map(c => c.id === cohort.id ? { ...c, label: e.target.value } : c))}
                        placeholder="e.g., March 2025 Cohort"
                        className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">Application Opens</Label>
                      <Input
                        type="date"
                        value={cohort.opensAt}
                        onChange={(e) => setAdditionalCohorts(additionalCohorts.map(c => c.id === cohort.id ? { ...c, opensAt: e.target.value } : c))}
                        className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">Application Closes</Label>
                      <Input
                        type="date"
                        value={cohort.closesAt}
                        onChange={(e) => setAdditionalCohorts(additionalCohorts.map(c => c.id === cohort.id ? { ...c, closesAt: e.target.value } : c))}
                        className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Cohort Start</Label>
                      <Input
                        type="date"
                        value={cohort.startDate}
                        onChange={(e) => setAdditionalCohorts(additionalCohorts.map(c => c.id === cohort.id ? { ...c, startDate: e.target.value } : c))}
                        className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">Cohort End</Label>
                      <Input
                        type="date"
                        value={cohort.endDate}
                        onChange={(e) => setAdditionalCohorts(additionalCohorts.map(c => c.id === cohort.id ? { ...c, endDate: e.target.value } : c))}
                        className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">Status</Label>
                      <Select
                        value={cohort.status}
                        onValueChange={(value) => setAdditionalCohorts(additionalCohorts.map(c => c.id === cohort.id ? { ...c, status: value as 'open' | 'upcoming' | 'closed' } : c))}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveApplicationWindow}
              disabled={savingApplication}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingApplication ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Application Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

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
            Configure pricing, payment methods, and enrollment payment requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Enable Paid Course */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="enable-payment" className="text-base font-medium text-slate-900 dark:text-white">
                Enable Paid Enrollment
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Require students to pay before or after submitting their application
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

              {/* Price & Currency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course-price" className="text-slate-900 dark:text-white font-semibold">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Full course tuition fee</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course-currency" className="text-slate-900 dark:text-white font-semibold">
                    Currency
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="course-currency" className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD – US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR – Euro</SelectItem>
                      <SelectItem value="GBP">GBP – British Pound</SelectItem>
                      <SelectItem value="GHS">GHS – Ghanaian Cedi</SelectItem>
                      <SelectItem value="NGN">NGN – Nigerian Naira</SelectItem>
                      <SelectItem value="KES">KES – Kenyan Shilling</SelectItem>
                      <SelectItem value="UGX">UGX – Ugandan Shilling</SelectItem>
                      <SelectItem value="RWF">RWF – Rwandan Franc</SelectItem>
                      <SelectItem value="ZMW">ZMW – Zambian Kwacha</SelectItem>
                      <SelectItem value="TZS">TZS – Tanzanian Shilling</SelectItem>
                      <SelectItem value="XOF">XOF – West African CFA</SelectItem>
                      <SelectItem value="XAF">XAF – Central African CFA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Payment Methods */}
              <div className="space-y-3">
                <Label className="text-base font-semibold text-slate-900 dark:text-white">
                  Accepted Payment Methods
                </Label>
                <p className="text-sm text-slate-500 dark:text-slate-400">Enable the payment methods students can use to pay for this course</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* PayPal */}
                  <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${paypalEnabled ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/30'}`}
                    onClick={() => setPaypalEnabled(!paypalEnabled)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${paypalEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <CreditCard className={`h-4 w-4 ${paypalEnabled ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">PayPal</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Credit/debit cards & PayPal balance</p>
                        </div>
                      </div>
                      <Switch checked={paypalEnabled} onCheckedChange={setPaypalEnabled} onClick={(e) => e.stopPropagation()} />
                    </div>
                    {paypalEnabled && <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">Available worldwide – requires PAYPAL_CLIENT_ID in env</p>}
                  </div>

                  {/* Mobile Money */}
                  <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${mobileMoneyEnabled ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/30'}`}
                    onClick={() => setMobileMoneyEnabled(!mobileMoneyEnabled)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${mobileMoneyEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <CreditCard className={`h-4 w-4 ${mobileMoneyEnabled ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">MTN Mobile Money</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Mobile wallet payments (Africa)</p>
                        </div>
                      </div>
                      <Switch checked={mobileMoneyEnabled} onCheckedChange={setMobileMoneyEnabled} onClick={(e) => e.stopPropagation()} />
                    </div>
                    {mobileMoneyEnabled && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Ghana, Nigeria, Uganda, Rwanda, Cameroon, and more</p>}
                  </div>

                  {/* Stripe / Card */}
                  <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${stripeEnabled ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/30'}`}
                    onClick={() => setStripeEnabled(!stripeEnabled)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${stripeEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <CreditCard className={`h-4 w-4 ${stripeEnabled ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">Stripe / Card</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Credit/debit cards via Stripe</p>
                        </div>
                      </div>
                      <Switch checked={stripeEnabled} onCheckedChange={setStripeEnabled} onClick={(e) => e.stopPropagation()} />
                    </div>
                    {stripeEnabled && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">Requires STRIPE_PUBLISHABLE_KEY in env</p>}
                  </div>

                  {/* K-Pay */}
                  <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${kpayEnabled ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/30'}`}
                    onClick={() => setKpayEnabled(!kpayEnabled)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${kpayEnabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <CreditCard className={`h-4 w-4 ${kpayEnabled ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">K-Pay <span className="text-xs text-violet-600 font-bold ml-1">Main</span></p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">MTN / Airtel MoMo, Visa, Mastercard, SPENN</p>
                        </div>
                      </div>
                      <Switch checked={kpayEnabled} onCheckedChange={setKpayEnabled} onClick={(e) => e.stopPropagation()} />
                    </div>
                    {kpayEnabled && <p className="text-xs text-violet-600 dark:text-violet-400 mt-2">Africa-focused gateway – requires KPAY_API_KEY in env</p>}
                  </div>

                  {/* Bank Transfer */}
                  <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${bankTransferEnabled ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/30'}`}
                    onClick={() => setBankTransferEnabled(!bankTransferEnabled)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${bankTransferEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <CreditCard className={`h-4 w-4 ${bankTransferEnabled ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">Bank Transfer</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Manual direct bank transfer</p>
                        </div>
                      </div>
                      <Switch
                        checked={bankTransferEnabled}
                        onCheckedChange={(checked) => {
                          setBankTransferEnabled(checked);
                          // Auto-fill with default Bank of Kigali details the first time it's enabled
                          if (checked && !bankTransferDetails) {
                            setBankTransferDetails(
                              "Bank Name: BANK OF KIGALI\nAccount Name: Afritech Bridge\nAccount Number: 100075243884\nReference: [Student Full Name + Course Name]"
                            );
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Transfer Details */}
                {bankTransferEnabled && (
                  <div className="space-y-2 mt-2">
                    <Label htmlFor="bank-details" className="text-slate-900 dark:text-white font-semibold">
                      Bank Account Details
                    </Label>
                    <textarea
                      id="bank-details"
                      rows={4}
                      value={bankTransferDetails}
                      onChange={(e) => setBankTransferDetails(e.target.value)}
                      placeholder="Bank Name: BANK OF KIGALI&#10;Account Name: Afritech Bridge&#10;Account Number: 100075243884&#10;Reference: [Student Full Name + Course Name]"
                      className="w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-3 text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">These details will be shown to students who choose bank transfer</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Payment Mode */}
              <div className="space-y-3">
                <Label className="text-base font-semibold text-slate-900 dark:text-white">Payment Mode</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    onClick={() => setPaymentMode('full')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${paymentMode === 'full' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                    <p className="font-semibold text-slate-900 dark:text-white">Full Payment</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Students pay the full course fee upfront</p>
                  </div>
                  <div
                    onClick={() => setPaymentMode('partial')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${paymentMode === 'partial' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                    <p className="font-semibold text-slate-900 dark:text-white">Partial Payment</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Students pay a portion upfront, rest later</p>
                  </div>
                </div>

                {paymentMode === 'partial' && (
                  <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={partialType === 'percentage'} onChange={() => setPartialType('percentage')} className="accent-blue-600" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Percentage</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={partialType === 'amount'} onChange={() => setPartialType('amount')} className="accent-blue-600" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Fixed Amount</span>
                      </label>
                    </div>
                    {partialType === 'percentage' ? (
                      <div className="space-y-1">
                        <Label className="text-slate-900 dark:text-white">Upfront Percentage (%)</Label>
                        <Input type="number" min={1} max={99} value={partialPaymentPercentage}
                          onChange={(e) => setPartialPaymentPercentage(parseFloat(e.target.value) || 50)}
                          className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 max-w-xs" />
                        <p className="text-xs text-slate-500">
                          Students pay {partialPaymentPercentage}% ({currency} {((coursePrice * partialPaymentPercentage) / 100).toFixed(2)}) upfront,
                          balance {currency} {(coursePrice - (coursePrice * partialPaymentPercentage) / 100).toFixed(2)} later
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-slate-900 dark:text-white">Upfront Amount ({currency})</Label>
                        <Input type="number" min={1} max={coursePrice - 1} value={partialPaymentAmount}
                          onChange={(e) => setPartialPaymentAmount(parseFloat(e.target.value) || 0)}
                          className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 max-w-xs" />
                        <p className="text-xs text-slate-500">
                          Students pay {currency} {partialPaymentAmount} upfront, balance {currency} {(coursePrice - partialPaymentAmount).toFixed(2)} later
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Installment Payments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold text-slate-900 dark:text-white">Installment Payments</Label>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Allow students to pay in multiple installments</p>
                  </div>
                  <Switch checked={installmentEnabled} onCheckedChange={setInstallmentEnabled} />
                </div>

                {installmentEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600">
                    <div className="space-y-2">
                      <Label className="text-slate-900 dark:text-white">Number of Installments</Label>
                      <Select value={String(installmentCount)} onValueChange={(v) => setInstallmentCount(Number(v))}>
                        <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 installments</SelectItem>
                          <SelectItem value="3">3 installments</SelectItem>
                          <SelectItem value="4">4 installments</SelectItem>
                          <SelectItem value="6">6 installments</SelectItem>
                          <SelectItem value="12">12 installments (monthly)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">{currency} {(coursePrice / installmentCount).toFixed(2)} per installment</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-900 dark:text-white">Interval Between Payments (days)</Label>
                      <Input type="number" min={7} value={installmentIntervalDays}
                        onChange={(e) => setInstallmentIntervalDays(parseInt(e.target.value) || 30)}
                        className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600" />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Payment Timing */}
              <div className="space-y-3">
                <Label className="text-base font-semibold text-slate-900 dark:text-white">Payment Timing</Label>

                <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-slate-900 dark:text-white">
                      Require Payment Before Application
                    </Label>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Students must complete payment before they can submit their application form
                    </p>
                  </div>
                  <Switch checked={requirePaymentBeforeApplication} onCheckedChange={setRequirePaymentBeforeApplication} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-deadline" className="text-slate-900 dark:text-white">
                    Payment Deadline (days before cohort start)
                  </Label>
                  <Input
                    id="payment-deadline"
                    type="number"
                    min={0}
                    value={paymentDeadlineDays}
                    onChange={(e) => setPaymentDeadlineDays(parseInt(e.target.value) || 0)}
                    placeholder="0 = no deadline"
                    className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 max-w-xs"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    0 means no deadline. Set e.g. 7 to require payment at least 7 days before cohort starts.
                  </p>
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
