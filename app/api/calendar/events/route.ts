import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncCalendarMeetingsForUser } from "@/lib/calendar-sync";
import { getOrCreateUser } from "@/lib/user";

export const runtime = "nodejs";

export async function GET(request: Request) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getOrCreateUser(userId);

        const url = new URL(request.url);
        const lookAheadDays = parseInt(url.searchParams.get("days") || "7", 10);

        const result = await syncCalendarMeetingsForUser(user as any, {
            dispatchIfDue: false,
            lookAheadDays,
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
        console.error("Error fetching calendar events:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to fetch calendar events",
            },
            { status: 500 }
        );
    }
}
