"use client";
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, User, ArrowLeft, ArrowRight, CheckCircle,
  AlertCircle, Loader2, ChevronLeft, ChevronRight, BookOpen, Send,
  Clock3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BookingService } from '@/services/booking.service';
import type { BookingInstructor, BookingSlot, AvailableDate, Booking } from '@/types/booking';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

type Step = 'instructor' | 'datetime' | 'confirm' | 'success';

export default function NewBookingPage() {
  const [step, setStep] = useState<Step>('instructor');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Instructor selection
  const [instructors, setInstructors] = useState<BookingInstructor[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<BookingInstructor | null>(null);

  // Date/time selection
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Booking form
  const [sessionTopic, setSessionTopic] = useState('');
  const [studentNotes, setStudentNotes] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);

  // Load instructors
  useEffect(() => {
    const load = async () => {
      try {
        const res = await BookingService.getBookingInstructors();
        setInstructors(res.instructors);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load instructors.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load available dates when month changes or instructor selected
  const loadDates = useCallback(async () => {
    if (!selectedInstructor) return;
    setLoadingDates(true);
    try {
      const res = await BookingService.getAvailableDates(
        selectedInstructor.id, currentMonth.year, currentMonth.month
      );
      setAvailableDates(res.available_dates);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load dates:', err);
      setError(err.response?.data?.error || 'Failed to load available dates. Please try again.');
    } finally {
      setLoadingDates(false);
    }
  }, [selectedInstructor, currentMonth]);

  useEffect(() => { loadDates(); }, [loadDates]);

  // Load slots when date selected
  useEffect(() => {
    if (!selectedInstructor || !selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    BookingService.getAvailableSlots(selectedInstructor.id, selectedDate)
      .then(res => setSlots(res.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedInstructor, selectedDate]);

  const handleSelectInstructor = (instructor: BookingInstructor) => {
    setSelectedInstructor(instructor);
    setSelectedCourseId(instructor.courses?.[0]?.id);
    setStep('datetime');
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const handleSubmitBooking = async () => {
    if (!selectedInstructor || !selectedSlot || !sessionTopic.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await BookingService.createBooking({
        instructor_id: selectedInstructor.id,
        start_datetime: selectedSlot.start_datetime,
        session_topic: sessionTopic.trim(),
        course_id: selectedCourseId,
        student_notes: studentNotes.trim() || undefined,
      });
      setCreatedBooking(res.booking);
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (step === 'datetime') setStep('instructor');
    else if (step === 'confirm') setStep('datetime');
  };

  // Calendar generation
  const getCalendarDays = () => {
    const firstDay = new Date(currentMonth.year, currentMonth.month - 1, 1);
    const lastDay = new Date(currentMonth.year, currentMonth.month, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
    const days: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    return days;
  };

  const formatDateStr = (day: number) => {
    return `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isDateAvailable = (day: number) => {
    return availableDates.some(d => d.date === formatDateStr(day));
  };

  const isPast = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const check = new Date(currentMonth.year, currentMonth.month - 1, day);
    return check < today;
  };

  const stepLabels = ['Instructor', 'Date & Time', 'Confirm'];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back button */}
      {step !== 'instructor' && step !== 'success' && (
        <button onClick={goBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}

      {/* Step indicator */}
      {step !== 'success' && (
        <div className="flex items-center gap-2 mb-8">
          {stepLabels.map((label, idx) => {
            const currentStepIdx = step === 'instructor' ? 0 : step === 'datetime' ? 1 : 2;
            const isActive = idx === currentStepIdx;
            const isDone = idx < currentStepIdx;
            return (
              <div key={label} className="flex items-center gap-2">
                {idx > 0 && <div className={`w-8 h-px ${isDone ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isActive ? 'bg-blue-600 text-white' :
                    isDone ? 'bg-green-500 text-white' :
                    'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {isDone ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-sm font-medium hidden sm:inline ${
                    isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && step !== 'success' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: Instructor Selection */}
        {step === 'instructor' && (
          <motion.div key="instructor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Select an Instructor</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose the instructor you&apos;d like to book a session with</p>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
              </div>
            ) : instructors.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <User className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No instructors available</h3>
                  <p className="text-gray-500 dark:text-gray-400">You need to be enrolled in a course to book sessions with instructors.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {instructors.map(instructor => (
                  <Card
                    key={instructor.id}
                    className={`hover:shadow-md transition-all cursor-pointer border-2 ${
                      !instructor.has_availability
                        ? 'border-gray-200 dark:border-gray-700 opacity-60'
                        : 'border-transparent hover:border-blue-300 dark:hover:border-blue-600'
                    }`}
                    onClick={() => instructor.has_availability && handleSelectInstructor(instructor)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {instructor.profile_picture ? (
                            <img src={instructor.profile_picture} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            instructor.name.split(' ').map(n => n[0]).join('').slice(0, 2)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{instructor.name}</h3>
                          {instructor.bio && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{instructor.bio}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {instructor.courses.map(c => (
                              <Badge key={c.id} variant="secondary" className="text-xs">
                                <BookOpen className="w-3 h-3 mr-1" />{c.title}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {instructor.has_availability ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <Clock className="w-3 h-3 mr-1" /> Available
                            </Badge>
                          ) : (
                            <Badge variant="secondary">No availability set</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 2: Date & Time Selection */}
        {step === 'datetime' && (
          <motion.div key="datetime" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Select Date & Time
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Booking with {selectedInstructor?.name}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendar */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setCurrentMonth(m => {
                        const newMonth = m.month === 1 ? 12 : m.month - 1;
                        const newYear = m.month === 1 ? m.year - 1 : m.year;
                        return { year: newYear, month: newMonth };
                      })}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <CardTitle className="text-base">
                      {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
                    </CardTitle>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setCurrentMonth(m => {
                        const newMonth = m.month === 12 ? 1 : m.month + 1;
                        const newYear = m.month === 12 ? m.year + 1 : m.year;
                        return { year: newYear, month: newMonth };
                      })}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {DAY_NAMES.map(d => (
                      <div key={d} className="text-[10px] font-semibold text-gray-400 uppercase">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {getCalendarDays().map((day, idx) => {
                      if (day === null) return <div key={`empty-${idx}`} />;
                      const dateStr = formatDateStr(day);
                      const available = isDateAvailable(day);
                      const past = isPast(day);
                      const isSelected = selectedDate === dateStr;
                      const today = formatDateStr(new Date().getDate()) === dateStr &&
                        new Date().getMonth() + 1 === currentMonth.month &&
                        new Date().getFullYear() === currentMonth.year;

                      return (
                        <button
                          key={day}
                          disabled={past || !available}
                          onClick={() => { setSelectedDate(dateStr); }}
                          className={`h-10 rounded-lg text-sm font-medium transition-all relative
                            ${isSelected ? 'bg-blue-600 text-white shadow-md' :
                              available && !past ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer' :
                              past ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' :
                              'text-gray-400 dark:text-gray-600 cursor-default'
                            }
                            ${today && !isSelected ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}
                          `}
                        >
                          {day}
                          {available && !past && !isSelected && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {loadingDates && (
                    <div className="flex items-center justify-center py-4 text-sm text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading dates...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Time Slots */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">
                    {selectedDate ? `Available Times on ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` : 'Select a date first'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedDate ? (
                    <div className="text-center py-8 text-gray-400">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Choose a highlighted date to see available times</p>
                    </div>
                  ) : loadingSlots ? (
                    <div className="flex items-center justify-center py-8 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading slots...
                    </div>
                  ) : slots.filter(s => s.is_available).length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No available slots for this date. Try another date.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
                      {slots.filter(s => s.is_available).map(slot => {
                        const isSelected = selectedSlot?.start_time === slot.start_time;
                        return (
                          <button
                            key={slot.start_time}
                            onClick={() => setSelectedSlot(slot)}
                            disabled={slot.student_has_booking}
                            className={`p-3 rounded-lg border-2 text-center transition-all text-sm font-medium
                              ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm' :
                                slot.student_has_booking ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed' :
                                'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                              }`}
                          >
                            <Clock className={`w-4 h-4 mx-auto mb-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                            {slot.start_time}
                            {slot.student_has_booking && (
                              <div className="text-[10px] text-orange-500 mt-1">Your booking</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedSlot && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex justify-end">
                <Button onClick={() => setStep('confirm')} className="bg-gradient-to-r from-blue-600 to-purple-600">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* STEP 3: Confirmation */}
        {step === 'confirm' && selectedSlot && selectedInstructor && (
          <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Confirm Your Booking</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Review your session details and confirm</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Session Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                      {selectedInstructor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedInstructor.name}</p>
                      <p className="text-xs text-gray-500">Instructor</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Time</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedSlot.start_time} - {selectedSlot.end_time}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Duration</span>
                      <span className="font-medium text-gray-900 dark:text-white">60 minutes</span>
                    </div>
                    {selectedInstructor.courses.find(c => c.id === selectedCourseId) && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Course</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedInstructor.courses.find(c => c.id === selectedCourseId)?.title}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Session Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="topic">Session Topic *</Label>
                    <Input
                      id="topic"
                      placeholder="e.g., Discuss project architecture, Review assignment feedback..."
                      value={sessionTopic}
                      onChange={e => setSessionTopic(e.target.value)}
                      className="mt-1.5"
                      maxLength={255}
                    />
                  </div>
                  {selectedInstructor.courses.length > 1 && (
                    <div>
                      <Label>Related Course</Label>
                      <select
                        className="mt-1.5 w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
                        value={selectedCourseId || ''}
                        onChange={e => setSelectedCourseId(e.target.value ? Number(e.target.value) : undefined)}
                      >
                        {selectedInstructor.courses.map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="notes">Additional Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any specific topics or questions you'd like to discuss..."
                      value={studentNotes}
                      onChange={e => setStudentNotes(e.target.value)}
                      className="mt-1.5"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your request will be sent to the instructor for confirmation.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('datetime')}>Back</Button>
                <Button
                  onClick={handleSubmitBooking}
                  disabled={!sessionTopic.trim() || submitting}
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Submit Request</>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Success */}
        {step === 'success' && createdBooking && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="max-w-lg mx-auto text-center">
              <CardContent className="p-10">
                <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock3 className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Booking Request Submitted!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  Your session request with {createdBooking.instructor_name} has been sent.
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6 font-medium">
                  Awaiting instructor confirmation — you&apos;ll be notified when they respond.
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span className="font-medium">{new Date(createdBooking.start_datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time</span>
                    <span className="font-medium">
                      {new Date(createdBooking.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(createdBooking.end_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Topic</span>
                    <span className="font-medium">{createdBooking.session_topic}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending Confirmation</Badge>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <Link href="/student/bookings">
                    <Button variant="outline">View My Sessions</Button>
                  </Link>
                  <Link href="/student/dashboard">
                    <Button>Back to Dashboard</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
