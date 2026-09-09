"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StudentApiService } from "@/services/studentApi";

export type NotesSaveStatus = "idle" | "saving" | "saved" | "error";

/** One authoritative, stale-response-safe notes pipeline for the learning page. */
export function useNotesAutosave(currentLessonId: number | undefined) {
  const [lessonNotes, setLessonNotesState] = useState("");
  const [currentNoteId, setCurrentNoteIdState] = useState<number | null>(null);
  const [notesSaveStatus, setNotesSaveStatus] = useState<NotesSaveStatus>("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const lessonIdRef = useRef<number | undefined>(currentLessonId);
  const notesRef = useRef("");
  const noteIdRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const saveInFlightRef = useRef<Promise<void> | null>(null);

  const setLessonNotes = useCallback((value: string) => {
    notesRef.current = value;
    setLessonNotesState(value);
  }, []);

  const setCurrentNoteId = useCallback((value: number | null) => {
    noteIdRef.current = value;
    setCurrentNoteIdState(value);
  }, []);

  const saveCurrentNotes = useCallback(async () => {
    const lessonId = lessonIdRef.current;
    const content = notesRef.current;
    const noteId = noteIdRef.current;
    const generation = generationRef.current;

    if (!lessonId || (!content.trim() && !noteId)) return;
    if (saveInFlightRef.current) {
      await saveInFlightRef.current;
      // The next debounce/flush will use the note ID returned by the pending
      // request, rather than creating a second note for the same lesson.
      return;
    }
    setNotesSaveStatus("saving");

    let savePromise: Promise<void>;
    savePromise = (async () => {
      try {
        const saved = noteId
          ? await StudentApiService.updateNote(noteId, content)
          : await StudentApiService.createNote(lessonId, content);

        // Ignore a late response from a previous lesson or an older request.
        if (generation !== generationRef.current || lessonId !== lessonIdRef.current) return;
        if (saved?.id) setCurrentNoteId(saved.id);
        setNotesSaveStatus("saved");
        if (statusResetRef.current) clearTimeout(statusResetRef.current);
        statusResetRef.current = setTimeout(() => {
          setNotesSaveStatus((status) => status === "saved" ? "idle" : status);
        }, 3000);
      } catch (error) {
        if (generation === generationRef.current && lessonId === lessonIdRef.current) {
          console.error("Failed to save lesson notes:", error);
          setNotesSaveStatus("error");
        }
      } finally {
        // Clear the shared in-flight slot even if the learner changed lessons
        // while this request was pending. Otherwise the next lesson would
        // permanently believe an unrelated request was still active.
        if (saveInFlightRef.current === savePromise) saveInFlightRef.current = null;
      }
    })();

    saveInFlightRef.current = savePromise;
    await savePromise;
  }, [setCurrentNoteId]);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    lessonIdRef.current = currentLessonId;
    loadingRef.current = true;
    notesRef.current = "";
    noteIdRef.current = null;
    setLessonNotesState("");
    setCurrentNoteIdState(null);
    setNotesSaveStatus("idle");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (statusResetRef.current) clearTimeout(statusResetRef.current);

    if (!currentLessonId) {
      loadingRef.current = false;
      return;
    }

    setNotesSaveStatus("saving");
    StudentApiService.getNotes(currentLessonId)
      .then((notes) => {
        if (generation !== generationRef.current) return;
        const latest = notes?.[0];
        const content = latest?.content || "";
        notesRef.current = content;
        noteIdRef.current = latest?.id ?? null;
        setLessonNotesState(content);
        setCurrentNoteIdState(latest?.id ?? null);
        setNotesSaveStatus("idle");
      })
      .catch((error) => {
        if (generation !== generationRef.current) return;
        console.warn("Failed to load lesson notes:", error);
        setNotesSaveStatus("error");
      })
      .finally(() => {
        if (generation === generationRef.current) loadingRef.current = false;
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentLessonId]);

  useEffect(() => {
    if (!currentLessonId || loadingRef.current) return;
    if (!lessonNotes.trim() && !currentNoteId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void saveCurrentNotes();
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [lessonNotes, currentLessonId, currentNoteId, saveCurrentNotes]);

  const flushNotes = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (saveInFlightRef.current) await saveInFlightRef.current;
    if (notesRef.current.trim() || noteIdRef.current) await saveCurrentNotes();
  }, [saveCurrentNotes]);

  const clearNotes = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    notesRef.current = "";
    noteIdRef.current = null;
    setLessonNotesState("");
    setCurrentNoteIdState(null);
    setNotesSaveStatus("idle");
  }, []);

  return {
    lessonNotes,
    setLessonNotes,
    currentNoteId,
    notesSaveStatus,
    clearNotes,
    flushNotes,
  };
}
