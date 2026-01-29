import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Award, Users, BookOpen, CheckCircle, AlertTriangle, Search, X } from 'lucide-react';
import InstructorService from '@/services/instructor.service';
import { Course } from '@/types/api';

interface FullCreditManagerProps {
  courses: Course[];
  onCreditAwarded?: () => void;
}

interface Student {
  id: number;
  name: string;
  email: string;
  enrollment_date: string;
  progress: number;
}

interface Module {
  id: number;
  title: string;
  lessons_count: number;
  quizzes_count: number;
  assignments_count: number;
}

interface ModuleComponents {
  module_title: string;
  lessons_count: number;
  quizzes_count: number;
  assignments_count: number;
  total_components: number;
}

const FullCreditManager: React.FC<FullCreditManagerProps> = ({ courses, onCreditAwarded }) => {
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [moduleComponents, setModuleComponents] = useState<ModuleComponents | null>(null);
  const [loading, setLoading] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);

  // Load students when course is selected
  useEffect(() => {
    if (selectedCourse) {
      loadStudents(parseInt(selectedCourse));
      loadModules(parseInt(selectedCourse));
    } else {
      setStudents([]);
      setModules([]);
    }
    setSelectedStudent('');
    setSelectedModule('');
    setModuleComponents(null);
    setStudentSearch(''); // Clear search when course changes
  }, [selectedCourse]);

  // Load module components when module is selected
  useEffect(() => {
    if (selectedModule) {
      loadModuleComponents(parseInt(selectedModule));
    } else {
      setModuleComponents(null);
    }
  }, [selectedModule]);

  // Filter students based on search term
  useEffect(() => {
    if (!studentSearch.trim()) {
      setFilteredStudents(students);
    } else {
      const searchTerm = studentSearch.toLowerCase();
      const filtered = students.filter(student => 
        student.name.toLowerCase().includes(searchTerm) ||
        student.email.toLowerCase().includes(searchTerm)
      );
      setFilteredStudents(filtered);
    }
  }, [students, studentSearch]);

  // Reset search when course changes
  useEffect(() => {
    setStudentSearch('');
  }, [selectedCourse]);

  const loadStudents = async (courseId: number) => {
    try {
      setLoading(true);
      const courseStudents = await InstructorService.getCourseStudents(courseId);
      setStudents(courseStudents);
    } catch (error) {
      console.error('Failed to load students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async (courseId: number) => {
    try {
      const courseModules = await InstructorService.getCourseModules(courseId);
      setModules(courseModules);
    } catch (error) {
      console.error('Failed to load modules:', error);
      toast.error('Failed to load modules');
    }
  };

  const loadModuleComponents = async (moduleId: number) => {
    try {
      const components = await InstructorService.getModuleComponents(moduleId);
      setModuleComponents(components);
    } catch (error) {
      console.error('Failed to load module components:', error);
      toast.error('Failed to load module components');
    }
  };

  const handleFullCreditAward = async () => {
    if (!selectedStudent || !selectedModule) {
      toast.error('Please select both a student and a module');
      return;
    }

    try {
      setAwarding(true);
      const result = await InstructorService.giveStudentFullCredit(
        parseInt(selectedStudent), 
        parseInt(selectedModule)
      );

      if (result.success) {
        toast.success(
          `Full credit awarded! Updated ${result.details.lessons_updated} lessons, ` +
          `${result.details.quizzes_updated} quizzes, and ${result.details.assignments_updated} assignments.`
        );
        onCreditAwarded?.();
        // Reset selections
        setSelectedStudent('');
        setSelectedModule('');
        setModuleComponents(null);
        setStudentSearch(''); // Clear search after awarding credit
      } else {
        toast.error(result.message || 'Failed to award full credit');
      }
    } catch (error: any) {
      console.error('Failed to award full credit:', error);
      toast.error(error.message || 'Failed to award full credit');
    } finally {
      setAwarding(false);
    }
  };

  const selectedCourseData = courses.find(c => c.id === parseInt(selectedCourse));
  const selectedStudentData = students.find(s => s.id === parseInt(selectedStudent));
  const selectedModuleData = modules.find(m => m.id === parseInt(selectedModule));

  const canAwardCredit = selectedCourse && selectedStudent && selectedModule && moduleComponents;

  const clearAllSelections = () => {
    setSelectedCourse('');
    setSelectedStudent('');
    setSelectedModule('');
    setModuleComponents(null);
    setStudentSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Header with Clear All */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Award Full Credit</h3>
          <p className="text-sm text-gray-600">Give students full credit for completed modules</p>
        </div>
        {(selectedCourse || selectedStudent || selectedModule || studentSearch) && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearAllSelections}
            className="flex items-center space-x-1"
          >
            <X className="h-4 w-4" />
            <span>Clear All</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Course Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Course</label>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Student Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Student</label>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search students by name or email..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              onKeyDown={(e) => {
                // Quick select first result with Enter
                if (e.key === 'Enter' && filteredStudents.length === 1) {
                  setSelectedStudent(filteredStudents[0].id.toString());
                  setStudentSearch('');
                }
                // Clear search with Escape
                if (e.key === 'Escape') {
                  setStudentSearch('');
                }
              }}
              className="pl-10 pr-10"
              disabled={!selectedCourse || loading}
            />
            {studentSearch && (
              <button
                onClick={() => setStudentSearch('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <Select 
            value={selectedStudent} 
            onValueChange={setSelectedStudent}
            disabled={!selectedCourse || loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                loading ? "Loading students..." : 
                filteredStudents.length === 0 && students.length > 0 ? "No students found" :
                "Choose a student"
              } />
            </SelectTrigger>
            <SelectContent>
              {filteredStudents.length === 0 && studentSearch && students.length > 0 ? (
                <div className="px-2 py-3 text-sm text-gray-500 text-center">
                  No students found for "{studentSearch}"
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <SelectItem key={student.id} value={student.id.toString()}>
                    <div className="flex flex-col">
                      <span className="font-medium">{student.name}</span>
                      <span className="text-xs text-gray-500">{student.email}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          {/* Search Results Info */}
          {studentSearch && (
            <div className="text-xs text-gray-500">
              {filteredStudents.length === 0 ? 
                'No students found' : 
                `Showing ${filteredStudents.length} of ${students.length} students`
              }
            </div>
          )}
          
          {/* Quick Actions for Multiple Students */}
          {filteredStudents.length > 0 && filteredStudents.length < students.length && (
            <div className="flex flex-wrap gap-1">
              {filteredStudents.slice(0, 3).map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student.id.toString())}
                  className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded border text-left"
                  disabled={selectedStudent === student.id.toString()}
                >
                  {student.name.split(' ')[0]} {/* First name only for quick access */}
                </button>
              ))}
              {filteredStudents.length > 3 && (
                <span className="text-xs text-gray-400 px-2 py-1">
                  +{filteredStudents.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Module Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Module</label>
          <Select 
            value={selectedModule} 
            onValueChange={setSelectedModule}
            disabled={!selectedCourse}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a module" />
            </SelectTrigger>
            <SelectContent>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id.toString()}>
                  {module.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selection Summary */}
      {canAwardCredit && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold">Ready to Award Full Credit</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">Course</p>
                  <p className="font-semibold">{selectedCourseData?.title}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">Student</p>
                  <p className="font-semibold">{selectedStudentData?.name}</p>
                  <p className="text-xs text-slate-500">{selectedStudentData?.email}</p>
                  {studentSearch && (
                    <p className="text-xs text-green-600">✓ Found via search</p>
                  )}
                </div>
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">Module</p>
                  <p className="font-semibold">{moduleComponents?.module_title}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2 flex items-center space-x-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Components to be awarded full credit:</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {moduleComponents && moduleComponents.lessons_count > 0 && (
                    <Badge variant="outline">
                      {moduleComponents.lessons_count} Lesson{moduleComponents.lessons_count !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {moduleComponents && moduleComponents.quizzes_count > 0 && (
                    <Badge variant="outline">
                      {moduleComponents.quizzes_count} Quiz{moduleComponents.quizzes_count !== 1 ? 'zes' : ''}
                    </Badge>
                  )}
                  {moduleComponents && moduleComponents.assignments_count > 0 && (
                    <Badge variant="outline">
                      {moduleComponents.assignments_count} Assignment{moduleComponents.assignments_count !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Total: {moduleComponents?.total_components} component{moduleComponents?.total_components !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">Important Notice</p>
                    <p className="text-yellow-700 dark:text-yellow-300">
                      This will award the student 100% completion and full scores for ALL components in this module. 
                      This action cannot be easily undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={awarding}
                    >
                      <Award className="h-4 w-4 mr-2" />
                      Award Full Credit
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Full Credit Award</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to award full credit to <strong>{selectedStudentData?.name}</strong> for 
                        the module <strong>{moduleComponents?.module_title}</strong>?
                        <br /><br />
                        This will:
                        <ul className="list-disc pl-5 mt-2">
                          <li>Mark all {moduleComponents?.lessons_count} lesson(s) as completed with 100% progress</li>
                          <li>Set all {moduleComponents?.quizzes_count} quiz(zes) to 100% score</li>
                          <li>Grade all {moduleComponents?.assignments_count} assignment(s) with full points</li>
                        </ul>
                        <br />
                        This action is difficult to undo. Please confirm you want to proceed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleFullCreditAward}
                        disabled={awarding}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {awarding ? 'Awarding...' : 'Yes, Award Full Credit'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!canAwardCredit && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Select Course, Student, and Module
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-500">
                Choose a course, then select a student and module to award full credit for all components.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FullCreditManager;