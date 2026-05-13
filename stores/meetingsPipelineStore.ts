import { create } from "zustand";

export type MeetingItem = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  meetingUrl?: string | null;
  participants?: string[];
  platform?: string;
  recordingUrl?: string | null;
  transcriptReady?: boolean;
  botScheduled?: boolean;
  botSent?: boolean;
  botStatus?: string;
  processingStatus?: string;
  summary?: string | null;
  userNotes?: string | null;
};

type MeetingsTab = "upcoming" | "past";

type MeetingsPipelineState = {
  activeTab: MeetingsTab;
  upcomingMeetings: MeetingItem[];
  pastMeetings: MeetingItem[];
  isLoading: boolean;
  isProcessingMeetingId: string | null;
  isBotActionMeetingId: string | null;
  error: string | null;
  lastSyncedAt: string | null;
  setActiveTab: (tab: MeetingsTab) => void;
  clearError: () => void;
  fetchMeetings: () => Promise<void>;
  runAiPipeline: (meetingId: string) => Promise<void>;
  toggleMeetingBot: (meetingId: string, shouldSchedule: boolean) => Promise<void>;
  stopMeetingBot: (meetingId: string) => Promise<void>;
};

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export const useMeetingsPipelineStore = create<MeetingsPipelineState>((set, get) => ({
  activeTab: "upcoming",
  upcomingMeetings: [],
  pastMeetings: [],
  isLoading: false,
  isProcessingMeetingId: null,
  isBotActionMeetingId: null,
  error: null,
  lastSyncedAt: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  clearError: () => set({ error: null }),

  fetchMeetings: async () => {
    set({ isLoading: true, error: null });
    try {
      const [upRes, pastRes] = await Promise.all([
        fetch("/api/meetings/upcoming-recordings"),
        fetch("/api/meetings?scope=past&take=100"),
      ]);

      const upJson = await parseJsonSafe(upRes);
      const pastJson = await parseJsonSafe(pastRes);

      if (!upRes.ok) {
        throw new Error(upJson?.error || "Failed to fetch upcoming meetings");
      }
      if (!pastRes.ok) {
        throw new Error(pastJson?.error || "Failed to fetch past meetings");
      }

      set({
        upcomingMeetings: upJson?.data || [],
        pastMeetings: pastJson?.data || [],
        isLoading: false,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to sync meetings",
      });
    }
  },

  runAiPipeline: async (meetingId) => {
    set({ isProcessingMeetingId: meetingId, error: null });
    try {
      const response = await fetch(`/api/meetings/${meetingId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invoke_processor" }),
      });

      const json = await parseJsonSafe(response);
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || "Failed to run AI pipeline");
      }

      await get().fetchMeetings();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to run AI pipeline" });
    } finally {
      set({ isProcessingMeetingId: null });
    }
  },

  toggleMeetingBot: async (meetingId, shouldSchedule) => {
    set({ isBotActionMeetingId: meetingId, error: null });
    try {
      const response = await fetch(`/api/meetings/${meetingId}/bot-toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botScheduled: shouldSchedule,
          forceDispatch: shouldSchedule,
        }),
      });

      const json = await parseJsonSafe(response);
      if (!response.ok || !json?.success || json?.error) {
        throw new Error(json?.error || "Failed to update bot status");
      }

      await get().fetchMeetings();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to update bot status" });
    } finally {
      set({ isBotActionMeetingId: null });
    }
  },

  stopMeetingBot: async (meetingId) => {
    set({ isBotActionMeetingId: meetingId, error: null });
    try {
      const response = await fetch(`/api/meetings/${meetingId}/stop-bot`, {
        method: "POST",
      });

      const json = await parseJsonSafe(response);
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || "Failed to stop bot");
      }

      await get().fetchMeetings();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to stop bot" });
    } finally {
      set({ isBotActionMeetingId: null });
    }
  },
}));
