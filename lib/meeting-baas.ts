/**
 * Meeting BaaS (Bot as a Service) Integration
 * 
 * This service handles dispatching bots to join meetings automatically via MeetingBaas
 */

export interface MeetingBotConfig {
    meetingUrl: string;
    meetingTitle?: string;
    startTime?: Date;
    endTime?: Date;
    attendees?: string[];
    autoRecord?: boolean;
    autoTranscribe?: boolean;
    botName?: string;
    recordingMode?: "speaker_view" | "gallery_view";
    speechToTextProvider?: string;
    reserved?: boolean;
}

export interface BotStatus {
    botId: string;
    status: "pending" | "joining" | "in_meeting" | "recording" | "left" | "failed" | "completed";
    joinedAt?: Date;
    leftAt?: Date;
    error?: string;
}

function getApiKey() {
    return process.env.MEETING_BAAS_API_KEY || "";
}

function getWebhookUrl() {
    const explicit = process.env.MEETING_BAAS_WEBHOOK_URL?.trim() || process.env.MEETINGBAAS_WEBHOOK_URL?.trim();
    if (explicit) return explicit;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appUrl) return "";

    return `${appUrl.replace(/\/$/, "")}/api/webhooks/meetingbaas`;
}

function isMockMode() {
    return process.env.MEETING_BAAS_MOCK === "true";
}

function freeTrialOnly() {
    return process.env.MEETING_BAAS_FREE_TRIAL_ONLY !== "false";
}

function buildDispatchPayload(config: MeetingBotConfig, extra?: { meeting_id?: string; user_id?: string }) {
    const requestedRecordingMode = config.recordingMode || "speaker_view";
    const requestedProvider = config.speechToTextProvider || "Default";

    // Keep free-trial accounts on supported defaults unless explicitly unlocked.
    const recordingMode = freeTrialOnly() ? "speaker_view" : requestedRecordingMode;
    const speechProvider = freeTrialOnly() ? "Default" : requestedProvider;

    return {
        meeting_url: config.meetingUrl,
        bot_name: config.botName || "Zap Bot",
        reserved: freeTrialOnly() ? false : Boolean(config.reserved),
        recording_mode: recordingMode,
        speech_to_text: { provider: speechProvider },
        webhook_url: getWebhookUrl(),
        extra: extra || {},
    };
}

/**
 * Dispatch a bot to join a meeting
 */
