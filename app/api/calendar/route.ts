import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncCalendarMeetingsForUser } from "@/lib/calendar-sync";
import { getOrCreateUser } from "@/lib/user";

export const runtime = "nodejs";

export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getOrCreateUser(userId);
        const result = await syncCalendarMeetingsForUser(user as any, {
            dispatchIfDue: false,
        });

        return NextResponse.json({
            success: true,
            connected: result.connected,
            data: result.data,
            meta: {
                synced: result.synced,
                botsDispatched: result.botsDispatched,
                meetingIds: result.meetingIds,
            },
        });
    } catch (error) {
        console.error("Error fetching calendar meetings:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch calendar meetings" },
            { status: 500 }
        );
    }
}

export async function POST() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getOrCreateUser(userId);
        const result = await syncCalendarMeetingsForUser(user as any, {
            dispatchIfDue: true,
        });

        return NextResponse.json({
            success: true,
            connected: result.connected,
            data: result.data,
            meta: {
                synced: result.synced,
                botsDispatched: result.botsDispatched,
                meetingIds: result.meetingIds,
            },
        });
    } catch (error) {
        console.error("Calendar sync error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Calendar sync failed" },
            { status: 500 }
        );
    }
}
