import { databases, Query } from "@/lib/appwrite.server";
import { APPWRITE_IDS } from "@/lib/appwrite-config";
import { updateDocumentBestEffort } from "@/lib/appwrite-compat";
import { resolveAgentBotName } from "@/lib/bot-name";
import { dispatchMeetingBot } from "@/lib/meeting-baas";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/bot/scheduler
 * Global scheduler to dispatch bots for meetings starting soon.
 * Ideally called by a cron job every 1-5 minutes.
 */
export async function GET(request: Request) {
    try {
        // Optional: Add a simple secret check for security
        const authHeader = request.headers.get("Authorization");
        const cronSecret = process.env.CRON_SECRET;
        
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            // Uncomment this in production for security
            // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const now = new Date();
        // Look for meetings starting in the next 5 minutes OR already started in the last 10 minutes
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

        console.log(`[Scheduler] Scanning meetings between ${tenMinutesAgo} and ${fiveMinutesFromNow}`);

        // Get meetings where:
        // 1. botScheduled is true
        // 2. botSent is false (or null)
        // 3. startTime is soon
        const pendingMeetings = await databases.listDocuments(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            [
                Query.equal("botScheduled", true),
                Query.equal("botSent", false),
                Query.greaterThanEqual("startTime", tenMinutesAgo),
                Query.lessThanEqual("startTime", fiveMinutesFromNow),
                Query.limit(20)
            ]
        );

        console.log(`[Scheduler] Found ${pendingMeetings.total} pending meetings`);

        const results = [];
        const userCache = new Map<string, any>();

        for (const meeting of pendingMeetings.documents as any[]) {
            try {
                console.log(`[Scheduler] Attempting to dispatch bot for meeting: ${meeting.$id} (${meeting.title})`);

                let meetingUser = userCache.get(meeting.userId);
                if (!meetingUser) {
                    try {
                        meetingUser = await databases.getDocument(
                            APPWRITE_IDS.databaseId,
                            APPWRITE_IDS.usersCollectionId,
                            meeting.userId
                        );
                    } catch {
                        meetingUser = {
                            clerkId: meeting.userId,
                            name: meeting.botName || "User",
                        };
                    }
                    userCache.set(meeting.userId, meetingUser);
                }

                const resolvedBotName = resolveAgentBotName(meetingUser);
                
                let botResult;
                let service: "meeting-baas" | "livekit" = "meeting-baas";

                // Only treat as LiveKit if explicitly flagged — avoids misrouting normal https meeting URLs
                const isLiveKit = meeting.meetingUrl?.startsWith("livekit:") ||
                                  meeting.botService === "livekit";

                if (isLiveKit) {
                    const { dispatchLiveKitBot } = await import("@/lib/livekit-bot");
                    
                    const roomName = meeting.meetingUrl.startsWith("livekit:") 
                        ? meeting.meetingUrl.replace("livekit:", "")
                        : meeting.meetingUrl.split("/").pop() || `room-${meeting.$id}`;

                    const config = {
                        roomName,
                        meetingUrl: meeting.meetingUrl,
                        meetingTitle: meeting.title,
                        botName: resolvedBotName,
                        autoTranscribe: true
                    };

                    const result = await dispatchLiveKitBot(config, 1, {
                        meeting_id: meeting.$id,
                        user_id: meeting.userId
                    });
                    
                    botResult = { botId: result.botId };
                    service = "livekit";
                } else {
                    botResult = await dispatchMeetingBot({
                        meetingUrl: meeting.meetingUrl,
                        botName: resolvedBotName,
                    }, {
                        meeting_id: meeting.$id,
                        user_id: meeting.userId
                    });
                }

                // Update meeting record
                await updateDocumentBestEffort(
                    APPWRITE_IDS.databaseId,
                    APPWRITE_IDS.meetingsCollectionId,
                    meeting.$id,
                    {
                        botName: resolvedBotName,
                        botSent: true,
                        botSentAt: new Date().toISOString(),
                        botId: botResult.botId,
                        botService: service,
                        botStatus: "pending",
                        numBotsDispatched: 1,
                        processingStatus: "recording"
                    }
                );

                results.push({
                    meetingId: meeting.$id,
                    success: true,
                    botId: botResult.botId
                });
            } catch (dispatchError) {
                console.error(`[Scheduler] Failed to dispatch for meeting ${meeting.$id}:`, dispatchError);
                results.push({
                    meetingId: meeting.$id,
                    success: false,
                    error: dispatchError instanceof Error ? dispatchError.message : "Dispatch failed"
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results
        });

    } catch (error) {
        console.error("[Scheduler] Fatal error:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
