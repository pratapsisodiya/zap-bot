import { APPWRITE_IDS } from "@/lib/appwrite-config";
import { updateDocumentBestEffort } from "@/lib/appwrite-compat";
import { resolveAgentBotName } from "@/lib/bot-name";
import { databases, ID, Query } from "@/lib/appwrite.server";
import {
    fetchFromGoogleCalendar,
    GoogleCalendarEvent,
    UserWithTokens,
} from "@/lib/google-calendar";
import { findDuplicateMeetingCandidate } from "@/lib/meeting-agent";
import { detectMeetingPlatform, dispatchMeetingBot } from "@/lib/meeting-baas";
import { canUserSendBot } from "@/lib/usage";

type CalendarSyncUser = UserWithTokens & {
    $id: string;
    clerkId: string;
    name?: string | null;
    email?: string | null;
    botName?: string | null;
    autoJoinMeetings?: boolean | null;
};

export type CalendarMeetingItem = {
    id: string;
    title: string;
    start: string;
    end: string;
    meetingUrl?: string | null;
    attendees: string[];
    organizer?: string;
    platform: string;
    botScheduled: boolean;
    botSent: boolean;
    joinedConfirmed: boolean;
    calendarSyncAt?: string | null;
    isFromCalendar: boolean;
};

export type CalendarSyncResult = {
    connected: boolean;
    data: CalendarMeetingItem[];
    synced: number;
    botsDispatched: number;
    meetingIds: string[];
};

type SyncOptions = {
    lookAheadDays?: number;
    sourceCalendarId?: string;
    dispatchIfDue?: boolean;
    dispatchWindowMinutes?: number;
};

function extractMeetingUrl(event: GoogleCalendarEvent): string | null {
    const meetingUrl =
        event.hangoutLink ||
        event.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.uri)?.uri ||
        null;

    if (meetingUrl) return meetingUrl;

    if (!event.description) return null;

    const match = event.description.match(
        /(https?:\/\/[^\s]+(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|webex\.com)[^\s]*)/i
    );

    return match?.[1] || null;
}

