"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Course } from "@/types/api";
import { AdminService } from "@/services/admin.service";

interface CourseListTableProps {
  onSelectCourse?: (course: Course) => void;
}

type SortField = "title" | "instructor_name" | "is_published" | "enrollment_type" | "created_at";
type SortOrder = "asc" | "desc";

export const CourseListTable: React.FC<CourseListTableProps> = ({ onSelectCourse }) => {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [publishFilter, setPublishFilter] = useState<"all" | "published" | "unpublished">("all");
  const [enrollmentTypeFilter, setEnrollmentTypeFilter] = useState<"all" | "free" | "paid" | "scholarship">("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Stats
  const [stats, setStats] = useState<{
    total_courses: number;
    published_courses: number;
    draft_courses: number;
    top_courses: Array<{ id: number; title: string; enrollments: number }>;
  } | null>(null);

  // Action states
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminService.getCourses();
      setCourses(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await AdminService.getCourseStats();
      setStats(data);
    } catch {
      // Stats are non-critical — fail silently
    }
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchStats();
  }, [fetchCourses, fetchStats]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // ---- Filtering ----
  const filteredCourses = courses.filter((course) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      course.title.toLowerCase().includes(q) ||
      (course.instructor_name || "").toLowerCase().includes(q) ||
      (course.description || "").toLowerCase().includes(q);

    const matchesPublish =
      publishFilter === "all" ||
      (publishFilter === "published" && course.is_published) ||
      (publishFilter === "unpublished" && !course.is_published);

    const matchesEnrollment =
      enrollmentTypeFilter === "all" || course.enrollment_type === enrollmentTypeFilter;

    return matchesSearch && matchesPublish && matchesEnrollment;
  });

  // ---- Sorting ----
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    let aVal: any;
    let bVal: any;
    switch (sortField) {
      case "title":
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
        break;
      case "instructor_name":
        aVal = (a.instructor_name || "").toLowerCase();
        bVal = (b.instructor_name || "").toLowerCase();
        break;
      case "is_published":
        aVal = a.is_published ? 1 : 0;
        bVal = b.is_published ? 1 : 0;
        break;
      case "enrollment_type":
        aVal = a.enrollment_type || "";
        bVal = b.enrollment_type || "";
        break;
      case "created_at":
        aVal = a.created_at || "";
        bVal = b.created_at || "";
        break;
      default:
        aVal = "";
        bVal = "";
    }
    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // ---- Pagination ----
  const totalPages = Math.ceil(sortedCourses.length / itemsPerPage);
  const paginatedCourses = sortedCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, publishFilter, enrollmentTypeFilter]);

  // ---- Sort handler ----
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">&#8597;</span>;
    return <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  // ---- Actions ----
  const handleTogglePublish = async (course: Course) => {
    setTogglingIds((prev) => new Set(prev).add(course.id));
    try {
      if (course.is_published) {
        await AdminService.unpublishCourse(course.id);
      } else {
        await AdminService.publishCourse(course.id);
      }
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, is_published: !c.is_published } : c))
      );
      setSuccessMsg(`Course "${course.title}" ${course.is_published ? "unpublished" : "published"} successfully`);
      fetchStats();
    } catch (err: any) {
      setError(err.message || "Failed to toggle publish status");
    } finally {
      setTogglingIds((prev) => {
        const s = new Set(prev);
        s.delete(course.id);
        return s;
      });
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${course.title}"? This will also delete all modules, lessons, and enrollments associated with this course. This action cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(course.id);
    try {
      await AdminService.deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      setSelectedIds((prev) => {
        const s = new Set(prev);
        s.delete(course.id);
        return s;
      });
      setSuccessMsg(`Course "${course.title}" deleted successfully`);
      fetchStats();
    } catch (err: any) {
      setError(err.message || "Failed to delete course");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.size} course(s)? This cannot be undone.`
      )
    )
      return;

    setLoading(true);
    let deleted = 0;
    for (const id of selectedIds) {
      try {
        await AdminService.deleteCourse(id);
        deleted++;
      } catch {
        // continue with others
      }
    }
    setSuccessMsg(`${deleted} course(s) deleted successfully`);
    setSelectedIds(new Set());
    fetchCourses();
    fetchStats();
  };

  // ---- Selection ----
  const allOnPageSelected =
    paginatedCourses.length > 0 && paginatedCourses.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const s = new Set(prev);
        paginatedCourses.forEach((c) => s.delete(c.id));
        return s;
      });
    } else {
      setSelectedIds((prev) => {
        const s = new Set(prev);
        paginatedCourses.forEach((c) => s.add(c.id));
        return s;
      });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  // ---- Helpers ----
  const enrollmentBadge = (type?: string) => {
    switch (type) {
      case "paid":
        return "bg-amber-100 text-amber-800";
      case "scholarship":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-emerald-100 text-emerald-800";
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (course: Course) => {
    if (course.enrollment_type !== "paid" || !course.price) return "Free";
    return `${course.currency || "USD"} ${course.price.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-brand rounded-xl shadow-sm p-5">
            <p className="text-sm font-medium text-slate-300">Total Courses</p>
            <p className="text-3xl font-bold text-white mt-1">{stats.total_courses}</p>
          </div>
          <div className="bg-brand rounded-xl shadow-sm p-5">
            <p className="text-sm font-medium text-emerald-400">Published</p>
            <p className="text-3xl font-bold text-emerald-300 mt-1">{stats.published_courses}</p>
          </div>
          <div className="bg-brand rounded-xl shadow-sm p-5">
            <p className="text-sm font-medium text-amber-400">Drafts</p>
            <p className="text-3xl font-bold text-amber-300 mt-1">{stats.draft_courses}</p>
          </div>
          <div className="bg-brand rounded-xl shadow-sm p-5">
            <p className="text-sm font-medium text-sky-400">Top Course Enrollments</p>
            <p className="text-3xl font-bold text-sky-300 mt-1">
              {stats.top_courses?.[0]?.enrollments ?? 0}
            </p>
            {stats.top_courses?.[0] && (
              <p className="text-xs text-slate-400 mt-1 truncate">{stats.top_courses[0].title}</p>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-400 hover:text-green-300 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-brand rounded-xl shadow-sm border border-brand-light p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1">Search</label>
            <div className="relative">
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, instructor, or description..."
                className="w-full pl-10 pr-4 py-2 bg-brand-light border border-brand-lighter rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-sm text-white placeholder-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
            <select
              value={publishFilter}
              onChange={(e) => setPublishFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-brand-light border border-brand-lighter rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-sm text-white"
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="unpublished">Drafts</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Enrollment</label>
            <select
              value={enrollmentTypeFilter}
              onChange={(e) => setEnrollmentTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-brand-light border border-brand-lighter rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-sm text-white"
            >
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="scholarship">Scholarship</option>
            </select>
          </div>
        </div>

        {/* Results summary & bulk actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-brand-light">
          <p className="text-sm text-slate-400">
            Showing {paginatedCourses.length} of {filteredCourses.length} course
            {filteredCourses.length !== 1 ? "s" : ""}
            {searchQuery && <span className="ml-1">matching &quot;{searchQuery}&quot;</span>}
          </p>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
              >
                Delete Selected ({selectedIds.size})
              </button>
            )}
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 bg-brand-light border border-brand-lighter rounded-lg text-sm text-white"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-brand rounded-xl shadow-sm border border-brand-light overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand border-b border-brand-light">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-500 text-accent focus:ring-accent"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort("title")}
                >
                  Title <SortIcon field="title" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort("instructor_name")}
                >
                  Instructor <SortIcon field="instructor_name" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort("is_published")}
                >
                  Status <SortIcon field="is_published" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort("enrollment_type")}
                >
                  Type <SortIcon field="enrollment_type" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Cohort
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort("created_at")}
                >
                  Created <SortIcon field="created_at" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-light">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                      <span className="text-sm text-slate-400">Loading courses...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedCourses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="h-12 w-12 text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                      <p className="text-slate-300 font-medium">No courses found</p>
                      <p className="text-sm text-slate-400">
                        {searchQuery || publishFilter !== "all" || enrollmentTypeFilter !== "all"
                          ? "Try adjusting your filters"
                          : "Create your first course to get started"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCourses.map((course) => (
                  <tr
                    key={course.id}
                    className={`hover:bg-brand-light transition-colors ${
                      selectedIds.has(course.id) ? "bg-accent/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(course.id)}
                        onChange={() => toggleSelect(course.id)}
                        className="rounded border-gray-300 text-accent focus:ring-accent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[260px]">
                        <p className="text-sm font-semibold text-white truncate">{course.title}</p>
                        {course.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {course.description.slice(0, 80)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {course.instructor_name || "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleTogglePublish(course)}
                        disabled={togglingIds.has(course.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                          course.is_published
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                        } ${togglingIds.has(course.id) ? "opacity-60 cursor-wait" : ""}`}
                        title={`Click to ${course.is_published ? "unpublish" : "publish"}`}
                      >
                        {togglingIds.has(course.id) ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                        ) : (
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              course.is_published ? "bg-green-500" : "bg-yellow-500"
                            }`}
                          />
                        )}
                        {course.is_published ? "Published" : "Draft"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${enrollmentBadge(
                          course.enrollment_type
                        )}`}
                      >
                        {course.enrollment_type || "free"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{formatPrice(course)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {course.cohort_label ? (
                        <span className="inline-flex px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                          {course.cohort_label}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{formatDate(course.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/admin/courses/${course.id}/edit`)}
                          className="p-1.5 text-accent hover:bg-accent/10 rounded-lg transition-colors"
                          title="Edit course"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteCourse(course)}
                          disabled={deletingId === course.id}
                          className={`p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ${
                            deletingId === course.id ? "opacity-50 cursor-wait" : ""
                          }`}
                          title="Delete course"
                        >
                          {deletingId === course.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-brand-light bg-brand-light">
            <p className="text-sm text-slate-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-sm text-slate-300 rounded border border-brand-lighter hover:bg-brand-lighter disabled:opacity-40 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm text-slate-300 rounded border border-brand-lighter hover:bg-brand-lighter disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 text-sm rounded border ${
                      page === currentPage
                        ? "bg-accent text-white border-accent"
                        : "border-brand-lighter text-slate-300 hover:bg-brand-lighter"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm text-slate-300 rounded border border-brand-lighter hover:bg-brand-lighter disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-sm text-slate-300 rounded border border-brand-lighter hover:bg-brand-lighter disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseListTable;
