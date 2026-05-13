import { processMeetingTranscript } from "@/lib/ai/processor";
import { uploadRecordingFromUrl, uploadTranscriptToS3 } from "@/lib/aws";
import { updateDocumentBestEffort } from "@/lib/appwrite-compat";
import { databases, Query } from "@/lib/appwrite.server";
import { APPWRITE_IDS } from "@/lib/appwrite-config";
import { sendMeetingSummaryEmail } from "@/lib/email-service-free";
import { processTranscriptForRAG as processTranscript } from "@/lib/ai/rag";
import { getBotTranscript } from "@/lib/meeting-baas";
import { normalizeTranscriptPayload } from "@/lib/transcript";
import { incrementMeetingUsage } from "@/lib/usage";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { ID } from "node-appwrite";

export const runtime = "nodejs";

type AnyRecord = Record<string, any>;
const MAX_TRANSCRIPT_ATTRIBUTE_LENGTH = 64000;

function shouldRequireSignature(): boolean {
    if (process.env.WEBHOOK_SIGNATURE_REQUIRED === "true") return true;
    if (process.env.WEBHOOK_SIGNATURE_REQUIRED === "false") return false;
    return process.env.NODE_ENV === "production";
}

function getWebhookSecret(): string {
    return (
        process.env.MEETING_BAAS_WEBHOOK_SECRET ||
        process.env.MEETINGBAAS_WEBHOOK_SECRET ||
        process.env.WEBHOOK_SECRET ||
        ""
    );
}

function getSignatureFromHeader(request: NextRequest): string {
    return (
        request.headers.get("x-webhook-signature") ||
        request.headers.get("x-meeting-baas-signature") ||
        request.headers.get("x-signature") ||
        ""
    ).trim();
}

function normalizeSignature(signature: string): string {
    return signature.startsWith("sha256=") ? signature.slice(7) : signature;
}

function verifyWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
    if (!signatureHeader || !secret) return false;

    const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const receivedHex = normalizeSignature(signatureHeader);

    if (!/^[a-fA-F0-9]+$/.test(receivedHex) || receivedHex.length !== expectedHex.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(receivedHex, "hex"));
}

function toEventType(webhook: AnyRecord): string {
    return String(webhook.event || webhook.type || "").toLowerCase();
}

function toPayload(webhook: AnyRecord): AnyRecord {
    if (webhook.data && typeof webhook.data === "object") return webhook.data;
    return webhook;
}

function extractBotId(payload: AnyRecord): string | undefined {
    const candidates = [payload?.bot_id, payload?.botId, payload?.id, payload?.egress_id];
    return candidates.find((value) => typeof value === "string" && value.trim().length > 0);
}

function extractEventId(webhook: AnyRecord, payload: AnyRecord): string | undefined {
    const candidates = [
        webhook?.event_id,
        webhook?.eventId,
        webhook?.id,
        payload?.event_id,
        payload?.eventId,
        payload?.id,
    ];

    return candidates.find((value) => typeof value === "string" && value.trim().length > 0);
}

function normalizeId(input: string): string {
    return input.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 36);
}

function buildEventKey(eventType: string, botId: string | undefined, eventId: string | undefined, rawBody: string): string {
    if (eventId) return normalizeId(crypto.createHash("sha256").update(eventId).digest("hex"));

    const fingerprint = crypto.createHash("sha256").update(`${eventType}:${botId || "unknown"}:${rawBody}`).digest("hex");
    return normalizeId(fingerprint);
}

async function registerWebhookEvent(params: {
    eventKey: string;
    eventType: string;
    meetingId?: string;
    botId?: string;
}): Promise<{ duplicate: boolean }> {
    const { eventKey, eventType, meetingId, botId } = params;

    try {
        await databases.createDocument(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.webhookEventsCollectionId,
            ID.custom(eventKey),
            {
                meetingId: meetingId || null,
                eventType,
                botId: botId || null,
                receivedAt: new Date().toISOString(),
                status: "received",
            }
        );

        return { duplicate: false };
    } catch (error) {
        const message = String((error as any)?.message || error);
        if (message.toLowerCase().includes("already exists")) {
            return { duplicate: true };
        }

        // Backward compatibility while schema is being rolled out.
        if (
            message.toLowerCase().includes("collection") ||
            message.toLowerCase().includes("not found") ||
            message.toLowerCase().includes("attribute")
        ) {
            console.warn("Webhook event log collection unavailable, continuing with meeting-level dedupe only");
            return { duplicate: false };
        }

        throw error;
    }
}

