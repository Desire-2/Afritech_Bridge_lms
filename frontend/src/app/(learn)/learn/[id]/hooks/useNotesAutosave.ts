"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { StudentApiService } from "@/services/studentApi";

export type NotesSaveStatus = "idle" | "saving" | "saved" | "error";

export function useNotesAutosave(currentLessonId: number | undefined) {
  const [lessonNotes, setLessonNotes] = useState("");
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null);
  const [notesSaveStatus, setNotesSaveStatus] = useState<NotesSaveStatus>("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  // Fetch notes when lesson changes
  useEffect(() => {
    if (!currentLessonId) return;

    isInitialLoadRef.current = true;

    const fetchNotes = async () => {
      try {
        setNotesSaveStatus("saving");
        const notes = await StudentApiService.getNotes(currentLessonId);
        if (notes && notes.length > 0) {
          const latest = notes[0];
          setLessonNotes(latest.content || "");
          setCurrentNoteId(latest.id);
        } else {
          setLessonNotes("");
          setCurrentNoteId(null);
        }
        setNotesSaveStatus("idle");
      } catch (error) {
        console.warn("⚠️ Failed to fetch lesson notes:", error);
        setNotesSaveStatus("idle");
      } finally {
        isInitialLoadRef.current = false;
      }
    };

    fetchNotes();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [currentLessonId]);

  // Debounced autosave
  useEffect(() => {
    if (!currentLessonId) return;
    if (isInitialLoadRef.current) return;
    if (!lessonNotes.trim() && !currentNoteId) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setNotesSaveStatus("saving");

        if (currentNoteId) {
          const updated = await StudentApiService.updateNote(
            currentNoteId,
            lessonNotes
          );
          if (updated?.id) {
            setCurrentNoteId(updated.id);
          }
        } else {
          const created = await StudentApiService.createNote(
            currentLessonId,
            lessonNotes
          );
          if (created?.id) {
            setCurrentNoteId(created.id);
          }
        }

        setNotesSaveStatus("saved");
        setTimeout(() => {
          setNotesSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 3000);
      } catch (error) {
        console.error("❌ Failed to save note:", error);
        setNotesSaveStatus("error");
      }
    }, 1500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [lessonNotes, currentLessonId, currentNoteId]);

  const clearNotes = useCallback(() => {
    setLessonNotes("");
    setCurrentNoteId(null);
    setNotesSaveStatus("idle");
  }, []);

  return {
    lessonNotes,
    setLessonNotes,
    currentNoteId,
    notesSaveStatus,
    clearNotes,
  };
}
