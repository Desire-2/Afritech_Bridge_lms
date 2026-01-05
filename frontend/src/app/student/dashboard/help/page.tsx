'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  HelpCircle, 
  Mail, 
  Phone, 
  MessageSquare, 
  BookOpen, 
  FileText, 
  Settings, 
  Users,
  Send,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function HelpSupportPage() {
  const { user, token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    category: '',
    message: '',
    priority: 'medium'
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.subject.trim() || !formData.category || !formData.message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_URL}/student/support/ticket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: formData.subject,
          category: formData.category,
          message: formData.message,
          priority: formData.priority,
          user_email: user?.email,
          user_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
        }),
      });

      if (response.ok) {
        toast.success('Support ticket submitted successfully! We\'ll get back to you soon.');
        setFormData({
          subject: '',
          category: '',
          message: '',
          priority: 'medium'
        });
      } else {
        toast.error('Failed to submit support ticket. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting support ticket:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      question: 'How do I enroll in a new course?',
      answer: 'Navigate to the course catalog from your dashboard, browse available courses, and click "Enroll" on the course you want to join. Some courses may require prerequisites.'
    },
    {
      question: 'How can I track my learning progress?',
      answer: 'You can monitor your progress in the "My Progress" section of your dashboard. This shows completion rates, quiz scores, and overall course advancement.'
    },
    {
      question: 'Where can I find my certificates?',
      answer: 'Completed course certificates are available in the "Certifications" section. You can download or share them directly from there.'
    },
    {
      question: 'How do I submit assignments?',
      answer: 'Go to the "Assignments" section, select the assignment you want to submit, and follow the upload instructions. Make sure to submit before the deadline.'
    },
    {
      question: 'Can I change my profile information?',
      answer: 'Yes! Visit your Profile page where you can update personal information, career details, preferences, and privacy settings.'
    },
    {
      question: 'What if I forgot my password?',
      answer: 'Use the "Forgot Password" link on the login page to reset your password. You\'ll receive an email with reset instructions.'
    }
  ];

  const contactInfo = [
    {
      icon: <Mail className="w-5 h-5" />,
      label: 'Email',
      value: 'afritech.bridge@yahoo.com',
      action: 'mailto:afritech.bridge@yahoo.com'
    },
    {
      icon: <Phone className="w-5 h-5" />,
      label: 'Phone',
      value: 'Contact via email for phone support',
      action: null
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      label: 'Response Time',
      value: '24-48 hours',
      action: null
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Help & Support</h1>
        <p className="text-gray-600">Get assistance with your learning journey</p>
      </div>

      <Tabs defaultValue="contact" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contact">Contact Support</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        {/* Contact Support Tab */}
        <TabsContent value="contact" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Support Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Submit Support Ticket
                </CardTitle>
                <CardDescription>
                  Send us a message and we'll respond within 24-48 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder="Brief description of your issue"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select onValueChange={(value) => handleSelectChange('category', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select issue category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical Issue</SelectItem>
                        <SelectItem value="course">Course Content</SelectItem>
                        <SelectItem value="account">Account & Profile</SelectItem>
                        <SelectItem value="payment">Payment & Billing</SelectItem>
                        <SelectItem value="certificate">Certificates</SelectItem>
                        <SelectItem value="assignment">Assignments</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select 
                      defaultValue="medium" 
                      onValueChange={(value) => handleSelectChange('priority', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Describe your issue in detail..."
                      rows={6}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      'Submitting...'
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Ticket
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>
                    Other ways to reach our support team
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contactInfo.map((contact, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        {contact.icon}
                      </div>
                      <div>
                        <p className="font-medium">{contact.label}</p>
                        {contact.action ? (
                          <a 
                            href={contact.action} 
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            {contact.value}
                          </a>
                        ) : (
                          <p className="text-gray-600">{contact.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <p className="text-sm text-gray-600">
                      Check the FAQ section first for common questions
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <p className="text-sm text-gray-600">
                      Include screenshots if reporting a technical issue
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <p className="text-sm text-gray-600">
                      Provide specific course names when asking about content
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Frequently Asked Questions
              </CardTitle>
              <CardDescription>
                Find answers to common questions about using the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b pb-4 last:border-b-0">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-gray-600">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  User Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Comprehensive guide on how to use the learning platform effectively.
                </p>
                <Button variant="outline" className="w-full">
                  View Guide
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Course Policies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Information about course completion, certificates, and academic policies.
                </p>
                <Button variant="outline" className="w-full">
                  View Policies
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Technical Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  System requirements and browser compatibility information.
                </p>
                <Button variant="outline" className="w-full">
                  View Requirements
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Community Support
              </CardTitle>
              <CardDescription>
                Connect with other learners and get peer support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">Student Forums</h4>
                    <p className="text-sm text-gray-600">Join discussions with fellow students</p>
                  </div>
                  <Button variant="outline">Join Forums</Button>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">Study Groups</h4>
                    <p className="text-sm text-gray-600">Form or join study groups for courses</p>
                  </div>
                  <Button variant="outline">Find Groups</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}