function extractMeetingId(payload: AnyRecord, webhook: AnyRecord): string | undefined {
    const extra = payload?.extra || webhook?.extra;
    const candidates = [
        payload?.meeting_id,
        payload?.meetingId,
        extra?.meeting_id,
        extra?.meetingId,
        payload?.metadata?.meeting_id,
        webhook?.meeting_id,
        webhook?.meetingId,
    ];
    return candidates.find((value) => typeof value === "string" && value.trim().length > 0);
}

async function findMeetingByBotId(botId: string) {
    const byPrimaryBot = await databases.listDocuments(
        APPWRITE_IDS.databaseId,
        APPWRITE_IDS.meetingsCollectionId,
        [Query.equal("botId", botId), Query.limit(1)]
    );

    if (byPrimaryBot.total > 0) return byPrimaryBot.documents[0] as AnyRecord;

    // Fallback for multi-bot records where the webhook bot id is stored in botIds[]
    const recentMeetings = await databases.listDocuments(
        APPWRITE_IDS.databaseId,
        APPWRITE_IDS.meetingsCollectionId,
        [Query.orderDesc("$updatedAt"), Query.limit(100)]
    );

    const match = recentMeetings.documents.find((doc: AnyRecord) =>
        Array.isArray(doc.botIds) && doc.botIds.includes(botId)
    );

    return (match as AnyRecord) || null;
}

async function resolveMeeting(webhook: AnyRecord, payload: AnyRecord) {
    const meetingId = extractMeetingId(payload, webhook);
    if (meetingId) {
        const byId = await databases.listDocuments(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.meetingsCollectionId,
            [Query.equal("$id", meetingId), Query.limit(1)]
        );

        if (byId.total > 0) {
            return { meeting: byId.documents[0] as AnyRecord, botId: extractBotId(payload) };
        }
    }

    const botId = extractBotId(payload);
    if (!botId) return { meeting: null, botId: undefined };

    const meeting = await findMeetingByBotId(botId);
    return { meeting, botId };
}

