"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, RefreshCw, Users, MessageSquare, Mail, Phone, Send, Crown } from 'lucide-react';
import StudentSubmissionService, {
  TeamChatMessage,
  TeamDashboardData,
} from '@/services/student-submission.service';

interface TeamSectionProps {
  projectId: number;
}

const POLL_INTERVAL_MS = 5000;

const formatTime = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * The team half of the project tab: who is on the team (with the email and
 * phone number each member enrolled with) and the team's own chat room.
 * Data is fetched here so the panel itself stays a single-purpose component.
 */
export const TeamSection: React.FC<TeamSectionProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamDashboardData | null>(null);

  const [viewerId, setViewerId] = useState<number | null>(null);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);

  const lastIdRef = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);

  const inTeam = !!team?.in_team && !!team?.team;
  const members = team?.team?.members ?? [];

  const appendMessages = useCallback((incoming: TeamChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((previous) => {
      const seen = new Set(previous.map((message) => message.id));
      const fresh = incoming.filter((message) => !seen.has(message.id));
      if (!fresh.length) return previous;
      const merged = [...previous, ...fresh];
      lastIdRef.current = merged.reduce((max, message) => Math.max(max, message.id), lastIdRef.current);
      return merged;
    });
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await StudentSubmissionService.getMyTeamInfo(projectId);
      setTeam(data);
      if (data.in_team && data.team) {
        const page = await StudentSubmissionService.getTeamChat(projectId);
        setViewerId(page.viewer_id);
        setMessages(page.messages);
        lastIdRef.current = page.messages.reduce(
          (max, message) => Math.max(max, message.id),
          0
        );
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load your team');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  // Poll for new messages while the tab is visible; transient failures just
  // leave the last known messages on screen.
  const pollChat = useCallback(async () => {
    if (document.hidden) return;
    try {
      const page = await StudentSubmissionService.getTeamChat(projectId, {
        after: lastIdRef.current || undefined,
      });
      setViewerId(page.viewer_id);
      appendMessages(page.messages);
    } catch {
      /* keep the room as it was */
    }
  }, [projectId, appendMessages]);

  useEffect(() => {
    if (!inTeam) return;
    const timer = setInterval(() => void pollChat(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [inTeam, pollChat]);

  // Keep the newest message in view
  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setChatError(null);
    try {
      const created = await StudentSubmissionService.sendTeamChatMessage(projectId, body);
      appendMessages([created]);
      setDraft('');
    } catch (err: any) {
      const message = err?.message || 'Could not send your message';
      setChatError(message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-gray-900 py-8 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        Loading your team…
      </div>
    );
  }

  if (loadError || !team) {
    return (
      <div className="rounded-2xl border border-red-800/50 bg-red-900/20 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span>{loadError || 'Could not load your team.'}</span>
          <Button size="sm" variant="outline" onClick={() => void loadInitial()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!inTeam) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Users className="h-4 w-4 text-gray-500" />
          You are not on a team for this project yet. Once you are assigned one,
          your teammates and the team chat will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Team roster */}
      <div className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Users className="h-4 w-4 text-blue-300" />
            Your team
          </h4>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-gray-300">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </div>

        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-300">
                {member.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">{member.name}</span>
                  {member.is_primary && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-300">
                      <Crown className="h-3 w-3" />
                      Lead
                    </span>
                  )}
                  {member.is_me && (
                    <span className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-300">
                      You
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  {member.email && (
                    <a
                      href={`mailto:${member.email}`}
                      className="flex min-w-0 items-center gap-1.5 hover:text-blue-300 hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </a>
                  )}
                  {member.phone ? (
                    <a
                      href={`tel:${member.phone}`}
                      className="flex min-w-0 items-center gap-1.5 hover:text-blue-300 hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{member.phone}</span>
                    </a>
                  ) : (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      No phone number on file
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Team chat room */}
      <div className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageSquare className="h-4 w-4 text-blue-300" />
            Team chat
          </h4>
          <span className="text-xs text-gray-500">
            Only your team can see this room
          </span>
        </div>

        <div
          ref={messagesRef}
          className="max-h-80 min-h-[5rem] space-y-2 overflow-y-auto pr-1"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No messages yet — say hello to your team.
            </p>
          ) : (
            messages.map((message) => {
              const mine = message.sender_id === viewerId;
              return (
                <div
                  key={message.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      mine
                        ? 'bg-blue-600/90 text-white'
                        : 'border border-white/[0.06] bg-white/[0.05] text-gray-200'
                    }`}
                  >
                    {!mine && (
                      <p className="mb-0.5 text-[11px] font-medium text-blue-300">
                        {message.sender_name || 'Teammate'}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {message.body}
                    </p>
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        mine ? 'text-blue-100/70' : 'text-gray-500'
                      }`}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {chatError && (
          <p className="text-xs text-red-400" role="alert">
            {chatError}
          </p>
        )}

        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <label htmlFor={`team-chat-input-${projectId}`} className="sr-only">
            Message your team
          </label>
          <textarea
            id={`team-chat-input-${projectId}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            rows={2}
            placeholder="Message your team…"
            className="flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-200 placeholder-gray-400 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <Button
            type="submit"
            disabled={sending || !draft.trim()}
            className="h-[46px] bg-blue-600 text-white hover:bg-blue-500"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
};

export default TeamSection;
