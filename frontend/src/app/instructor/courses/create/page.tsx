"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CourseService } from '@/services/course.service';
import { CreateCourseRequest } from '@/types/api';
import { Sparkles, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { AICourseGenerator } from '@/components/instructor/ai-agent';
import { useAutoSave } from '@/hooks/useAutoSave';
import { AutoSaveIndicator, DraftRestoreBanner } from '@/components/ui/form-components';
import { z } from 'zod';
import { validateField } from '@/lib/form-validation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CourseFormData = {
  title: string;
  description: string;
  learning_objectives: string;
  target_audience: string;
  estimated_duration: string;
  application_start_date: string;
  application_end_date: string;
  cohort_start_date: string;
  cohort_end_date: string;
  cohort_label: string;
  application_timezone: string;
};

const EMPTY_FORM: CourseFormData = {
  title: '',
  description: '',
  learning_objectives: '',
  target_audience: '',
  estimated_duration: '',
  application_start_date: '',
  application_end_date: '',
  cohort_start_date: '',
  cohort_end_date: '',
  cohort_label: '',
  application_timezone: 'UTC',
};

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type StepKey = 'basics' | 'details' | 'schedule';

interface StepDef {
  key: StepKey;
  label: string;
  description: string;
  fields: (keyof CourseFormData)[];
}

const STEPS: StepDef[] = [
  {
    key: 'basics',
    label: 'Basic Info',
    description: 'Course title and description',
    fields: ['title', 'description'],
  },
  {
    key: 'details',
    label: 'Course Details',
    description: 'Objectives, audience, and duration',
    fields: ['learning_objectives', 'target_audience', 'estimated_duration'],
  },
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Application window and cohort dates',
    fields: [
      'application_start_date',
      'application_end_date',
      'cohort_start_date',
      'cohort_end_date',
      'cohort_label',
      'application_timezone',
    ],
  },
];

// ---------------------------------------------------------------------------
// Per-field Zod schemas
// ---------------------------------------------------------------------------

const FIELD_SCHEMAS: Partial<Record<keyof CourseFormData, z.ZodTypeAny>> = {
  title: z
    .string()
    .min(1, 'Course title is required')
    .min(5, 'Course title must be at least 5 characters')
    .max(255, 'Title must be less than 255 characters'),
  description: z
    .string()
    .min(1, 'Description is required')
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description must be less than 2000 characters'),
  learning_objectives: z.string().max(1000, 'Must be less than 1000 characters').optional(),
  target_audience: z.string().max(255, 'Must be less than 255 characters').optional(),
  estimated_duration: z.string().max(100, 'Must be less than 100 characters').optional(),
  cohort_label: z.string().max(100, 'Must be less than 100 characters').optional(),
  application_timezone: z.string().max(50, 'Must be less than 50 characters').optional(),
};

// Required fields per step (used for "Next" gate)
const REQUIRED_FIELDS: Partial<Record<StepKey, (keyof CourseFormData)[]>> = {
  basics: ['title', 'description'],
};

