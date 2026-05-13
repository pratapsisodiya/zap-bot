import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { databases, Query } from "@/lib/appwrite.server";
import { APPWRITE_IDS } from "@/lib/appwrite-config";
import { extractTranscriptEntries } from "@/lib/transcript";
import { getOrCreateUser } from "@/lib/user";
import { canUserChat, incrementChatUsage } from "@/lib/usage";
import { answerQuestionWithContext } from "@/lib/ai/processor";

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getOrCreateUser(userId);
        const body = await request.json();
        const { meetingId, prompt } = body;

        if (!meetingId || !prompt) {
            return NextResponse.json({ error: "meetingId and prompt are required" }, { status: 400 });
        }

        const meetingResult = await databases.listDocuments(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            [Query.equal("$id", meetingId), Query.limit(1)]
        );

        if (meetingResult.documents.length === 0) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        const meeting = meetingResult.documents[0] as any;

        if (meeting.userId !== user.$id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const canChatResult = await canUserChat(userId);
        if (!canChatResult.allowed) {
            return NextResponse.json({ error: canChatResult.reason }, { status: 403 });
        }

        await incrementChatUsage(userId);

        const recentContext = extractTranscriptEntries(meeting.transcript)
            .slice(-10)
            .map((e) => `${e.speaker || "Speaker"}: ${e.text || ""}`)
            .join("\n");

        const suggestion = await answerQuestionWithContext({
            question: `Suggest a concise, professional response I can say during this meeting for the following situation: "${prompt}". Give me 2-3 sentence talking points I can use directly.`,
            context: recentContext || meeting.summary || "No transcript available.",
            meetingTitle: meeting.title,
        });

        return NextResponse.json({ success: true, suggestion });
    } catch (error) {
        console.error("Chat suggest error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate suggestion" },
            { status: 500 }
        );
    }
}
