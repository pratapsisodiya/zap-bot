import { databases, Query } from "@/lib/appwrite.server";
import { APPWRITE_IDS } from "@/lib/appwrite-config";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getObjectStorageProvider, isRecordingStoredInR2 } from "@/lib/aws";
import { getOrCreateUser } from "@/lib/user";

function detectPlatformFromUrl(url?: string): string {
    if (!url) return "unknown";
    
    if (url.includes("meet.google.com")) return "google_meet";
    if (url.includes("zoom.us")) return "zoom";
    if (url.includes("teams.microsoft.com")) return "microsoft_teams";
    if (url.includes("webex.com")) return "webex";
    
    return "other";
}

export async function GET(request: Request) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const source = searchParams.get("source") || "all";
        const query = searchParams.get("q")?.trim() || "";

        const user = await getOrCreateUser(userId);

        // Get upcoming meetings (next 30 days) that don't have recordings yet
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const now = new Date();

        // AppWrite doesn't support complex OR queries like Prisma, so we fetch and filter
        const queries: string[] = [
            Query.equal("userId", user.$id),
            Query.greaterThanEqual("startTime", now.toISOString()),
            Query.lessThanEqual("startTime", thirtyDaysFromNow.toISOString()),
            Query.orderAsc("startTime"),
            Query.limit(100),
        ];

        const result = await databases.listDocuments(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            queries
        );

        let upcomingRecordings = result.documents.filter((m: any) => m.recordingUrl == null);
        if (source === "calendar") {
            upcomingRecordings = upcomingRecordings.filter((m: any) => m.isFromCalendar === true);
        }
        if (source === "manual") {
            upcomingRecordings = upcomingRecordings.filter((m: any) => m.isFromCalendar !== true);
        }

        // Apply text search filter manually since AppWrite doesn't support OR/contains
        if (query) {
            const q = query.toLowerCase();
            upcomingRecordings = upcomingRecordings.filter((m: any) =>
                (m.title || "").toLowerCase().includes(q) ||
                (m.meetingUrl || "").toLowerCase().includes(q)
            );
        }

        // Take first 10
        upcomingRecordings = upcomingRecordings.slice(0, 10);

        function resolveStatus(m: any): string {
            const s = String(m.botStatus || "").toLowerCase().trim();
            if (["pending","joining","in_meeting","recording","processing","completed","failed"].includes(s)) return s;
            if (m.botSent) return "joining";
            if (m.botScheduled) return "pending";
            return "pending";
        }

        // Transform data to include platform detection
        const transformedRecordings = upcomingRecordings.map((meeting: any) => ({
            $id: meeting.$id,
            id: meeting.$id,
            title: meeting.title,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            meetingUrl: meeting.meetingUrl,
            attendees: meeting.attendees,
            botScheduled: meeting.botScheduled,
            botSent: meeting.botSent,
            botId: meeting.botId,
            botJoinedAt: meeting.botJoinedAt,
            recordingUrl: meeting.recordingUrl,
            isFromCalendar: meeting.isFromCalendar,
            platform: detectPlatformFromUrl(meeting.meetingUrl || undefined),
            joinedConfirmed: Boolean(meeting.botJoinedAt),
            botStatus: resolveStatus(meeting),
            objectStorageProvider: getObjectStorageProvider(),
            recordingStoredInR2: isRecordingStoredInR2(meeting.recordingUrl),
            participants: Array.isArray(meeting.attendees)
                ? meeting.attendees.map((a: any) => typeof a === 'string' ? a : a.email || '')
                : [],
        }));

        return NextResponse.json(
            {
                success: true,
                data: transformedRecordings,
                meta: {
                    source,
                    query,
                    count: transformedRecordings.length,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching upcoming recordings:", error);
        return NextResponse.json(
            { error: "Failed to fetch upcoming recordings" },
            { status: 500 }
        );
    }
}
