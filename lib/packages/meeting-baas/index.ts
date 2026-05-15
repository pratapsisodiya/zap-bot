import type { MeetingPlatform } from "../shared";

// ── Types ──────────────────────────────────────────────────────────

export interface SendBotOptions {
    meetingUrl: string;
    botName?: string;
    botAvatar?: string;
    entryMessage?: string;
    recording?: {
        mode?: "speaker_view" | "gallery_view" | "audio_only";
    };
    transcription?: {
        enabled?: boolean;
        language?: string;
        provider?: string;
    };
    webhookUrl?: string;
}

export interface BotResponse {
    id: string;
    status: string;
    meetingUrl: string;
    platform: MeetingPlatform;
    createdAt: string;
}

export interface MeetingRecording {
    id: string;
    url: string;
    duration: number;
    format: string;
    size: number;
}

export interface MeetingTranscript {
    id: string;
    entries: Array<{
        speaker: string;
        text: string;
        start_time: number;
        end_time: number;
    }>;
    language: string;
}

export interface MeetingDetails {
    id: string;
    bot_id: string;
    status: string;
    platform: MeetingPlatform;
    meeting_url: string;
    duration?: number;
    recording?: MeetingRecording;
    transcript?: MeetingTranscript;
    participants?: string[];
    created_at: string;
    completed_at?: string;
}

// ── Client ─────────────────────────────────────────────────────────

export class MeetingBaaSClient {
    private baseUrl: string;
    private apiKey: string;

    constructor(apiKey?: string, baseUrl?: string) {
        this.apiKey = apiKey || process.env.MEETING_BAAS_API_KEY || "";
        this.baseUrl = baseUrl || "https://api.meetingbaas.com/v2";
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown
    ): Promise<T> {
        if (!this.apiKey) {
            throw new Error(
                "Meeting BaaS API key is not configured. Set MEETING_BAAS_API_KEY env variable."
            );
        }

        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                "x-meeting-baas-api-key": this.apiKey,
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Meeting BaaS API error (${response.status}): ${errorText}`
            );
        }

        return response.json() as Promise<T>;
    }

    /**
     * Send a bot to join a meeting
     */
    async sendBot(options: SendBotOptions): Promise<BotResponse> {
        return this.request<BotResponse>("POST", "/bots", {
            meeting_url: options.meetingUrl,
            bot_name: options.botName || "Zap Bot",
            bot_avatar: options.botAvatar,
            entry_message:
                options.entryMessage ||
                "👋 Zap Bot has joined to record and transcribe this meeting.",
            recording: options.recording || { mode: "speaker_view" },
            transcription: options.transcription || {
                enabled: true,
                language: "en",
            },
            webhook_url: options.webhookUrl,
        });
    }

    /**
     * Remove a bot from a meeting
     */
    async removeBot(botId: string): Promise<void> {
        await this.request("DELETE", `/bots/${botId}`);
    }

    /**
     * Get bot status
     */
    async getBotStatus(
        botId: string
    ): Promise<{ id: string; status: string; meeting_url: string }> {
        return this.request("GET", `/bots/${botId}`);
    }

    /**
     * Get meeting details including recording and transcript
     */
    async getMeeting(meetingId: string): Promise<MeetingDetails> {
        return this.request<MeetingDetails>("GET", `/meetings/${meetingId}`);
    }

    /**
     * Get meeting transcript
     */
    async getTranscript(meetingId: string): Promise<MeetingTranscript> {
        return this.request<MeetingTranscript>(
            "GET",
            `/meetings/${meetingId}/transcript`
        );
    }

    /**
     * Get meeting recording
     */
    async getRecording(meetingId: string): Promise<MeetingRecording> {
        return this.request<MeetingRecording>(
            "GET",
            `/meetings/${meetingId}/recording`
        );
    }

    /**
     * List all meetings
     */
    async listMeetings(params?: {
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<{ meetings: MeetingDetails[]; total: number }> {
        const query = new URLSearchParams();
        if (params?.limit) query.set("limit", String(params.limit));
        if (params?.offset) query.set("offset", String(params.offset));
        if (params?.status) query.set("status", params.status);
        const qs = query.toString();
        return this.request("GET", `/meetings${qs ? `?${qs}` : ""}`);
    }

    /**
     * Retranscribe a meeting with a different provider
     */
    async retranscribe(
        meetingId: string,
        provider: string
    ): Promise<MeetingTranscript> {
        return this.request<MeetingTranscript>(
            "POST",
            `/meetings/${meetingId}/retranscribe`,
            { provider }
        );
    }
}

// Default export
export default MeetingBaaSClient;
