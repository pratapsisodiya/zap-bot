import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { databases } from "@/lib/appwrite.server";
import { APPWRITE_IDS } from "@/lib/appwrite-config";
import { getOrCreateUser } from "@/lib/user";

export const runtime = "nodejs";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id: meetingId } = await params;
        const { notes } = await request.json();

        if (typeof notes !== "string") {
            return NextResponse.json({ error: "notes must be a string" }, { status: 400 });
        }

        const user = await getOrCreateUser(userId);
        const meeting = await databases.getDocument(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            meetingId
        ) as any;

        if (meeting.userId !== user.$id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await databases.updateDocument(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            meetingId,
            { userNotes: notes.slice(0, 5000) }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving meeting notes:", error);
        return NextResponse.json({ error: "Failed to save notes" }, { status: 500 });
    }
}
