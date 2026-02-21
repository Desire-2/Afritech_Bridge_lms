"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Star, 
  Clock, 
  Users, 
  BookOpen, 
  DollarSign,
  Award,
  Heart,
  Eye,
  ChevronDown,
  SlidersHorizontal,
  Grid3X3,
  List,
  TrendingUp,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { StudentApiService, Course } from '@/services/studentApi';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5
    }
  }
};

interface CourseCardProps {
  course: Course;
  viewMode: 'grid' | 'list';
  onEnrollClick: (course: Course) => void;
  enrollingCourseId: number | null;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, viewMode, onEnrollClick, enrollingCourseId }) => {
  const [isFavorited, setIsFavorited] = useState(false);
  
  const getPriceDisplay = () => {
    const currency = course.currency || 'USD';
    if (course.enrollment_type === 'free') {
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">✨ Free</Badge>;
    } else if (course.enrollment_type === 'scholarship') {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">🎓 Scholarship</Badge>;
    } else if (course.enrollment_type === 'paid' && course.payment_mode === 'partial') {
      // Partial scholarship: applicant pays their portion, rest is covered
      const ps = course.payment_summary;
      const amountDue = ps?.amount_due_now ?? course.partial_payment_amount
        ?? (course.partial_payment_percentage != null && course.price
          ? Math.round(course.price * course.partial_payment_percentage / 100 * 100) / 100
          : course.price);
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">🎓 Partial Scholarship</Badge>
          {amountDue != null && (
            <span className="text-xs text-indigo-600 font-medium">
              Your contribution: {currency} {Number(amountDue).toLocaleString()}
            </span>
          )}
        </div>
      );
    } else {
      const fullPrice = course.payment_summary?.amount_due_now ?? course.price;
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">💳 Full Tuition</Badge>
          {fullPrice != null && (
            <span className="text-xs text-blue-600 font-medium">
              {currency} {Number(fullPrice).toLocaleString()}
            </span>
          )}
        </div>
      );
    }
  };

  const getEnrollmentButton = () => {
    if (course.is_enrolled) {
      return (
        <Link href={`/learn/${course.id}`}>
          <Button className="w-full">Continue Learning</Button>
        </Link>
      );
    } else if (course.has_applied) {
      return <Button disabled className="w-full">Application Pending</Button>;
    } else if (course.enrollment_type === 'scholarship') {
      return (
        <Link href={`/student/enrollment/apply/${course.id}`}>
          <Button className="w-full">Apply for Scholarship</Button>
        </Link>
      );
    } else {
      return (
        <Button 
          type="button"
          className="w-full" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Enroll button clicked for course:', course.id);
            onEnrollClick(course);
          }}
          disabled={enrollingCourseId === course.id}
        >
          {enrollingCourseId === course.id ? 'Enrolling...' :
           course.enrollment_type === 'free' ? 'Enroll Free' :
           course.enrollment_type === 'scholarship' ? 'Apply for Scholarship' :
           course.payment_mode === 'partial' ? (() => {
             const ps = course.payment_summary;
             const cur = course.currency || 'USD';
             const due = ps?.amount_due_now ?? course.partial_payment_amount ?? course.price;
             return due != null ? `Apply & Pay ${cur} ${Number(due).toLocaleString()}` : 'Apply & Pay';
           })() :
           (() => {
             const cur = course.currency || 'USD';
             const p = course.payment_summary?.amount_due_now ?? course.price;
             return p != null ? `Enroll for ${cur} ${Number(p).toLocaleString()}` : 'Enroll Now';
           })()}
        </Button>
      );
    }
  };

  if (viewMode === 'list') {
    return (
      <motion.div variants={itemVariants}>
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex space-x-6">
              <div className="relative w-32 h-24 flex-shrink-0">
                <Image
                  src={course.thumbnail_url || '/api/placeholder/128/96'}
                  alt={course.title}
                  fill
                  className="object-cover rounded-lg"
                />
                <button
                  onClick={() => setIsFavorited(!isFavorited)}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:scale-110 transition-transform"
                >
                  <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                </button>
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold line-clamp-2">{course.title}</h3>
                  {getPriceDisplay()}
                </div>
                
                <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{course.description}</p>
                
                <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {course.instructor_name}
                  </div>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-400" />
                    {course.rating || 4.2}
                  </div>
                  <div className="flex items-center">
                    <Eye className="h-4 w-4 mr-1" />
                    {course.student_count || 25} students
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {course.estimated_duration || course.duration_weeks || 'Self-paced'}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {(course.skills || []).slice(0, 3).map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {(course.skills || []).length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{(course.skills || []).length - 3} more
                    </Badge>
                  )}
                </div>
                
                {getEnrollmentButton()}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants}>
      <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden">
        <div className="relative">
          <div className="aspect-video relative overflow-hidden">
            <Image
              src={course.thumbnail_url || '/api/placeholder/400/225'}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <button
              onClick={() => setIsFavorited(!isFavorited)}
              className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-lg hover:scale-110 transition-transform"
            >
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
            </button>
            <div className="absolute bottom-3 left-3">
              {getPriceDisplay()}
            </div>
          </div>
        </div>
        
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                {course.title}
              </h3>
              <p className="text-muted-foreground text-sm line-clamp-3">{course.description}</p>
            </div>
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {course.instructor_name}
              </div>
              <div className="flex items-center">
                <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-400" />
                {course.rating}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                {course.student_count} students
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {course.estimated_duration || course.duration_weeks || 'Self-paced'}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {(course.skills || []).slice(0, 3).map((skill, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {(course.skills || []).length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{(course.skills || []).length - 3} more
                </Badge>
              )}
            </div>
            
            {getEnrollmentButton()}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface FilterSidebarProps {
  filters: any;
  setFilters: (filters: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ filters, setFilters, isOpen, onClose }) => {
  const categories = ['Programming', 'Web Development', 'Data Science', 'Design', 'Business', 'Marketing'];
  const levels = ['Beginner', 'Intermediate', 'Advanced'];
  const durations = ['1-4 weeks', '5-8 weeks', '9-12 weeks', '12+ weeks'];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed left-0 top-0 h-full w-80 bg-background border-r z-50 p-6 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Filters</h2>
            <Button variant="ghost" onClick={onClose}>✕</Button>
          </div>
          
          <div className="space-y-6">
            {/* Enrollment Type */}
            <div>
              <h3 className="font-medium mb-3">Enrollment Type</h3>
              <div className="space-y-2">
                {['free', 'paid', 'scholarship'].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.enrollment_types?.includes(type)}
                      onCheckedChange={(checked) => {
                        const types = filters.enrollment_types || [];
                        if (checked) {
                          setFilters({ ...filters, enrollment_types: [...types, type] });
                        } else {
                          setFilters({ ...filters, enrollment_types: types.filter((t: string) => t !== type) });
                        }
                      }}
                    />
                    <label className="capitalize">{type}</label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Categories */}
            <div>
              <h3 className="font-medium mb-3">Categories</h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.categories?.includes(category)}
                      onCheckedChange={(checked) => {
                        const cats = filters.categories || [];
                        if (checked) {
                          setFilters({ ...filters, categories: [...cats, category] });
                        } else {
                          setFilters({ ...filters, categories: cats.filter((c: string) => c !== category) });
                        }
                      }}
                    />
                    <label>{category}</label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Level */}
            <div>
              <h3 className="font-medium mb-3">Level</h3>
              <div className="space-y-2">
                {levels.map((level) => (
                  <div key={level} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.levels?.includes(level)}
                      onCheckedChange={(checked) => {
                        const lvls = filters.levels || [];
                        if (checked) {
                          setFilters({ ...filters, levels: [...lvls, level] });
                        } else {
                          setFilters({ ...filters, levels: lvls.filter((l: string) => l !== level) });
                        }
                      }}
                    />
                    <label>{level}</label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Duration */}
            <div>
              <h3 className="font-medium mb-3">Duration</h3>
              <div className="space-y-2">
                {durations.map((duration) => (
                  <div key={duration} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.durations?.includes(duration)}
                      onCheckedChange={(checked) => {
                        const durs = filters.durations || [];
                        if (checked) {
                          setFilters({ ...filters, durations: [...durs, duration] });
                        } else {
                          setFilters({ ...filters, durations: durs.filter((d: string) => d !== duration) });
                        }
                      }}
                    />
                    <label>{duration}</label>
                  </div>
                ))}
              </div>
            </div>
            
            <Button 
              onClick={() => setFilters({})} 
              variant="outline" 
              className="w-full"
            >
              Clear All Filters
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const CourseBrowser: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<any>({});
  const [showFilters, setShowFilters] = useState(false);
  const [enrollingCourseId, setEnrollingCourseId] = useState<number | null>(null);
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');
  const [payerName, setPayerName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        console.log('Fetching courses...');
        const data = await StudentApiService.getBrowseCourses({
          search: searchTerm,
          sort: sortBy,
          ...filters
        });
        console.log('Raw API data:', data);
        
        // Add default rating and student_count for courses that don't have them
        const coursesWithDefaults = Array.isArray(data) ? data.map(course => {
          // Generate diverse skills based on course
          const skillOptions = ['Programming', 'Web Development', 'JavaScript', 'Python', 'React', 'Node.js', 'Database', 'UI/UX', 'API Design', 'Testing'];
          const defaultSkills = skillOptions.slice(course.id % 3, (course.id % 3) + 3);
          
          return {
            ...course,
            rating: course.rating || 4.2, // Default rating
            student_count: course.student_count || Math.floor(Math.random() * 100) + 10, // Default student count
            thumbnail_url: course.thumbnail_url || '/api/placeholder/128/96',
            is_enrolled: course.enrollment_status === 'enrolled', // Map enrollment_status to is_enrolled
            has_applied: course.enrollment_status === 'pending' || course.enrollment_status === 'applied',
            skills: course.skills || defaultSkills // Dynamic default skills
          };
        }) : [];
        
        console.log('Processed courses:', coursesWithDefaults);
        setCourses(coursesWithDefaults);
      } catch (error) {
        console.error('Failed to fetch courses:', error);
        console.error('Error details:', error.message, error.stack);
        setCourses([]); // Ensure courses is always an array
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchCourses, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, sortBy, filters]);

  const handleEnrollClick = (course: Course) => {
    console.log('handleEnrollClick called with course:', course);
    setSelectedCourse(course);
    setShowEnrollmentDialog(true);
    console.log('Dialog should now be open');
  };

  const handleEnrollConfirm = async () => {
    if (!selectedCourse) return;

    if (selectedCourse.enrollment_type !== 'free' && (!selectedCourse.price || selectedCourse.price <= 0)) {
      toast({
        title: "Invalid Course Price",
        description: "This course does not have a valid price set. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    if (selectedCourse.enrollment_type !== 'free' && !mobileMoneyNumber.trim()) {
      toast({
        title: "Mobile Money Required",
        description: "Please enter your mobile money number to proceed.",
        variant: "destructive",
      });
      return;
    }

    setEnrollingCourseId(selectedCourse.id);
    setShowEnrollmentDialog(false);

    try {
      if (selectedCourse.enrollment_type === 'free') {
        const enrollmentData = await StudentApiService.enrollCourse(selectedCourse.id);
        console.log('Enrollment successful:', enrollmentData);

        toast({
          title: "Enrollment Successful",
          description: `You have successfully enrolled in ${selectedCourse.title}`,
          variant: "default",
        });
      } else {
        const applicationResponse = await StudentApiService.applyCourse(selectedCourse.id, {
          type: 'paid'
        });

        const applicationId = applicationResponse?.data?.id || applicationResponse?.data?.application_id || applicationResponse?.data?.applicationId;
        if (!applicationId) {
          throw new Error('Payment application could not be created');
        }

        const paymentResponse = await StudentApiService.processPayment(applicationId, {
          payment_method: 'mobile_money',
          amount: selectedCourse.price || 0,
          currency: selectedCourse.currency || 'USD',
          phone_number: mobileMoneyNumber,
          payer_name: payerName
        });

        if (!paymentResponse?.success) {
          throw new Error(paymentResponse?.error || 'Payment failed');
        }

        toast({
          title: "Payment Initiated",
          description: "A mobile money prompt has been sent. Complete the payment to enroll.",
          variant: "default",
        });
      }

      // Refresh the courses list to update enrollment status
      const refreshData = await StudentApiService.getBrowseCourses({
        search: searchTerm,
        sort: sortBy,
        ...filters
      });
      console.log('Refresh data:', refreshData);
      console.log('Refresh data type:', typeof refreshData, 'Is array:', Array.isArray(refreshData));
      const refreshedCourses = (refreshData || []).map(course => ({
        ...course,
        thumbnail_url: course.thumbnail_url || '/placeholder-course.png',
        instructor_name: course.instructor_name || 'TBD',
        estimated_duration: course.estimated_duration || 'Self-paced',
        difficulty_level: course.difficulty_level || 'Beginner',
        rating: course.rating || 0,
        student_count: course.student_count || 0,
        price: course.price || 0,
        category: course.category || 'General',
        // Map enrollment status to boolean fields
        is_enrolled: course.enrollment_status === 'enrolled',
        has_applied: course.enrollment_status === 'pending' || course.enrollment_status === 'approved' || course.enrollment_status === 'rejected'
      }));
      console.log('Setting refreshed courses:', refreshedCourses);
      setCourses(refreshedCourses);
    } catch (error) {
      console.error('Enrollment error:', error);
      toast({
        title: "Enrollment Failed",
        description: error?.message || "There was an error enrolling in this course. Please try again.",
        variant: "destructive",
      });
    } finally {
      setEnrollingCourseId(null);
      setSelectedCourse(null);
      setMobileMoneyNumber('');
      setPayerName('');
    }
  };

  const handleEnrollCancel = () => {
    setShowEnrollmentDialog(false);
    setSelectedCourse(null);
    setMobileMoneyNumber('');
    setPayerName('');
  };

  const featuredCourses = (courses || []).filter(course => (course.rating || 0) >= 4.5).slice(0, 3);

  return (
    <motion.div 
      className="space-y-8 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            Discover Your Next 
            <span className="text-primary"> Learning Adventure</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore our curated collection of courses designed to accelerate your career and expand your horizons
          </p>
        </div>
      </motion.div>

      {/* Featured Courses */}
      {featuredCourses.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Featured Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featuredCourses.map((course) => (
                  <div key={course.id} className="bg-background rounded-lg p-4 border">
                    <h4 className="font-semibold mb-2">{course.title}</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                        <span className="text-sm">{course.rating}</span>
                      </div>
                      <Badge variant="secondary">Featured</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search and Filters */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses, instructors, or skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(true)}
              className="flex items-center"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
            </Button>
            
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Active Filters */}
        {Object.keys(filters).some(key => filters[key]?.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, values]: [string, any]) => 
              values?.map((value: string) => (
                <Badge key={`${key}-${value}`} variant="secondary" className="flex items-center">
                  {value}
                  <button
                    onClick={() => {
                      const newValues = values.filter((v: string) => v !== value);
                      setFilters({ ...filters, [key]: newValues });
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    ✕
                  </button>
                </Badge>
              ))
            )}
          </div>
        )}
      </motion.div>

      {/* Results */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-6">
          <p className="text-muted-foreground">
            {loading ? 'Loading...' : `${courses.length} courses found`}
          </p>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-video bg-muted rounded-t-lg" />
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            className={`grid gap-6 ${
              viewMode === 'grid' 
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                : 'grid-cols-1'
            }`}
          >
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                viewMode={viewMode}
                onEnrollClick={handleEnrollClick}
                enrollingCourseId={enrollingCourseId}
              />
            ))}
          </motion.div>
        )}
        
        {!loading && courses.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No courses found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms or filters
            </p>
          </div>
        )}
      </motion.div>

      {/* Filter Sidebar */}
      <FilterSidebar
        filters={filters}
        setFilters={setFilters}
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
      />
      
      {/* Overlay */}
      {showFilters && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowFilters(false)}
        />
      )}

      {/* Enrollment Confirmation Dialog */}
      {showEnrollmentDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h2 className="text-lg font-semibold mb-2">Confirm Enrollment</h2>
            <p className="text-gray-600 mb-4">Please review the course details and confirm your enrollment.</p>
            
            {selectedCourse && (
              <>
                <div className="flex items-center space-x-4 mb-4">
                  <Image
                    src={selectedCourse.thumbnail_url || '/placeholder-course.png'}
                    alt={selectedCourse.title}
                    width={80}
                    height={60}
                    className="object-cover rounded-lg"
                    onError={(e) => {
                      console.warn('Failed to load course image:', selectedCourse.thumbnail_url);
                      e.currentTarget.src = '/placeholder-course.png';
                    }}
                  />
                  <div>
                    <h3 className="font-semibold text-sm">{selectedCourse.title}</h3>
                    <p className="text-gray-600 text-xs">{selectedCourse.instructor_name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {selectedCourse.enrollment_type === 'free' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Free</Badge>
                      ) : (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                          ${selectedCourse.price}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-700 mb-4">
                  {selectedCourse.enrollment_type === 'free' 
                    ? 'You are about to enroll in this free course. You will get immediate access to all course materials.'
                    : `You are about to enroll in this course for $${selectedCourse.price}. Payment will be processed after confirmation.`
                  }
                </div>
                {selectedCourse.enrollment_type !== 'free' && (
                  <div className="space-y-3 mb-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700" htmlFor="payer-name">
                        Full Name (optional)
                      </label>
                      <Input
                        id="payer-name"
                        placeholder="Enter your name"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700" htmlFor="mobile-money-number">
                        Mobile Money Number
                      </label>
                      <Input
                        id="mobile-money-number"
                        placeholder="e.g. +256700000000"
                        value={mobileMoneyNumber}
                        onChange={(e) => setMobileMoneyNumber(e.target.value)}
                      />
                      <p className="text-xs text-gray-500">We will send a payment prompt to this number.</p>
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={handleEnrollCancel} 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEnrollConfirm} 
                className="flex-1"
                disabled={!selectedCourse}
              >
                {selectedCourse?.enrollment_type === 'free' ? 'Enroll Now' : 'Pay with Mobile Money'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CourseBrowser;