import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { databases, Query } from "@/lib/appwrite.server";
import { APPWRITE_IDS } from "@/lib/appwrite-config";
import { getOrCreateUser } from "@/lib/user";
import { maybeParseJson } from "@/lib/transcript";

export const runtime = "nodejs";

function parseActionItems(raw: unknown, meetingId: string, meetingTitle: string) {
    if (!raw) return [];

    const parsed = maybeParseJson(raw);
    const list: any[] = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "string" && parsed.trim()
            ? [parsed.trim()]
            : [];

    return list
        .map((item: any, idx: number) => {
            const text =
                typeof item === "string"
                    ? item
                    : (item?.text || item?.title || item?.action || "");
            if (!text.trim()) return null;
            return {
                id: `${meetingId}-${idx}`,
                text: text.trim(),
                owner: item?.owner || null,
                dueDate: item?.dueDate || item?.due || null,
                status: item?.status || "new",
                meetingId,
                meetingTitle,
                meetingStartTime: null,
            };
        })
        .filter(Boolean);
}

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await getOrCreateUser(userId);

        const result = await databases.listDocuments(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            [
                Query.equal("userId", user.$id),
                Query.isNotNull("actionItems"),
                Query.orderDesc("startTime"),
                Query.limit(100),
            ]
        );

        const allItems: any[] = [];
        for (const meeting of result.documents as any[]) {
            const items = parseActionItems(meeting.actionItems, meeting.$id, meeting.title || "Untitled");
            items.forEach((item: any) => { item.meetingStartTime = meeting.startTime; });
            allItems.push(...items);
        }

        return NextResponse.json({ success: true, data: allItems });
    } catch (error) {
        console.error("Error fetching action items:", error);
        return NextResponse.json({ error: "Failed to fetch action items" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await getOrCreateUser(userId);
        const { meetingId, itemIndex, status } = await request.json();

        if (!meetingId || itemIndex === undefined || !status) {
            return NextResponse.json({ error: "meetingId, itemIndex and status are required" }, { status: 400 });
        }

        const meeting = await databases.getDocument(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            meetingId
        ) as any;

        if (meeting.userId !== user.$id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const parsed = maybeParseJson(meeting.actionItems);
        const items: any[] = Array.isArray(parsed) ? parsed : [];

        if (itemIndex < 0 || itemIndex >= items.length) {
            return NextResponse.json({ error: "Item index out of range" }, { status: 400 });
        }

        if (typeof items[itemIndex] === "string") {
            items[itemIndex] = { text: items[itemIndex], status };
        } else {
            items[itemIndex] = { ...items[itemIndex], status };
        }

        await databases.updateDocument(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            meetingId,
            { actionItems: JSON.stringify(items) }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating action item:", error);
        return NextResponse.json({ error: "Failed to update action item" }, { status: 500 });
    }
}
