"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Course } from "@/types/api";
import {
  AdminService,
  CourseFormData,
  InstructorOption,
} from "@/services/admin.service";

interface CourseFormProps {
  courseId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CURRENCIES = ["USD", "EUR", "GBP", "RWF", "KES", "UGX", "TZS", "NGN", "ZAR", "GHS"];

const EMPTY_FORM: CourseFormData = {
  title: "",
  description: "",
  learning_objectives: "",
  target_audience: "",
  estimated_duration: "",
  instructor_id: "",
  is_published: false,
  enrollment_type: "free",
  price: null,
  currency: "USD",
  payment_mode: "full",
  partial_payment_amount: null,
  partial_payment_percentage: null,
  require_payment_before_application: false,
  paypal_enabled: true,
  mobile_money_enabled: true,
  bank_transfer_enabled: false,
  kpay_enabled: true,
  flutterwave_enabled: false,
  bank_transfer_details: null,
  installment_enabled: false,
  installment_count: null,
  installment_interval_days: null,
  payment_deadline_days: null,
  application_start_date: null,
  application_end_date: null,
  cohort_start_date: null,
  cohort_end_date: null,
  cohort_label: null,
  application_timezone: "UTC",
  start_date: null,
  module_release_count: null,
  module_release_interval: null,
  module_release_interval_days: null,
};

type Tab = "basic" | "payment" | "schedule" | "advanced";

export const CourseForm: React.FC<CourseFormProps> = ({ courseId, onSuccess, onCancel }) => {
  const router = useRouter();
  const [formData, setFormData] = useState<CourseFormData>({ ...EMPTY_FORM });
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const isEditMode = !!courseId;

  // Fetch instructors list
  useEffect(() => {
    const load = async () => {
      try {
        const data = await AdminService.getInstructors();
        setInstructors(data);
      } catch {
        console.error("Failed to fetch instructors");
      }
    };
    load();
  }, []);

  // Fetch course data for edit
  const loadCourse = useCallback(async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      const course = await AdminService.getCourse(courseId);
      setFormData({
        title: course.title || "",
        description: course.description || "",
        learning_objectives: course.learning_objectives || "",
        target_audience: course.target_audience || "",
        estimated_duration: course.estimated_duration || "",
        instructor_id: course.instructor_id,
        is_published: course.is_published ?? false,
        enrollment_type: course.enrollment_type || "free",
        price: course.price ?? null,
        currency: course.currency || "USD",
        payment_mode: course.payment_mode || "full",
        partial_payment_amount: course.partial_payment_amount ?? null,
        partial_payment_percentage: course.partial_payment_percentage ?? null,
        require_payment_before_application: course.require_payment_before_application ?? false,
        paypal_enabled: course.paypal_enabled ?? true,
        mobile_money_enabled: course.mobile_money_enabled ?? true,
        bank_transfer_enabled: course.bank_transfer_enabled ?? false,
        kpay_enabled: course.kpay_enabled ?? true,
        flutterwave_enabled: course.flutterwave_enabled ?? false,
        bank_transfer_details: course.bank_transfer_details ?? null,
        installment_enabled: course.installment_enabled ?? false,
        installment_count: course.installment_count ?? null,
        installment_interval_days: course.installment_interval_days ?? null,
        payment_deadline_days: course.payment_deadline_days ?? null,
        application_start_date: course.application_start_date ? course.application_start_date.slice(0, 16) : null,
        application_end_date: course.application_end_date ? course.application_end_date.slice(0, 16) : null,
        cohort_start_date: course.cohort_start_date ? course.cohort_start_date.slice(0, 16) : null,
        cohort_end_date: course.cohort_end_date ? course.cohort_end_date.slice(0, 16) : null,
        cohort_label: course.cohort_label ?? null,
        application_timezone: course.application_timezone || "UTC",
        start_date: course.start_date ? course.start_date.slice(0, 16) : null,
        module_release_count: course.module_release_count ?? null,
        module_release_interval: course.module_release_interval ?? null,
        module_release_interval_days: course.module_release_interval_days ?? null,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // ---- Validation ----
  const validate = (): string | null => {
    if (!formData.title.trim()) return "Course title is required";
    if (!formData.description.trim()) return "Course description is required";
    if (!formData.instructor_id) return "Please select an instructor";
    if (formData.enrollment_type === "paid") {
      if (!formData.price || formData.price <= 0) return "Paid courses must have a price greater than 0";
    }
    if (formData.payment_mode === "partial") {
      if (!formData.partial_payment_amount && !formData.partial_payment_percentage) {
        return "Partial payment requires either a fixed amount or a percentage";
      }
      if (formData.partial_payment_percentage && (formData.partial_payment_percentage < 0 || formData.partial_payment_percentage > 100)) {
        return "Partial payment percentage must be between 0 and 100";
      }
    }
    if (formData.application_start_date && formData.application_end_date) {
      if (new Date(formData.application_end_date) < new Date(formData.application_start_date)) {
        return "Application end date must be after start date";
      }
    }
    if (formData.cohort_start_date && formData.cohort_end_date) {
      if (new Date(formData.cohort_end_date) < new Date(formData.cohort_start_date)) {
        return "Cohort end date must be after start date";
      }
    }
    return null;
  };

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      const payload: any = { ...formData };
      // Ensure instructor_id is a number
      payload.instructor_id = Number(payload.instructor_id);
      // Clean nullish date fields
      if (!payload.application_start_date) delete payload.application_start_date;
      if (!payload.application_end_date) delete payload.application_end_date;
      if (!payload.cohort_start_date) delete payload.cohort_start_date;
      if (!payload.cohort_end_date) delete payload.cohort_end_date;
      if (!payload.start_date) delete payload.start_date;

      if (isEditMode) {
        await AdminService.updateCourse(courseId!, payload);
        setSuccess("Course updated successfully!");
      } else {
        await AdminService.createCourse(payload);
        setSuccess("Course created successfully!");
      }

      setTimeout(() => {
        onSuccess?.();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  // ---- Change handlers ----
  const set = (field: keyof CourseFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      set(name as any, (e.target as HTMLInputElement).checked);
    } else if (type === "number") {
      set(name as any, value === "" ? null : Number(value));
    } else {
      set(name as any, value);
    }
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
          <span className="text-sm text-slate-400">Loading course details...</span>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "basic", label: "Basic Info", icon: "📝" },
    { key: "payment", label: "Payment & Enrollment", icon: "💳" },
    { key: "schedule", label: "Schedule & Cohort", icon: "📅" },
    { key: "advanced", label: "Module Release", icon: "⚙️" },
  ];

  const inputClass =
    "w-full px-4 py-2.5 bg-brand-light border border-brand-lighter rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-sm text-white placeholder-slate-400 transition-shadow";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";
  const helpClass = "text-xs text-slate-500 mt-1";

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
      {/* Messages */}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold text-red-400 ml-4">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-brand rounded-t-xl border border-b-0 border-brand-light flex overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-accent text-accent bg-accent/10"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-brand-light"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-brand rounded-b-xl border border-brand-light shadow-sm p-6 md:p-8">
        {/* ===== BASIC INFO TAB ===== */}
        {activeTab === "basic" && (
          <div className="space-y-5">
            <div>
              <label className={labelClass}>
                Course Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Introduction to Web Development"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Provide a detailed description of the course..."
                rows={4}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Learning Objectives</label>
                <textarea
                  name="learning_objectives"
                  value={formData.learning_objectives || ""}
                  onChange={handleChange}
                  placeholder="What will students learn? (one per line)"
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Target Audience</label>
                <input
                  type="text"
                  name="target_audience"
                  value={formData.target_audience || ""}
                  onChange={handleChange}
                  placeholder="e.g., Beginners, Professionals"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Estimated Duration</label>
                <input
                  type="text"
                  name="estimated_duration"
                  value={formData.estimated_duration || ""}
                  onChange={handleChange}
                  placeholder="e.g., 4 weeks, 40 hours"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Instructor <span className="text-red-500">*</span>
                </label>
                <select
                  name="instructor_id"
                  value={formData.instructor_id}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Select an instructor</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.first_name} {inst.last_name} ({inst.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_published"
                  checked={formData.is_published || false}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-brand-lighter peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
              <div>
                <span className="text-sm font-medium text-slate-300">Publish Course</span>
                <p className={helpClass}>
                  {formData.is_published
                    ? "Course is visible to students"
                    : "Course will be saved as draft (invisible to students)"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== PAYMENT & ENROLLMENT TAB ===== */}
        {activeTab === "payment" && (
          <div className="space-y-6">
            {/* Enrollment Type */}
            <div>
              <label className={labelClass}>Enrollment Type</label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {(["free", "paid", "scholarship"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set("enrollment_type", type)}
                    className={`px-4 py-3 rounded-lg border-2 text-sm font-medium capitalize transition-all ${
                      formData.enrollment_type === type
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-brand-lighter bg-brand-light text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {type === "free" && "🆓 "}
                    {type === "paid" && "💰 "}
                    {type === "scholarship" && "🎓 "}
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Price & Currency (visible when paid) */}
            {formData.enrollment_type === "paid" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Price <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price ?? ""}
                      onChange={handleChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Currency</label>
                    <select name="currency" value={formData.currency || "USD"} onChange={handleChange} className={inputClass}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Payment Mode */}
                <div>
                  <label className={labelClass}>Payment Mode</label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => set("payment_mode", "full")}
                      className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.payment_mode === "full"
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-brand-lighter bg-brand-light text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      Full Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => set("payment_mode", "partial")}
                      className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.payment_mode === "partial"
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-brand-lighter bg-brand-light text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      Partial Payment
                    </button>
                  </div>
                </div>

                {/* Partial Payment Details */}
                {formData.payment_mode === "partial" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-brand-light rounded-lg p-4 border border-brand-lighter">
                    <div>
                      <label className={labelClass}>Partial Amount (fixed)</label>
                      <input
                        type="number"
                        name="partial_payment_amount"
                        value={formData.partial_payment_amount ?? ""}
                        onChange={handleChange}
                        placeholder="e.g., 50"
                        min="0"
                        step="0.01"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Or Percentage (%)</label>
                      <input
                        type="number"
                        name="partial_payment_percentage"
                        value={formData.partial_payment_percentage ?? ""}
                        onChange={handleChange}
                        placeholder="e.g., 50"
                        min="0"
                        max="100"
                        step="0.1"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                {/* Payment Methods */}
                <div>
                  <label className={labelClass}>Payment Methods</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1">
                    {[
                      { field: "kpay_enabled" as const, label: "K-Pay (MTN/Airtel)" },
                      { field: "paypal_enabled" as const, label: "PayPal" },
                      { field: "mobile_money_enabled" as const, label: "Mobile Money" },
                      { field: "bank_transfer_enabled" as const, label: "Bank Transfer" },
                      { field: "flutterwave_enabled" as const, label: "Flutterwave" },
                    ].map(({ field, label }) => (
                      <label
                        key={field}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                          formData[field]
                            ? "border-accent/40 bg-accent/5"
                            : "border-brand-lighter bg-brand-light hover:border-slate-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name={field}
                          checked={!!formData[field]}
                          onChange={handleChange}
                          className="rounded border-slate-500 text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-slate-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Bank Transfer Details */}
                {formData.bank_transfer_enabled && (
                  <div>
                    <label className={labelClass}>Bank Transfer Details</label>
                    <textarea
                      name="bank_transfer_details"
                      value={formData.bank_transfer_details || ""}
                      onChange={handleChange}
                      placeholder="Bank name, account number, routing info..."
                      rows={3}
                      className={inputClass}
                    />
                  </div>
                )}

                {/* Installments */}
                <div className="border-t border-brand-light pt-5">
                  <div className="flex items-center gap-3 mb-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="installment_enabled"
                        checked={formData.installment_enabled || false}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-brand-lighter peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                    <span className="text-sm font-medium text-slate-300">Allow Installment Payments</span>
                  </div>

                  {formData.installment_enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-brand-light rounded-lg p-4 border border-brand-lighter">
                      <div>
                        <label className={labelClass}>Number of Installments</label>
                        <input
                          type="number"
                          name="installment_count"
                          value={formData.installment_count ?? ""}
                          onChange={handleChange}
                          placeholder="e.g., 3"
                          min="2"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Interval (days)</label>
                        <input
                          type="number"
                          name="installment_interval_days"
                          value={formData.installment_interval_days ?? ""}
                          onChange={handleChange}
                          placeholder="e.g., 30"
                          min="1"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Other payment settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-brand-light pt-5">
                  <div>
                    <label className={labelClass}>Payment Deadline (days before cohort start)</label>
                    <input
                      type="number"
                      name="payment_deadline_days"
                      value={formData.payment_deadline_days ?? ""}
                      onChange={handleChange}
                      placeholder="e.g., 7"
                      min="0"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="require_payment_before_application"
                        checked={formData.require_payment_before_application || false}
                        onChange={handleChange}
                        className="rounded border-slate-500 text-accent focus:ring-accent"
                      />
                      <span className="text-sm text-slate-300">Require payment before application</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== SCHEDULE & COHORT TAB ===== */}
        {activeTab === "schedule" && (
          <div className="space-y-6">
            <div>
              <label className={labelClass}>Cohort Label</label>
              <input
                type="text"
                name="cohort_label"
                value={formData.cohort_label || ""}
                onChange={handleChange}
                placeholder="e.g., January 2026 Cohort, Batch 3"
                className={inputClass}
              />
              <p className={helpClass}>Optional label to identify this cohort</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Application Opens</label>
                <input
                  type="datetime-local"
                  name="application_start_date"
                  value={formData.application_start_date || ""}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Application Closes</label>
                <input
                  type="datetime-local"
                  name="application_end_date"
                  value={formData.application_end_date || ""}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Cohort Start Date</label>
                <input
                  type="datetime-local"
                  name="cohort_start_date"
                  value={formData.cohort_start_date || ""}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Cohort End Date</label>
                <input
                  type="datetime-local"
                  name="cohort_end_date"
                  value={formData.cohort_end_date || ""}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Application Timezone</label>
              <select
                name="application_timezone"
                value={formData.application_timezone || "UTC"}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="UTC">UTC</option>
                <option value="Africa/Kigali">Africa/Kigali (CAT)</option>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                <option value="America/New_York">America/New York (EST)</option>
                <option value="America/Chicago">America/Chicago (CST)</option>
                <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Europe/Paris">Europe/Paris (CET)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              </select>
            </div>

            {/* Date summary card */}
            {(formData.application_start_date || formData.cohort_start_date) && (
              <div className="bg-brand/5 border border-accent/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-brand mb-2">Schedule Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-brand-lighter">
                  {formData.application_start_date && (
                    <div>
                      <span className="text-muted-foreground">Applications open:</span>{" "}
                      {new Date(formData.application_start_date).toLocaleDateString()}
                    </div>
                  )}
                  {formData.application_end_date && (
                    <div>
                      <span className="text-muted-foreground">Applications close:</span>{" "}
                      {new Date(formData.application_end_date).toLocaleDateString()}
                    </div>
                  )}
                  {formData.cohort_start_date && (
                    <div>
                      <span className="text-muted-foreground">Cohort starts:</span>{" "}
                      {new Date(formData.cohort_start_date).toLocaleDateString()}
                    </div>
                  )}
                  {formData.cohort_end_date && (
                    <div>
                      <span className="text-muted-foreground">Cohort ends:</span>{" "}
                      {new Date(formData.cohort_end_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== MODULE RELEASE (ADVANCED) TAB ===== */}
        {activeTab === "advanced" && (
          <div className="space-y-6">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm text-amber-400">
              <strong>Module Release Settings</strong> — Control when modules become available to students.
              Leave empty to release all modules immediately.
            </div>

            <div>
              <label className={labelClass}>Course Start Date (for module release)</label>
              <input
                type="datetime-local"
                name="start_date"
                value={formData.start_date || ""}
                onChange={handleChange}
                className={inputClass}
              />
              <p className={helpClass}>The reference date for calculating module releases</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Initial Modules Released</label>
                <input
                  type="number"
                  name="module_release_count"
                  value={formData.module_release_count ?? ""}
                  onChange={handleChange}
                  placeholder="Leave empty for all"
                  min="0"
                  className={inputClass}
                />
                <p className={helpClass}>Number of modules available on day one</p>
              </div>
              <div>
                <label className={labelClass}>Release Interval (days)</label>
                <input
                  type="number"
                  name="module_release_interval_days"
                  value={formData.module_release_interval_days ?? ""}
                  onChange={handleChange}
                  placeholder="e.g., 7 for weekly"
                  min="1"
                  className={inputClass}
                />
                <p className={helpClass}>Days between each additional module release</p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Release Pattern</label>
              <select
                name="module_release_interval"
                value={formData.module_release_interval || ""}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Manual / Custom Days</option>
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
        <button
          type="button"
          onClick={onCancel || (() => router.back())}
          disabled={saving}
          className="px-6 py-2.5 bg-brand-light border border-brand-lighter text-slate-300 font-medium rounded-lg hover:bg-brand-lighter transition-colors disabled:opacity-50 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-2.5 bg-brand hover:bg-brand-light disabled:bg-brand/60 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Saving...
            </>
          ) : isEditMode ? (
            "Update Course"
          ) : (
            "Create Course"
          )}
        </button>
      </div>
    </form>
  );
};

export default CourseForm;
