"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Plus, Trash2, AlertCircle, CheckCircle, Loader2, Calendar, Shield, Timer, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BookingService } from '@/services/booking.service';
import type { InstructorAvailability, AvailabilityException } from '@/types/booking';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60];

export default function InstructorAvailabilityPage() {
  const [availability, setAvailability] = useState<InstructorAvailability[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);

  // Form state
  const [formDay, setFormDay] = useState(0);
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('17:00');

  // Block form state
  const [blockDate, setBlockDate] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Buffer period state
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [savingBuffer, setSavingBuffer] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await BookingService.getMyAvailability();
      setAvailability(res.availability);
      setExceptions(res.exceptions);
      if (typeof res.buffer_minutes === 'number') {
        setBufferMinutes(res.buffer_minutes);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load availability.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddAvailability = async () => {
    setSaving(true);
    setError(null);
    try {
      await BookingService.saveAvailability({
        day_of_week: formDay,
        start_time: formStart,
        end_time: formEnd,
      });
      setSuccess('Availability added successfully!');
      setShowAddForm(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save availability.');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleDeleteAvailability = async (id: number) => {
    if (!confirm('Remove this availability slot?')) return;
    try {
      await BookingService.deleteAvailability(id);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const handleBlockDate = async () => {
    if (!blockDate) return;
    setSaving(true);
    setError(null);
    try {
      await BookingService.saveException({
        date: blockDate,
        is_blocked: true,
        reason: blockReason || undefined,
      });
      setSuccess('Date blocked successfully!');
      setShowBlockForm(false);
      setBlockDate('');
      setBlockReason('');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to block date.');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleDeleteException = async (id: number) => {
    if (!confirm('Remove this block?')) return;
    try {
      await BookingService.deleteException(id);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const handleSaveBuffer = async () => {
    setSavingBuffer(true);
    setError(null);
    try {
      await BookingService.updateInstructorBuffer(bufferMinutes);
      setSuccess('Buffer period updated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update buffer period.');
    } finally {
      setSavingBuffer(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  // Group availability by day
  const groupedAvailability = DAY_NAMES.map((name, idx) => ({
    day: name,
    slots: availability.filter(a => a.day_of_week === idx),
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Availability</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Set your available hours for student bookings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBlockForm(!showBlockForm)}>
            <Shield className="w-4 h-4 mr-2" /> Block Date
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-gradient-to-r from-blue-600 to-purple-600">
            <Plus className="w-4 h-4 mr-2" /> Add Hours
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
        </div>
      )}

      {/* Buffer Period Settings */}
      <Card className="mb-6 border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50/50 to-transparent dark:from-indigo-900/10">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
              <Timer className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">Buffer Period</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-xl">
                Set the gap you need between sessions to prepare or take a break. This time is applied
                before and after each session, so students can&apos;t book sessions closer than this.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="buffer-minutes" className="text-sm whitespace-nowrap">Buffer between sessions</Label>
                  <select
                    id="buffer-minutes"
                    value={bufferMinutes}
                    onChange={e => setBufferMinutes(Number(e.target.value))}
                    className="w-28 border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700"
                  >
                    {BUFFER_OPTIONS.map(m => (
                      <option key={m} value={m}>{m === 0 ? 'None' : `${m} min`}</option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600"
                  onClick={handleSaveBuffer}
                  disabled={savingBuffer}
                >
                  {savingBuffer ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                  Save Buffer
                </Button>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Example: a 60-minute session with a 15-minute buffer occupies 75 minutes, before and after.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {/* Add Availability Form */}
        {showAddForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="mb-6 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-4"><CardTitle className="text-base">Add Availability</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Day of Week</Label>
                    <select
                      className="mt-1.5 w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
                      value={formDay}
                      onChange={e => setFormDay(Number(e.target.value))}
                    >
                      {DAY_NAMES.map((name, idx) => (
                        <option key={idx} value={idx}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Start Time</Label>
                    <Input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleAddAvailability} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Block Date Form */}
        {showBlockForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="mb-6 border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-4"><CardTitle className="text-base">Block a Date</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Reason (optional)</Label>
                    <Input
                      placeholder="e.g., Holiday, Personal appointment"
                      value={blockReason}
                      onChange={e => setBlockReason(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setShowBlockForm(false)}>Cancel</Button>
                  <Button size="sm" variant="destructive" onClick={handleBlockDate} disabled={saving || !blockDate}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Shield className="w-4 h-4 mr-1" />}
                    Block Date
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Weekly Schedule */}
          <div className="space-y-3 mb-8">
            {groupedAvailability.map(({ day, slots }) => (
              <Card key={day}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 dark:text-white w-28">{day}</h3>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {slots.length === 0 ? (
                        <span className="text-sm text-gray-400 italic">No availability set</span>
                      ) : (
                        slots.map(slot => (
                          <div key={slot.id} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg text-sm">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="font-medium">{slot.start_time} - {slot.end_time}</span>
                            <button
                              onClick={() => handleDeleteAvailability(slot.id)}
                              className="text-red-400 hover:text-red-600 ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Blocked Dates */}
          {exceptions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Blocked Dates</h3>
              <div className="space-y-2">
                {exceptions.map(exc => (
                  <Card key={exc.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-orange-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {new Date(exc.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                          {exc.reason && <p className="text-xs text-gray-500">{exc.reason}</p>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteException(exc.id)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {availability.length === 0 && exceptions.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No availability configured</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Set your weekly available hours so students can book sessions with you.
                </p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Your First Availability
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