export async function dispatchMeetingBot(
    config: MeetingBotConfig,
    extra?: { meeting_id?: string; user_id?: string }
): Promise<{ botId: string; status: BotStatus }> {
    console.log("Dispatching bot to meeting:", {
        meetingUrl: config.meetingUrl,
        title: config.meetingTitle,
        startTime: config.startTime,
        isMock: isMockMode()
    });

    const apiKey = getApiKey();
    console.log("Using API Key:", apiKey ? `${apiKey.substring(0, 5)}...` : "MISSING");
    console.log("Using Webhook URL:", getWebhookUrl());

    if (!apiKey) {
        if (isMockMode()) {
            console.log("Skipping real dispatch (Mock Mode without key)");
            const botId = `mock-bot-${Date.now()}`;
            return { botId, status: { botId, status: "pending" } };
        }
        throw new Error("MEETING_BAAS_API_KEY is not set in environment.");
    }

    if (isMockMode()) {
        console.log("Skipping real dispatch (Mock Mode)");
        const botId = `mock-bot-${Date.now()}`;
        return { botId, status: { botId, status: "pending" } };
    }

    try {
        const payload = buildDispatchPayload(config, extra);

        const response = await fetch("https://api.meetingbaas.com/v2/bots", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-meeting-baas-api-key": apiKey,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Meeting BaaS Status ${response.status}:`, errorText);
            throw new Error(`Meeting BaaS API error (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        const botId = data.bot_id || data.id;

        return {
            botId: botId,
            status: {
                botId: botId,
                status: "pending",
            },
        };
    } catch (error) {
        console.error("Failed to dispatch Meeting BaaS bot:", error);
        throw error;
    }
}

/**
 * Check bot status
 */
export async function getBotStatus(botId: string): Promise<BotStatus> {
    const apiKey = getApiKey();
    if (!apiKey) {
        if (isMockMode() || botId.startsWith("mock-bot")) {
            return { botId, status: "in_meeting", joinedAt: new Date() };
        }
        throw new Error("MEETING_BAAS_API_KEY is not set in environment.");
    }
    
    if (isMockMode() || botId.startsWith("mock-bot")) {
        return { botId, status: "in_meeting", joinedAt: new Date() };
    }

    try {
        const response = await fetch(`https://api.meetingbaas.com/v2/bots/${botId}`, {
            method: "GET",
            headers: {
                "x-meeting-baas-api-key": apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to check bot status: ${response.status}`);
        }

        const data = await response.json();

        let mappedStatus: BotStatus["status"] = "pending";
        // Map Meeting BaaS actual status strings to our internal types
        if (data.status === "joining") mappedStatus = "joining";
        if (data.status === "joined" || data.status === "recording") mappedStatus = "in_meeting";
        if (data.status === "completed" || data.status === "left") mappedStatus = "left";
        if (data.status === "failed" || data.status === "error") mappedStatus = "failed";

        return {
            botId: data.bot_id || data.id || botId,
            status: mappedStatus,
            joinedAt: data.joined_at ? new Date(data.joined_at) : undefined,
            leftAt: data.left_at ? new Date(data.left_at) : undefined,
        };
    } catch (error) {
        console.error("Error checking bot status:", error);
        throw error;
    }
}

/**
 * Stop/remove bot from meeting
 */
export async function stopMeetingBot(botId: string): Promise<void> {
    console.log("Stopping bot:", botId);

    const apiKey = getApiKey();
    if (!apiKey) {
        if (isMockMode() || botId.startsWith("mock-bot")) return;
        throw new Error("MEETING_BAAS_API_KEY is not set in environment.");
    }
    
    if (isMockMode() || botId.startsWith("mock-bot")) return;

    try {
        // Meeting BaaS typically uses DELETE or a specific end endpoint
        await fetch(`https://api.meetingbaas.com/v2/bots/${botId}`, {
            method: "DELETE",
            headers: {
                "x-meeting-baas-api-key": apiKey,
            },
        });
    } catch (error) {
        console.error("Error stopping bot:", error);
    }
}

/**
 * Get recording URL from bot
 */
export async function getBotRecording(botId: string): Promise<string | null> {
    const apiKey = getApiKey();
    if (!apiKey) {
        if (isMockMode() || botId.startsWith("mock-bot")) return null;
        throw new Error("MEETING_BAAS_API_KEY is not set in environment.");
    }
    if (isMockMode() || botId.startsWith("mock-bot")) return null;

    try {
        // Fetch bot details which usually includes recording URL once completed
        const response = await fetch(`https://api.meetingbaas.com/v2/bots/${botId}`, {
            headers: {
                "x-meeting-baas-api-key": apiKey,
            },
        });
        const data = await response.json();
        return data.mp4 || data.recording_url || null;
    } catch (error) {
        console.error("Error fetching bot recording:", error);
        return null;
    }
}

/**
 * Get transcript from bot.
 * Meeting Baas does not have a dedicated /transcript endpoint — the transcript
 * is returned inside the bot details object at GET /v2/bots/{botId}.
 */
export async function getBotTranscript(botId: string): Promise<any | null> {
    const apiKey = getApiKey();
    if (!apiKey) {
        if (isMockMode() || botId.startsWith("mock-bot")) return null;
        throw new Error("MEETING_BAAS_API_KEY is not set in environment.");
    }
    if (isMockMode() || botId.startsWith("mock-bot")) return null;

    try {
        const response = await fetch(`https://api.meetingbaas.com/v2/bots/${botId}`, {
            headers: {
                "x-meeting-baas-api-key": apiKey,
            },
        });

        if (!response.ok) {
            console.warn(`getBotTranscript: Meeting Baas returned ${response.status} for bot ${botId}`);
            return null;
        }

        const data = await response.json();
        // The transcript array lives directly on the bot object
        return data.transcript ?? null;
    } catch (error) {
        console.error("Error fetching bot transcript:", error);
        return null;
    }
}

/**
 * Parse meeting platform from URL
 */
export function detectMeetingPlatform(url: string): string {
    if (url.includes("meet.google.com")) return "google_meet";
    if (url.includes("zoom.us")) return "zoom";
    if (url.includes("teams.microsoft.com")) return "microsoft_teams";
    if (url.includes("webex.com")) return "webex";
    return "unknown";
}

/**
 * Validate meeting URL
 */
export function isValidMeetingUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    // Accept any valid URL that looks like a meeting
    // This is more permissive to support various meeting platforms
    const validPatterns = [
        /meet\.google\.com/,
        /zoom\.us\/(j|my|w)\//,
        /zoom\.us/,
        /teams\.microsoft\.com/,
        /webex\.com/,
        /livekit:/,  // LiveKit rooms
        /^https?:\/\//,  // Any http(s) URL
    ];

    return validPatterns.some((pattern) => pattern.test(url));
}
