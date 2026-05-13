import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { queryRAG as queryMeetingRAG } from "@/lib/ai/rag";
import { answerQuestionWithContext as answerMeetingQuestion } from "@/lib/ai/processor";
export const dynamic = 'force-dynamic';
import { canUserChat, incrementChatUsage } from "@/lib/usage";

/**
 * POST /api/chat/all
 * Global RAG chat across all user meetings
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getOrCreateUser(userId);
        const body = await request.json();
        const { query, history } = body;

        if (!query) {
            return NextResponse.json({ error: "query is required" }, { status: 400 });
        }

        // Check usage limits
        const canChatResult = await canUserChat(userId);
        if (!canChatResult.allowed) {
            return NextResponse.json({ error: canChatResult.reason }, { status: 403 });
        }

        await incrementChatUsage(userId);

        // Use global RAG search
        const ragResult = await queryMeetingRAG({
            userId: user.$id,
            question: query
        });

        if (ragResult.context) {
            const answer = await answerMeetingQuestion({
                question: query,
                context: ragResult.context,
                meetingTitle: "All Meetings",
                history,
            });
            return NextResponse.json({ success: true, answer, backend: "rag-global" });
        }

        return NextResponse.json({
            success: true,
            answer: "I couldn't find relevant information across your meetings. Please try asking a different question."
        });
    } catch (error) {
        console.error("Chat All Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Chat failed" },
            { status: 500 }
        );
    }
}