// Human-readable labels for error messages
const FIELD_LABELS: Partial<Record<keyof CourseFormData, string>> = {
  title: 'Course Title',
  description: 'Description',
  learning_objectives: 'Learning Objectives',
  target_audience: 'Target Audience',
  estimated_duration: 'Estimated Duration',
  application_start_date: 'Application Opens',
  application_end_date: 'Application Deadline',
  cohort_start_date: 'Cohort Start',
  cohort_end_date: 'Cohort End',
  cohort_label: 'Cohort Label',
  application_timezone: 'Timezone',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CreateCoursePage = () => {
  const router = useRouter();
  const { token } = useAuth();

  const [currentStep, setCurrentStep] = useState(0); // 0-indexed
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const [formData, setFormData] = useState<CourseFormData>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CourseFormData, string>>>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<keyof CourseFormData, boolean>>>({});

  // Draft restore
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<CourseFormData | null>(null);

  // Completed steps (for step indicator)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Auto-save
  const { status: saveStatus, lastSaved, clearDraft } = useAutoSave<CourseFormData>({
    key: 'create_course',
    data: formData,
    debounceMs: 1500,
    onRestore: (draft) => {
      setPendingDraft(draft);
      setShowDraftBanner(true);
    },
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Validate every field in a step. Returns errors map — empty means all valid. */
  const validateStep = useCallback(
    (stepIndex: number): Partial<Record<keyof CourseFormData, string>> => {
      const step = STEPS[stepIndex];
      const errors: Partial<Record<keyof CourseFormData, string>> = {};

      for (const field of step.fields) {
        const schema = FIELD_SCHEMAS[field];
        const isRequired = REQUIRED_FIELDS[step.key]?.includes(field) ?? false;
        const value = formData[field] as string;

        if (isRequired && !value.trim()) {
          errors[field] = `${FIELD_LABELS[field] ?? field} is required`;
          continue;
        }
        if (schema && value) {
          const err = validateField(schema, value);
          if (err) errors[field] = err;
        }
      }

      return errors;
    },
    [formData]
  );

  /** Mark all fields in the current step as touched (so errors show) */
  const touchStepFields = (stepIndex: number) => {
    const step = STEPS[stepIndex];
    setTouchedFields((prev) => {
      const next = { ...prev };
      for (const f of step.fields) next[f] = true;
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Live-clear error once field is touched
    if (touchedFields[name as keyof CourseFormData]) {
      const schema = FIELD_SCHEMAS[name as keyof CourseFormData];
      const isRequired = REQUIRED_FIELDS[STEPS[currentStep].key]?.includes(name as keyof CourseFormData) ?? false;
      if (isRequired && !value.trim()) {
        setFieldErrors((prev) => ({ ...prev, [name]: `${FIELD_LABELS[name as keyof CourseFormData] ?? name} is required` }));
      } else if (schema && value) {
        setFieldErrors((prev) => ({ ...prev, [name]: validateField(schema, value) }));
      } else {
        setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    }
  };

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTouchedFields((prev) => ({ ...prev, [name]: true }));
    const schema = FIELD_SCHEMAS[name as keyof CourseFormData];
    const isRequired = REQUIRED_FIELDS[STEPS[currentStep].key]?.includes(name as keyof CourseFormData) ?? false;

    if (isRequired && !value.trim()) {
      setFieldErrors((prev) => ({ ...prev, [name]: `${FIELD_LABELS[name as keyof CourseFormData] ?? name} is required` }));
    } else if (schema && value) {
      setFieldErrors((prev) => ({ ...prev, [name]: validateField(schema, value) }));
    } else {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  /** "Next Section" click — validate current step, advance if valid */
  const handleNext = () => {
    touchStepFields(currentStep);
    const errors = validateStep(currentStep);
    setFieldErrors((prev) => ({ ...prev, ...errors }));

    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) return; // stay on current step

    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Jump directly to a completed step or the current step */
  const handleStepClick = (index: number) => {
    if (index < currentStep || completedSteps.has(index)) {
      setCurrentStep(index);
    }
  };

  const handleAIGenerate = (aiData: Record<string, string>) => {
    setFormData((prev) => ({
      ...prev,
      title: aiData.title || prev.title,
      description: aiData.description || prev.description,
      learning_objectives: aiData.learning_objectives || prev.learning_objectives,
      target_audience: aiData.target_audience || prev.target_audience,
      estimated_duration: aiData.estimated_duration || prev.estimated_duration,
    }));
    setShowAIAssistant(false);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // Validate current (last) step before submitting
    touchStepFields(currentStep);
    const lastStepErrors = validateStep(currentStep);
    if (Object.keys(lastStepErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...lastStepErrors }));
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const payload: CreateCourseRequest = {
        ...formData,
        application_start_date: formData.application_start_date || null,
        application_end_date: formData.application_end_date || null,
        cohort_start_date: formData.cohort_start_date || null,
        cohort_end_date: formData.cohort_end_date || null,
        cohort_label: formData.cohort_label || null,
        application_timezone: formData.application_timezone || 'UTC',
      };

      const course = await CourseService.createCourse(payload);
      clearDraft();
      router.push(`/instructor/courses/${course.id}`);
    } catch (err: unknown) {
      const errObj = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      if (errObj.response?.status === 409) {
        setSubmitError('A course with this title already exists. Please choose a different title.');
      } else if (errObj.response?.data?.message) {
        setSubmitError(errObj.response.data.message);
      } else {
        setSubmitError(errObj.message || 'Failed to create course');
      }
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const baseInput =
    'w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 transition-colors dark:bg-slate-700 dark:text-white';

  const fieldCls = (name: keyof CourseFormData) =>
    `${baseInput} ${
      fieldErrors[name]
        ? 'border-red-500 focus:ring-red-400 bg-red-50 dark:bg-red-900/10'
        : touchedFields[name] && !fieldErrors[name]
        ? 'border-green-500 focus:ring-green-400'
        : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
    }`;

  const FieldError = ({ name }: { name: keyof CourseFormData }) =>
    fieldErrors[name] ? (
      <p role="alert" className="mt-1 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        {fieldErrors[name]}
      </p>
    ) : null;

  const CharCount = ({ name, max }: { name: keyof CourseFormData; max: number }) => {
    const len = (formData[name] as string).length;
    return (
      <span
        className={`text-xs tabular-nums ${
          len >= max ? 'text-red-500 font-semibold' : len > max * 0.85 ? 'text-orange-500' : 'text-slate-400'
        }`}
      >
        {len}/{max}
      </span>
    );
  };

  // Errors for the current step (to show in the banner)
  const currentStepErrors = STEPS[currentStep].fields
    .filter((f) => fieldErrors[f])
    .map((f) => ({ field: f, label: FIELD_LABELS[f] ?? String(f), message: fieldErrors[f]! }));

  const isLastStep = currentStep === STEPS.length - 1;

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Create New Course</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Fill in the details across all sections to publish your course.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
          >
            <Sparkles className="w-5 h-5" />
            {showAIAssistant ? 'Hide' : 'AI'} Assistant
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const isCompleted = completedSteps.has(i);
            const isCurrent = i === currentStep;
            const isClickable = i < currentStep || isCompleted;

            return (
              <React.Fragment key={step.key}>
                {/* Step circle */}
                <button
                  type="button"
                  onClick={() => handleStepClick(i)}
                  disabled={!isClickable && !isCurrent}
                  className={`flex flex-col items-center min-w-[80px] group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isCurrent
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-medium text-center leading-tight ${
                      isCurrent
                        ? 'text-blue-600 dark:text-blue-400'
                        : isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 mt-[-18px] transition-colors ${
                      completedSteps.has(i) ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Banners */}
      {showDraftBanner && (
        <DraftRestoreBanner
          className="mb-6"
          onRestore={() => {
            if (pendingDraft) setFormData(pendingDraft);
            setPendingDraft(null);
            setShowDraftBanner(false);
          }}
          onDiscard={() => {
            clearDraft();
            setPendingDraft(null);
            setShowDraftBanner(false);
          }}
        />
      )}

      {showAIAssistant && (
        <div className="mb-6">
          <AICourseGenerator onGenerate={handleAIGenerate} />
        </div>
      )}

      {/* Validation error summary for current step */}
      {currentStepErrors.length > 0 && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                {currentStepErrors.length === 1
                  ? 'Please fix the following field before continuing:'
                  : `Please fix the following ${currentStepErrors.length} fields before continuing:`}
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {currentStepErrors.map(({ field, label, message }) => (
                  <li key={field} className="text-sm text-red-700 dark:text-red-300">
                    <button
                      type="button"
                      className="font-medium underline underline-offset-2 hover:text-red-900 dark:hover:text-red-100"
                      onClick={() => document.getElementById(field)?.focus()}
                    >
                      {label}
                    </button>
                    {' '}— {message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
        </div>
      )}

      {/* Form card */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          {/* Section header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {STEPS[currentStep].label}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {STEPS[currentStep].description}
              </p>
            </div>
            <AutoSaveIndicator status={saveStatus} lastSaved={lastSaved} />
          </div>

          {/* ── Step 0: Basic Info ── */}
          {currentStep === 0 && (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="title" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Course Title <span className="text-red-500">*</span>
                  </label>
                  <CharCount name="title" max={255} />
                </div>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  maxLength={255}
                  className={fieldCls('title')}
                  placeholder="e.g., Introduction to Data Science"
                  aria-required="true"
                  aria-invalid={!!fieldErrors.title}
                  aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                />
                <FieldError name="title" />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <CharCount name="description" max={2000} />
                </div>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  rows={5}
                  maxLength={2000}
                  className={`${fieldCls('description')} resize-none`}
                  placeholder="Describe what students will learn. Be specific about skills and outcomes."
                  aria-required="true"
                  aria-invalid={!!fieldErrors.description}
                />
                <FieldError name="description" />
              </div>
            </div>
          )}

          {/* ── Step 1: Course Details ── */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Learning Objectives */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="learning_objectives" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Learning Objectives
                  </label>
                  <CharCount name="learning_objectives" max={1000} />
                </div>
                <textarea
                  id="learning_objectives"
                  name="learning_objectives"
                  value={formData.learning_objectives}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  rows={4}
                  maxLength={1000}
                  className={`${fieldCls('learning_objectives')} resize-none`}
                  placeholder="What will students be able to do after completing this course?"
                />
                <FieldError name="learning_objectives" />
              </div>

              {/* Target Audience */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="target_audience" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Target Audience
                  </label>
                  <CharCount name="target_audience" max={255} />
                </div>
                <input
                  type="text"
                  id="target_audience"
                  name="target_audience"
                  value={formData.target_audience}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  maxLength={255}
                  className={fieldCls('target_audience')}
                  placeholder="Who is this course designed for?"
                />
                <FieldError name="target_audience" />
              </div>

              {/* Estimated Duration */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="estimated_duration" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Estimated Duration
                  </label>
                  <CharCount name="estimated_duration" max={100} />
                </div>
                <input
                  type="text"
                  id="estimated_duration"
                  name="estimated_duration"
                  value={formData.estimated_duration}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  maxLength={100}
                  className={fieldCls('estimated_duration')}
                  placeholder="e.g., 6 weeks, 40 hours"
                />
                <FieldError name="estimated_duration" />
              </div>
            </div>
          )}

          {/* ── Step 2: Schedule ── */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Application window */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">
                  Application Window
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="application_start_date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Application Opens
                    </label>
                    <input
                      type="date"
                      id="application_start_date"
                      name="application_start_date"
                      value={formData.application_start_date}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      className={fieldCls('application_start_date')}
                    />
                    <FieldError name="application_start_date" />
                  </div>

                  <div>
                    <label htmlFor="application_end_date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Application Deadline
                    </label>
                    <input
                      type="date"
                      id="application_end_date"
                      name="application_end_date"
                      value={formData.application_end_date}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      className={fieldCls('application_end_date')}
                    />
                    <FieldError name="application_end_date" />
                  </div>
                </div>
              </div>

              {/* Cohort */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">
                  Cohort
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cohort_start_date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Cohort Start
                    </label>
                    <input
                      type="date"
                      id="cohort_start_date"
                      name="cohort_start_date"
                      value={formData.cohort_start_date}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      className={fieldCls('cohort_start_date')}
                    />
                    <FieldError name="cohort_start_date" />
                  </div>

                  <div>
                    <label htmlFor="cohort_end_date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Cohort End
                    </label>
                    <input
                      type="date"
                      id="cohort_end_date"
                      name="cohort_end_date"
                      value={formData.cohort_end_date}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      className={fieldCls('cohort_end_date')}
                    />
                    <FieldError name="cohort_end_date" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="cohort_label" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Cohort Label
                      </label>
                      <CharCount name="cohort_label" max={100} />
                    </div>
                    <input
                      type="text"
                      id="cohort_label"
                      name="cohort_label"
                      value={formData.cohort_label}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      maxLength={100}
                      className={fieldCls('cohort_label')}
                      placeholder="e.g., January 2025 Cohort"
                    />
                    <FieldError name="cohort_label" />
                  </div>

                  <div>
                    <label htmlFor="application_timezone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Timezone
                    </label>
                    <input
                      type="text"
                      id="application_timezone"
                      name="application_timezone"
                      value={formData.application_timezone}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      className={fieldCls('application_timezone')}
                      placeholder="UTC"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Used to determine application window timing.
                    </p>
                    <FieldError name="application_timezone" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={currentStep === 0 ? () => router.back() : handleBack}
            className="flex items-center gap-2 px-5 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Step {currentStep + 1} of {STEPS.length}
            </span>

            {!isLastStep ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
              >
                Next Section
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
              >
                {loading ? 'Creating…' : 'Create Course'}
                {!loading && <CheckCircle2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateCoursePage;

