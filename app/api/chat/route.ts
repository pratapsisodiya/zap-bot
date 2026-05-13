import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { databases, Query } from "@/lib/appwrite.server";
import { APPWRITE_IDS } from "@/lib/appwrite-config";
import { getOrCreateUser } from "@/lib/user";
import { queryRAG as queryMeetingRAG } from "@/lib/ai/rag";
import { answerQuestionWithContext as answerMeetingQuestion } from "@/lib/ai/processor";
import { transcriptToText } from "@/lib/transcript";
export const dynamic = 'force-dynamic';
import { canUserChat, incrementChatUsage } from "@/lib/usage";

function buildLocalSuggestionFallback(query: string, snippets: string[]): string {
    const context = snippets.slice(0, 2).join(" ").slice(0, 180);
    return [
        "Suggested response:",
        `"Based on what we discussed, ${context || "we should align on scope, owner, and next step"}."`,
        "",
        "Follow-up to ask:",
        `"Should we lock owner + deadline for ${query}?"`,
    ].join("\n");
}

/**
 * POST /api/chat
 * Ask a question about a specific meeting using RAG
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getOrCreateUser(userId);
        const body = await request.json();
        const { meetingId, query, history } = body;

        if (!meetingId || !query) {
            return NextResponse.json({ error: "meetingId and query are required" }, { status: 400 });
        }

        const meetingDocs = await databases.listDocuments(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            [Query.equal("$id", meetingId), Query.limit(1)]
        );
        const meeting = meetingDocs.documents[0] as any;

        if (!meeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        if (meeting.userId !== user.$id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Check usage limits
        const canChatResult = await canUserChat(userId);
        if (!canChatResult.allowed) {
            return NextResponse.json({ error: canChatResult.reason }, { status: 403 });
        }

        await incrementChatUsage(userId);

        try {
            // Use RAG to get context
            const ragResult = await queryMeetingRAG({
                userId: user.$id,
                question: query,
                meetingId
            });
            
            if (ragResult.context) {
                const answer = await answerMeetingQuestion({
                    question: query,
                    context: ragResult.context,
                    meetingTitle: meeting.title,
                    history,
                });
                return NextResponse.json({ success: true, answer, backend: "rag" });
            }

            // Fallback to transcript
            const transcriptText = transcriptToText(meeting.transcript);

            const answer = await answerMeetingQuestion({
                question: query,
                context: transcriptText || meeting.summary || "No transcript available",
                meetingTitle: meeting.title,
                history,
            });
            return NextResponse.json({ success: true, answer, backend: "transcript-fallback" });
        } catch (error) {
            console.error("Chat Error:", error);
            return NextResponse.json({
                success: true,
                answer: `(Fallback) Based on the meeting: ${meeting.summary || "No summary available."}`
            });
        }
    } catch (error) {
        console.error("Chat error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Chat failed" },
            { status: 500 }
        );
    }
}
