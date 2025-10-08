"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search,
  Filter,
  Clock,
  Users,
  Star,
  BookOpen,
  Trophy,
  CreditCard,
  GraduationCap,
  Heart,
  Eye,
  ChevronRight,
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Gift,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  description: string;
  instructor_name: string;
  estimated_duration: string;
  enrollment_type: 'free' | 'paid' | 'scholarship';
  price?: number;
  scholarship_slots?: number;
  scholarship_deadline?: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  skills: string[];
  rating: number;
  total_students: number;
  preview_video?: string;
  thumbnail_url?: string;
  learning_objectives: string[];
  prerequisites: string[];
  modules_count: number;
  is_featured: boolean;
  enrollment_status?: 'not_enrolled' | 'pending' | 'enrolled' | 'rejected';
}

interface CourseCardProps {
  course: Course;
  onEnroll: (course: Course) => void;
  onViewDetails: (course: Course) => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, onEnroll, onViewDetails }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);

  const getEnrollmentTypeIcon = (type: string) => {
    switch (type) {
      case 'scholarship':
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'paid':
        return <CreditCard className="h-4 w-4 text-green-500" />;
      case 'free':
        return <Gift className="h-4 w-4 text-blue-500" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getEnrollmentBadge = (course: Course) => {
    switch (course.enrollment_type) {
      case 'scholarship':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Trophy className="h-3 w-3 mr-1" />
            Scholarship Required
          </Badge>
        );
      case 'paid':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            <DollarSign className="h-3 w-3 mr-1" />
            ${course.price}
          </Badge>
        );
      case 'free':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
            <Gift className="h-3 w-3 mr-1" />
            Free
          </Badge>
        );
    }
  };

  const getEnrollmentButton = () => {
    if (course.enrollment_status === 'enrolled') {
      return (
        <Button size="sm" className="w-full" onClick={() => onViewDetails(course)}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Continue Learning
        </Button>
      );
    }

    if (course.enrollment_status === 'pending') {
      return (
        <Button size="sm" variant="outline" className="w-full" disabled>
          <AlertCircle className="h-4 w-4 mr-2" />
          Application Pending
        </Button>
      );
    }

    const buttonText = course.enrollment_type === 'scholarship' ? 'Apply' : 
                     course.enrollment_type === 'paid' ? 'Purchase' : 'Enroll Free';

    return (
      <Button size="sm" className="w-full" onClick={() => onEnroll(course)}>
        {course.enrollment_type === 'paid' && <ShoppingCart className="h-4 w-4 mr-2" />}
        {buttonText}
      </Button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full hover:shadow-lg transition-all duration-300 hover:scale-105 group">
        <div className="relative">
          {course.thumbnail_url && (
            <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
              <img 
                src={course.thumbnail_url} 
                alt={course.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
            </div>
          )}
          
          {/* Bookmark Button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-8 w-8 p-0 bg-background/80 hover:bg-background"
            onClick={() => setIsBookmarked(!isBookmarked)}
          >
            <Heart className={`h-4 w-4 ${isBookmarked ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>

          {/* Featured Badge */}
          {course.is_featured && (
            <Badge className="absolute top-2 left-2 bg-orange-500 hover:bg-orange-600">
              <Sparkles className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Course Type */}
          <div className="flex items-center justify-between">
            {getEnrollmentBadge(course)}
            <div className="flex items-center text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-yellow-500 mr-1" />
              {course.rating.toFixed(1)}
            </div>
          </div>

          {/* Title and Description */}
          <div>
            <h3 className="font-semibold text-lg line-clamp-2 mb-2">{course.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
          </div>

          {/* Instructor */}
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-1" />
            {course.instructor_name}
          </div>

          {/* Course Stats */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {course.estimated_duration}
            </div>
            <div className="flex items-center">
              <BookOpen className="h-4 w-4 mr-1" />
              {course.modules_count} modules
            </div>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-1">
            {course.skills.slice(0, 3).map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {course.skills.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{course.skills.length - 3} more
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {getEnrollmentButton()}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onViewDetails(course)}
              className="flex-shrink-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface EnrollmentDialogProps {
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
}

const EnrollmentDialog: React.FC<EnrollmentDialogProps> = ({ course, isOpen, onClose, onConfirm }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    motivation_letter: '',
    prerequisites_met: false,
    payment_method: 'card',
    terms_accepted: false
  });
  const [isLoading, setIsLoading] = useState(false);

  if (!course) return null;

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await onConfirm(formData);
      onClose();
      setStep(1);
      setFormData({
        motivation_letter: '',
        prerequisites_met: false,
        payment_method: 'card',
        terms_accepted: false
      });
    } catch (error) {
      console.error('Enrollment failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderScholarshipForm = () => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Why do you want to take this course?</label>
        <Textarea
          placeholder="Tell us about your motivation and how this course will help you achieve your goals..."
          value={formData.motivation_letter}
          onChange={(e) => setFormData({ ...formData, motivation_letter: e.target.value })}
          className="mt-2"
          rows={4}
        />
      </div>
      
      <div className="space-y-2">
        <h4 className="font-medium">Prerequisites Check</h4>
        {course.prerequisites.map((prerequisite, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`prereq-${index}`}
              className="rounded"
            />
            <label htmlFor={`prereq-${index}`} className="text-sm">
              {prerequisite}
            </label>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Scholarship Info:</strong> Applications will be reviewed within 5-7 business days. 
          You'll be notified via email about the decision.
        </p>
      </div>
    </div>
  );

  const renderPaymentForm = () => (
    <div className="space-y-4">
      <div className="bg-green-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-medium">Course Price:</span>
          <span className="text-2xl font-bold text-green-600">${course.price}</span>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Payment Method</label>
        <Select 
          value={formData.payment_method} 
          onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
        >
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="card">Credit/Debit Card</SelectItem>
            <SelectItem value="paypal">PayPal</SelectItem>
            <SelectItem value="bank">Bank Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">What's Included:</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            Lifetime access to course content
          </li>
          <li className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            Certificate of completion
          </li>
          <li className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            Direct instructor support
          </li>
          <li className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            Access to course community
          </li>
        </ul>
      </div>
    </div>
  );

  const renderFreeEnrollment = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg text-center">
        <Gift className="h-12 w-12 text-blue-500 mx-auto mb-2" />
        <h3 className="font-semibold text-blue-800">Free Course Access</h3>
        <p className="text-sm text-blue-600 mt-1">
          Get instant access to all course materials at no cost!
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">What's Included:</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            Full course content access
          </li>
          <li className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            Course completion certificate
          </li>
          <li className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            Community forum access
          </li>
          <li className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            Progress tracking
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {course.enrollment_type === 'scholarship' && <Trophy className="h-5 w-5 text-yellow-500" />}
            {course.enrollment_type === 'paid' && <CreditCard className="h-5 w-5 text-green-500" />}
            {course.enrollment_type === 'free' && <Gift className="h-5 w-5 text-blue-500" />}
            <span>
              {course.enrollment_type === 'scholarship' ? 'Apply for Scholarship' :
               course.enrollment_type === 'paid' ? 'Purchase Course' : 'Enroll in Course'}
            </span>
          </DialogTitle>
          <DialogDescription>
            {course.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {course.enrollment_type === 'scholarship' && renderScholarshipForm()}
          {course.enrollment_type === 'paid' && renderPaymentForm()}
          {course.enrollment_type === 'free' && renderFreeEnrollment()}

          {/* Terms Acceptance */}
          <div className="flex items-start space-x-2">
            <input
              type="checkbox"
              id="terms"
              checked={formData.terms_accepted}
              onChange={(e) => setFormData({ ...formData, terms_accepted: e.target.checked })}
              className="mt-1"
            />
            <label htmlFor="terms" className="text-sm text-muted-foreground">
              I agree to the{' '}
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.terms_accepted || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                course.enrollment_type === 'scholarship' ? 'Submit Application' :
                course.enrollment_type === 'paid' ? `Pay $${course.price}` : 'Enroll Now'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CourseBrowse: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const { user } = useAuth();

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        // Simulated API call
        const mockCourses: Course[] = [
          {
            id: '1',
            title: 'Full Stack Web Development with React & Node.js',
            description: 'Learn to build modern web applications from scratch using React, Node.js, and MongoDB. Perfect for beginners who want to become full-stack developers.',
            instructor_name: 'Dr. Sarah Johnson',
            estimated_duration: '12 weeks',
            enrollment_type: 'scholarship',
            scholarship_slots: 50,
            scholarship_deadline: '2024-01-15',
            difficulty_level: 'beginner',
            category: 'Web Development',
            skills: ['React', 'Node.js', 'MongoDB', 'JavaScript', 'HTML', 'CSS'],
            rating: 4.8,
            total_students: 1245,
            learning_objectives: [
              'Build responsive web applications',
              'Master React hooks and state management',
              'Create RESTful APIs with Node.js',
              'Work with databases using MongoDB'
            ],
            prerequisites: [
              'Basic understanding of HTML and CSS',
              'Familiarity with JavaScript fundamentals'
            ],
            modules_count: 8,
            is_featured: true,
            thumbnail_url: '/course-thumbnails/fullstack.jpg'
          },
          {
            id: '2',
            title: 'Data Science & Machine Learning with Python',
            description: 'Master data analysis, visualization, and machine learning using Python. Includes hands-on projects with real-world datasets.',
            instructor_name: 'Prof. Michael Chen',
            estimated_duration: '16 weeks',
            enrollment_type: 'paid',
            price: 299,
            difficulty_level: 'intermediate',
            category: 'Data Science',
            skills: ['Python', 'Pandas', 'NumPy', 'Scikit-learn', 'TensorFlow', 'Data Visualization'],
            rating: 4.9,
            total_students: 892,
            learning_objectives: [
              'Analyze and visualize complex datasets',
              'Build predictive machine learning models',
              'Master Python data science libraries',
              'Deploy ML models to production'
            ],
            prerequisites: [
              'Basic Python programming knowledge',
              'Understanding of statistics and mathematics'
            ],
            modules_count: 12,
            is_featured: true,
            thumbnail_url: '/course-thumbnails/datascience.jpg'
          },
          {
            id: '3',
            title: 'Introduction to Cloud Computing with AWS',
            description: 'Get started with cloud computing using Amazon Web Services. Learn about EC2, S3, databases, and deployment strategies.',
            instructor_name: 'James Wilson',
            estimated_duration: '8 weeks',
            enrollment_type: 'free',
            difficulty_level: 'beginner',
            category: 'Cloud Computing',
            skills: ['AWS', 'EC2', 'S3', 'RDS', 'Lambda', 'Cloud Architecture'],
            rating: 4.6,
            total_students: 2156,
            learning_objectives: [
              'Understand cloud computing fundamentals',
              'Deploy applications on AWS',
              'Manage cloud infrastructure',
              'Implement basic security practices'
            ],
            prerequisites: [
              'Basic understanding of computing concepts',
              'No prior cloud experience required'
            ],
            modules_count: 6,
            is_featured: false,
            thumbnail_url: '/course-thumbnails/aws.jpg'
          },
          {
            id: '4',
            title: 'Advanced Mobile App Development',
            description: 'Build cross-platform mobile applications using React Native and Flutter. Includes deployment to app stores.',
            instructor_name: 'Dr. Emily Rodriguez',
            estimated_duration: '14 weeks',
            enrollment_type: 'scholarship',
            scholarship_slots: 30,
            scholarship_deadline: '2024-02-01',
            difficulty_level: 'advanced',
            category: 'Mobile Development',
            skills: ['React Native', 'Flutter', 'Dart', 'Mobile UI/UX', 'App Store Deployment'],
            rating: 4.7,
            total_students: 567,
            learning_objectives: [
              'Build native mobile applications',
              'Master cross-platform development',
              'Implement complex mobile features',
              'Deploy apps to Google Play and App Store'
            ],
            prerequisites: [
              'Experience with JavaScript or Dart',
              'Understanding of mobile development concepts',
              'Prior programming experience required'
            ],
            modules_count: 10,
            is_featured: false,
            thumbnail_url: '/course-thumbnails/mobile.jpg'
          },
          {
            id: '5',
            title: 'Cybersecurity Fundamentals',
            description: 'Learn essential cybersecurity concepts, tools, and best practices to protect digital assets and systems.',
            instructor_name: 'Robert Kim',
            estimated_duration: '10 weeks',
            enrollment_type: 'paid',
            price: 199,
            difficulty_level: 'beginner',
            category: 'Cybersecurity',
            skills: ['Network Security', 'Ethical Hacking', 'Risk Assessment', 'Incident Response'],
            rating: 4.5,
            total_students: 723,
            learning_objectives: [
              'Understand cybersecurity principles',
              'Identify and mitigate security threats',
              'Implement security best practices',
              'Conduct basic penetration testing'
            ],
            prerequisites: [
              'Basic networking knowledge',
              'Understanding of computer systems'
            ],
            modules_count: 8,
            is_featured: false,
            thumbnail_url: '/course-thumbnails/cybersecurity.jpg'
          }
        ];
        
        setCourses(mockCourses);
        setFilteredCourses(mockCourses);
      } catch (error) {
        console.error('Failed to fetch courses:', error);
        toast.error('Failed to load courses');
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Filter and search logic
  useEffect(() => {
    let filtered = courses.filter((course: Course) => {
      const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           course.skills.some((skill: string) => skill.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
      const matchesType = selectedType === 'all' || course.enrollment_type === selectedType;
      const matchesDifficulty = selectedDifficulty === 'all' || course.difficulty_level === selectedDifficulty;

      return matchesSearch && matchesCategory && matchesType && matchesDifficulty;
    });

    // Sort courses
    filtered = filtered.sort((a, b) => {
      switch (sortBy) {
        case 'featured':
          return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
        case 'rating':
          return b.rating - a.rating;
        case 'students':
          return b.total_students - a.total_students;
        case 'newest':
          return new Date(b.id).getTime() - new Date(a.id).getTime();
        default:
          return 0;
      }
    });

    setFilteredCourses(filtered);
  }, [courses, searchTerm, selectedCategory, selectedType, selectedDifficulty, sortBy]);

  const handleEnroll = (course: Course) => {
    setSelectedCourse(course);
    setEnrollmentDialogOpen(true);
  };

  const handleEnrollmentConfirm = async (formData: any) => {
    if (!selectedCourse) return;

    try {
      // API call to enroll/apply
      console.log('Enrolling in course:', selectedCourse.id, formData);
      
      if (selectedCourse.enrollment_type === 'scholarship') {
        toast.success('Scholarship application submitted successfully! You will be notified within 5-7 business days.');
      } else if (selectedCourse.enrollment_type === 'paid') {
        // Payment processing logic here
        toast.success('Payment successful! Welcome to the course.');
      } else {
        toast.success('Successfully enrolled in the course!');
      }
      
      // Update course enrollment status locally
      setCourses(prev => 
        prev.map(course => 
          course.id === selectedCourse.id 
            ? { ...course, enrollment_status: selectedCourse.enrollment_type === 'scholarship' ? 'pending' : 'enrolled' }
            : course
        )
      );
    } catch (error) {
      console.error('Enrollment failed:', error);
      toast.error('Enrollment failed. Please try again.');
    }
  };

  const handleViewDetails = (course: Course) => {
    // Navigate to course details page
    window.location.href = `/student/courses/${course.id}`;
  };

  const categories = Array.from(new Set(courses.map(course => course.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Browse Courses</h1>
          <p className="text-muted-foreground">
            Discover courses that match your interests and career goals
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
            <Trophy className="h-3 w-3 mr-1" />
            {courses.filter(c => c.enrollment_type === 'scholarship').length} Scholarship Courses
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
            <Gift className="h-3 w-3 mr-1" />
            {courses.filter(c => c.enrollment_type === 'free').length} Free Courses
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses, skills, or topics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap lg:flex-nowrap space-y-2 lg:space-y-0 lg:space-x-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full lg:w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full lg:w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="scholarship">Scholarship</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                <SelectTrigger className="w-full lg:w-40">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full lg:w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="students">Most Popular</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredCourses.length} of {courses.length} courses
        </p>
        
        {searchTerm && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSearchTerm('')}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear search
          </Button>
        )}
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No courses found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filters to find more courses
            </p>
            <Button onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              setSelectedType('all');
              setSelectedDifficulty('all');
            }}>
              Clear all filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence>
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onEnroll={handleEnroll}
                onViewDetails={handleViewDetails}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Enrollment Dialog */}
      <EnrollmentDialog
        course={selectedCourse}
        isOpen={enrollmentDialogOpen}
        onClose={() => {
          setEnrollmentDialogOpen(false);
          setSelectedCourse(null);
        }}
        onConfirm={handleEnrollmentConfirm}
      />
    </div>
  );
};

export default CourseBrowse;