function getEventStart(event: GoogleCalendarEvent): Date | null {
    const raw = event.start?.dateTime || event.start?.date;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getEventEnd(event: GoogleCalendarEvent, startTime: Date): Date {
    const raw = event.end?.dateTime || event.end?.date;
    if (!raw) {
        return new Date(startTime.getTime() + 60 * 60 * 1000);
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= startTime.getTime()) {
        return new Date(startTime.getTime() + 60 * 60 * 1000);
    }

    return parsed;
}

function normalizeAttendees(event: GoogleCalendarEvent): string[] {
    return Array.isArray(event.attendees)
        ? event.attendees
            .map((attendee) => attendee.email?.trim() || "")
            .filter(Boolean)
        : [];
}

function shouldDispatchMeeting(startTime: Date, windowMinutes: number): boolean {
    const now = Date.now();
    const dispatchBoundary = now + windowMinutes * 60 * 1000;
    const lowerBoundary = now - 15 * 60 * 1000; // Do not dispatch if meeting started more than 15 mins ago
    return startTime.getTime() <= dispatchBoundary && startTime.getTime() >= lowerBoundary;
}

async function findExistingMeeting(userId: string, eventId: string, meetingUrl: string, startTime: Date) {
    try {
        const bySourceId = await databases.listDocuments(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            [
                Query.equal("userId", userId),
                Query.equal("sourceEventId", eventId),
                Query.limit(1),
            ]
        );

        if (bySourceId.total > 0) {
            return bySourceId.documents[0] as any;
        }
    } catch (error) {
        console.warn("Calendar sync sourceEventId lookup skipped:", error);
    }

    const duplicate = await findDuplicateMeetingCandidate({
        userId,
        meetingUrl,
        startTime,
    });

    if (!duplicate?.id) return null;

    try {
        const byId = await databases.getDocument(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            duplicate.id
        );
        return byId as any;
    } catch {
        return null;
    }
}

function serializeMeetingForCalendar(doc: any): CalendarMeetingItem {
    return {
        id: doc.$id,
        title: doc.title || "Untitled Meeting",
        start: doc.startTime,
        end: doc.endTime,
        meetingUrl: doc.meetingUrl || null,
        attendees: Array.isArray(doc.attendees) ? doc.attendees : [],
        organizer: doc.organizer || undefined,
        platform: detectMeetingPlatform(doc.meetingUrl || ""),
        botScheduled: Boolean(doc.botScheduled),
        botSent: Boolean(doc.botSent),
        joinedConfirmed: Boolean(doc.botJoinedAt),
        calendarSyncAt: doc.calendarSyncAt || null,
        isFromCalendar: true,
    };
}

export async function syncCalendarMeetingsForUser(
    user: CalendarSyncUser,
    options: SyncOptions = {}
): Promise<CalendarSyncResult> {
    const lookAheadDays = options.lookAheadDays ?? 7;
    const sourceCalendarId = options.sourceCalendarId ?? "primary";
    const dispatchIfDue = options.dispatchIfDue === true;
    const dispatchWindowMinutes = options.dispatchWindowMinutes ?? 5;

    if (!user.calendarConnected) {
        return {
            connected: false,
            data: [] as CalendarMeetingItem[],
            synced: 0,
            botsDispatched: 0,
            meetingIds: [] as string[],
        };
    }

    const now = new Date();
    const timeMax = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);
    const calendarResponse = await fetchFromGoogleCalendar(user, now, timeMax);

    if (!calendarResponse) {
        return {
            connected: false,
            data: [] as CalendarMeetingItem[],
            synced: 0,
            botsDispatched: 0,
            meetingIds: [] as string[],
        };
    }

    const resolvedBotName = resolveAgentBotName(user);
    const items: CalendarMeetingItem[] = [];
    const meetingIds: string[] = [];
    let botsDispatched = 0;

    for (const event of calendarResponse.items || []) {
        const meetingUrl = extractMeetingUrl(event);
        const startTime = getEventStart(event);

        if (!meetingUrl || !startTime || !event.id) {
            continue;
        }

        const endTime = getEventEnd(event, startTime);
        const attendees = normalizeAttendees(event);
        const eventTitle = (event.summary || "Calendar Meeting").trim();
        const description = event.description?.trim() || "";
        const syncTimestamp = new Date().toISOString();
        const existing = await findExistingMeeting(user.$id, event.id, meetingUrl, startTime);

        let meetingDoc = existing;

        const basePayload = {
            userId: user.$id,
            title: eventTitle,
            meetingUrl,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            description,
            botScheduled: existing ? Boolean(existing.botScheduled) : user.autoJoinMeetings !== false,
            botSent: existing ? Boolean(existing.botSent) : false,
            meetingEnded: existing ? Boolean(existing.meetingEnded) : false,
            transcriptReady: existing ? Boolean(existing.transcriptReady) : false,
            processed: existing ? Boolean(existing.processed) : false,
            ragProcessed: existing ? Boolean(existing.ragProcessed) : false,
        };

        if (existing) {
            meetingDoc = await databases.updateDocument(
                APPWRITE_IDS.databaseId,
                APPWRITE_IDS.meetingsCollectionId,
                existing.$id,
                basePayload
            );
        } else {
            meetingDoc = await databases.createDocument(
                APPWRITE_IDS.databaseId,
                APPWRITE_IDS.meetingsCollectionId,
                ID.unique(),
                basePayload
            );
        }

        await updateDocumentBestEffort(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            meetingDoc.$id,
            {
                attendees,
                isFromCalendar: true,
                organizer: attendees[0] || user.email || null,
                sourceEventId: event.id,
                calendarEventId: event.id,
                sourceCalendarId,
                calendarSyncAt: syncTimestamp,
                botName: resolvedBotName,
            }
        );

        if (
            dispatchIfDue &&
            meetingDoc.botSent !== true &&
            meetingDoc.botScheduled === true &&
            shouldDispatchMeeting(startTime, dispatchWindowMinutes)
        ) {
            const canSendResult = await canUserSendBot(user.clerkId);
            if (canSendResult.allowed) {
                try {
                    const botResult = await dispatchMeetingBot(
                        {
                            meetingUrl,
                            meetingTitle: eventTitle,
                            startTime,
                            endTime,
                            botName: resolvedBotName,
                        },
                        {
                            meeting_id: meetingDoc.$id,
                            user_id: user.$id,
                        }
                    );

                    await updateDocumentBestEffort(
                        APPWRITE_IDS.databaseId,
                        APPWRITE_IDS.meetingsCollectionId,
                        meetingDoc.$id,
                        {
                            botId: botResult.botId,
                            botService: "meetingbaas",
                            botStatus: "pending",
                            numBotsDispatched: 1,
                            botSent: true,
                            botSentAt: new Date().toISOString(),
                            processingStatus: "recording",
                        }
                    );

                    meetingDoc.botId = botResult.botId;
                    meetingDoc.botSent = true;
                    meetingDoc.botSentAt = new Date().toISOString();
                    meetingDoc.botService = "meetingbaas";
                    botsDispatched += 1;
                } catch (error) {
                    console.error(`Failed to dispatch bot for calendar event ${event.id}:`, error);
                    await updateDocumentBestEffort(
                        APPWRITE_IDS.databaseId,
                        APPWRITE_IDS.meetingsCollectionId,
                        meetingDoc.$id,
                        {
                            botStatus: "failed",
                            processingStatus: "failed",
                            processingError: error instanceof Error ? error.message.slice(0, 1800) : "Bot dispatch failed",
                        }
                    );
                }
            }
        }

        items.push(
            serializeMeetingForCalendar({
                ...meetingDoc,
                attendees,
                calendarSyncAt: syncTimestamp,
                botName: resolvedBotName,
            })
        );
        meetingIds.push(meetingDoc.$id);
    }

    return {
        connected: true,
        data: items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
        synced: items.length,
        botsDispatched,
        meetingIds,
    };
}