function getStoredTranscriptValue(transcript: unknown): string | null {
    const normalized = normalizeTranscriptPayload(transcript);
    if (!normalized.text.trim()) return null;

    const preferred = normalized.serialized.trim();
    if (preferred.length <= MAX_TRANSCRIPT_ATTRIBUTE_LENGTH) {
        return preferred;
    }

    const text = normalized.text.trim();
    if (text.length <= MAX_TRANSCRIPT_ATTRIBUTE_LENGTH) {
        return text;
    }

    return `${text.slice(0, MAX_TRANSCRIPT_ATTRIBUTE_LENGTH - 32)}\n\n[Transcript truncated]`;
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();

        if (shouldRequireSignature()) {
            const secret = getWebhookSecret();
            const signatureHeader = getSignatureFromHeader(request);
            const valid = verifyWebhookSignature(rawBody, signatureHeader, secret);
            if (!valid) {
                return NextResponse.json({ error: "invalid webhook signature" }, { status: 401 });
            }
        }

        const webhook = JSON.parse(rawBody) as AnyRecord;
        const eventType = toEventType(webhook);
        const payload = toPayload(webhook);
        const extractedBotId = extractBotId(payload);
        const eventKey = buildEventKey(eventType, extractedBotId, extractEventId(webhook, payload), rawBody);

        if (eventType === "bot.joined" || eventType === "joined" || eventType === "bot_joined") {
            const { meeting, botId } = await resolveMeeting(webhook, payload);

            if (!botId) {
                return NextResponse.json({ error: "bot id missing from webhook payload" }, { status: 400 });
            }

            if (!meeting) {
                return NextResponse.json({ error: "meeting not found" }, { status: 404 });
            }

            const eventLog = await registerWebhookEvent({
                eventKey,
                eventType,
                meetingId: meeting.$id,
                botId,
            });

            if (eventLog.duplicate || meeting.lastWebhookKey === eventKey) {
                return NextResponse.json({ success: true, duplicate: true, message: "join event already processed", meetingId: meeting.$id });
            }

            await updateDocumentBestEffort(
                APPWRITE_IDS.databaseId,
                APPWRITE_IDS.meetingsCollectionId,
                meeting.$id,
                {
                    botSent: true,
                    botJoinedAt: new Date().toISOString(),
                    botStatus: "in_meeting",
                    lastWebhookKey: eventKey,
                    lastWebhookAt: new Date().toISOString(),
                    processingStatus: "recording",
                }
            );

            return NextResponse.json({
                success: true,
                message: "join status updated",
                meetingId: meeting.$id,
            });
        }

        const isFailureEvent = [
            "failed",
            "bot.failed",
            "bot_failed",
            "error",
            "bot.error",
        ].includes(eventType);

        if (isFailureEvent) {
            const webhookData = payload;
            const { meeting, botId } = await resolveMeeting(webhook, webhookData);

            if (meeting) {
                await updateDocumentBestEffort(
                    APPWRITE_IDS.databaseId,
                    APPWRITE_IDS.meetingsCollectionId,
                    meeting.$id,
                    {
                        botStatus: "failed",
                        processingStatus: "failed",
                        processingError: String(payload?.error || payload?.message || "Bot failed to join or record"),
                        lastWebhookKey: eventKey,
                        lastWebhookAt: new Date().toISOString(),
                    }
                );
            }

            return NextResponse.json({ success: true, message: "failure registered" });
        }

        const isCompletionEvent = [
            "complete",
            "completed",
            "bot.complete",
            "bot.completed",
            "meeting.completed",
            "egress.ended",
            "egress_complete",
        ].includes(eventType);

        if (isCompletionEvent) {
            const webhookData = payload;
            const { meeting, botId } = await resolveMeeting(webhook, webhookData);

            if (!botId) {
                return NextResponse.json({ error: "bot id missing from webhook payload" }, { status: 400 });
            }

            if (!meeting) {
                console.error("meeting not found for bot id:", botId);
                return NextResponse.json({ error: "meeting not found" }, { status: 404 });
            }

            const eventLog = await registerWebhookEvent({
                eventKey,
                eventType,
                meetingId: meeting.$id,
                botId,
            });

            if (
                eventLog.duplicate ||
                meeting.completionEventKey === eventKey ||
                meeting.lastWebhookKey === eventKey
            ) {
                return NextResponse.json({ success: true, duplicate: true, message: "completion event already processed", meetingId: meeting.$id });
            }

            // Get user details from AppWrite
            const userDocs = await databases.listDocuments(
                APPWRITE_IDS.databaseId,
                APPWRITE_IDS.usersCollectionId,
                [Query.equal("$id", meeting.userId), Query.limit(1)]
            );

            const user = userDocs.total > 0 ? (userDocs.documents[0] as AnyRecord) : null;
            const userClerkId = user?.clerkId;
            const userEmail = user?.email;
            const userName = user?.name || "User";
            const completionTime = new Date().toISOString();

            if (!userEmail) {
                console.warn("user email not found for this meeting:", meeting.$id);
            }

            let transcriptPayload = webhookData.transcript ?? null;
            if (!transcriptPayload && botId) {
                try {
                    transcriptPayload = await getBotTranscript(botId);
                } catch (transcriptFetchError) {
                    console.warn("Provider transcript fetch failed:", transcriptFetchError);
                }
            }

            const normalizedTranscript = normalizeTranscriptPayload(transcriptPayload);
            const hasTranscript = Boolean(normalizedTranscript.text.trim());
            const providerRecordingUrl = webhookData.mp4 || webhookData.recording_url || null;

            // Try to upload to object storage; fall back to the raw provider URL so it is never lost.
            let storedRecordingKey: string | null = providerRecordingUrl;
            if (providerRecordingUrl) {
                try {
                    storedRecordingKey = await uploadRecordingFromUrl(meeting.$id, providerRecordingUrl);
                } catch (recordingUploadError) {
                    console.warn("Recording upload skipped, storing raw provider URL:", recordingUploadError);
                    // storedRecordingKey already set to providerRecordingUrl above
                }
            }

            let transcriptStorageKey: string | null = null;
            if (hasTranscript) {
                try {
                    transcriptStorageKey = await uploadTranscriptToS3(meeting.$id, normalizedTranscript.serialized);
                } catch (transcriptUploadError) {
                    console.warn("Transcript upload skipped:", transcriptUploadError);
                }
            }

            await updateDocumentBestEffort(
                APPWRITE_IDS.databaseId,
                APPWRITE_IDS.meetingsCollectionId,
                meeting.$id,
                {
                    meetingEnded: true,
                    transcriptReady: hasTranscript,
                    recordingUrl: storedRecordingKey,
                    transcriptStorageKey,
                    meetingCompletedAt: completionTime,
                    processingStatus: hasTranscript ? "processing" : "completed_no_transcript",
                    processingError: "",
                    botStatus: hasTranscript ? "processing" : "completed",
                    completionEventKey: eventKey,
                    lastWebhookKey: eventKey,
                    lastWebhookAt: completionTime,
                }
            );

            // Exactly-once usage increment using completion marker.
            if (!meeting.usageCountedAt && userClerkId) {
                await incrementMeetingUsage(userClerkId);
                try {
                    await databases.updateDocument(
                        APPWRITE_IDS.databaseId,
                        APPWRITE_IDS.meetingsCollectionId,
                        meeting.$id,
                        { usageCountedAt: completionTime }
                    );
                } catch (usageMarkerError) {
                    console.warn("Failed to persist usageCountedAt marker:", usageMarkerError);
                }
            }

            // Optional enrichment fields may not exist in every Appwrite schema.
            await updateDocumentBestEffort(
                APPWRITE_IDS.databaseId,
                APPWRITE_IDS.meetingsCollectionId,
                meeting.$id,
                {
                    transcript: hasTranscript ? getStoredTranscriptValue(transcriptPayload) : null,
                    speakers: normalizedTranscript.speakers,
                }
            );

            if (hasTranscript && !meeting.processed) {
                try {
                    const processed = await processMeetingTranscript(transcriptPayload);

                    try {
                        if (userEmail) {
                            await sendMeetingSummaryEmail({
                                userEmail,
                                userName,
                                meetingTitle: meeting.title,
                                summary: processed.summary,
                                actionItems: processed.actionItems,
                                meetingId: meeting.$id,
                                meetingDate: new Date(meeting.startTime).toLocaleDateString(),
                            });

                            // Mark email as sent
                            await updateDocumentBestEffort(
                                APPWRITE_IDS.databaseId,
                                APPWRITE_IDS.meetingsCollectionId,
                                meeting.$id,
                                {
                                    emailSent: true,
                                    emailSentAt: new Date().toISOString(),
                                }
                            );
                        }
                    } catch (emailError) {
                        console.error("failed to send the email:", emailError);
                    }

                    // Process transcript for RAG
                    const ragChunkCount = userClerkId
                        ? await processTranscript({
                            meetingId: meeting.$id,
                            userId: userClerkId,
                            transcript: transcriptPayload,
                            meetingTitle: meeting.title
                        })
                        : 0;

                    // Update meeting with processing results
                    const updateData: any = {
                        summary: processed.summary,
                        actionItems: processed.actionItems ?? [],
                        sentiment: processed.sentiment,
                        healthScore: processed.healthScore,
                        topics: processed.topics,
                        processed: true,
                        processedAt: new Date().toISOString(),
                        summaryReadyAt: new Date().toISOString(),
                        ragProcessed: ragChunkCount > 0,
                        ragProcessedAt: ragChunkCount > 0 ? new Date().toISOString() : null,
                        processingStatus: ragChunkCount > 0 ? "completed" : "completed_without_rag",
                        botStatus: "completed",
                    };
                    if (processed.title) {
                        updateData.title = processed.title;
                    }

                    await updateDocumentBestEffort(
                        APPWRITE_IDS.databaseId,
                        APPWRITE_IDS.meetingsCollectionId,
                        meeting.$id,
                        updateData
                    );

                } catch (processingError) {
                    console.error("failed to process the transcript:", processingError);
                    await updateDocumentBestEffort(
                        APPWRITE_IDS.databaseId,
                        APPWRITE_IDS.meetingsCollectionId,
                        meeting.$id,
                        {
                            processed: true,
                            processedAt: new Date().toISOString(),
                            summary: "processing failed. please check the transcript manually.",
                            actionItems: [],
                            ragProcessed: false,
                            ragProcessedAt: null,
                            processingStatus: "failed",
                            processingError: processingError instanceof Error ? processingError.message.slice(0, 1800) : "unknown processing error",
                            botStatus: "failed",
                        }
                    );
                }
            } else if (!hasTranscript) {
                await updateDocumentBestEffort(
                    APPWRITE_IDS.databaseId,
                    APPWRITE_IDS.meetingsCollectionId,
                    meeting.$id,
                    {
                        processed: true,
                        processedAt: completionTime,
                        processingStatus: "completed_no_transcript",
                        processingError: "transcript missing from completion webhook",
                        botStatus: "completed",
                    }
                );
            } else {
                await updateDocumentBestEffort(
                    APPWRITE_IDS.databaseId,
                    APPWRITE_IDS.meetingsCollectionId,
                    meeting.$id,
                    {
                        botStatus: "completed",
                        processingStatus: "completed",
                    }
                );
            }

            return NextResponse.json({
                success: true,
                message: "meeting processed successfully",
                meetingId: meeting.$id,
            });
        }
        return NextResponse.json({
            success: true,
            message: "webhook received",
        });
    } catch (error) {
        console.error("webhook processing error:", error);
        return NextResponse.json({ error: "internal server error" }, { status: 500 });
    }
}
