export type TranscriptWord = {
    word?: string;
    // MeetingBaas uses start/end (seconds), not startTime/endTime
    start?: number;
    end?: number;
    startTime?: number;
    endTime?: number;
};

export type TranscriptEntry = {
    speaker?: string;
    text?: string;
    startTime?: number;
    endTime?: number;
    words?: TranscriptWord[];
};

type TranscriptEnvelope = {
    entries?: TranscriptEntry[];
    data?: TranscriptEntry[];
    text?: string;
};

export function maybeParseJson<T = unknown>(value: unknown): T | unknown {
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    if (!trimmed) return value;

    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return value;
    }
}

function normalizeEntry(entry: TranscriptEntry | null | undefined): TranscriptEntry | null {
    if (!entry) return null;

    // MeetingBaas sends words as [{word, start, end}]; assemble text from them if entry.text missing
    const wordsText = Array.isArray(entry.words)
        ? entry.words
            .map((w) => (typeof w?.word === "string" ? w.word.trim() : ""))
            .filter(Boolean)
            .join(" ")
        : "";

    const text = typeof entry.text === "string" && entry.text.trim()
        ? entry.text.trim()
        : wordsText;

    if (!text) return null;

    // Derive startTime: entry field OR first word's start/startTime
    let startTime = 0;
    if (typeof entry.startTime === "number") {
        startTime = entry.startTime;
    } else if (Array.isArray(entry.words) && entry.words.length > 0) {
        const first = entry.words[0];
        startTime = typeof first?.start === "number" ? first.start
            : typeof first?.startTime === "number" ? first.startTime : 0;
    }

    let endTime = startTime;
    if (typeof entry.endTime === "number") {
        endTime = entry.endTime;
    } else if (Array.isArray(entry.words) && entry.words.length > 0) {
        const last = entry.words[entry.words.length - 1];
        endTime = typeof last?.end === "number" ? last.end
            : typeof last?.endTime === "number" ? last.endTime : startTime;
    }

    return {
        speaker: typeof entry.speaker === "string" && entry.speaker.trim() ? entry.speaker.trim() : "Speaker",
        text,
        startTime,
        endTime,
        words: Array.isArray(entry.words) ? entry.words : undefined,
    };
}

export function extractTranscriptEntries(transcript: unknown): TranscriptEntry[] {
    if (!transcript) return [];

    const parsed = maybeParseJson<TranscriptEnvelope | TranscriptEntry[]>(transcript);

    if (Array.isArray(parsed)) {
        return parsed
            .map((entry) => normalizeEntry(entry))
            .filter((entry): entry is TranscriptEntry => Boolean(entry));
    }

    if (parsed && typeof parsed === "object" && Array.isArray((parsed as TranscriptEnvelope).entries)) {
        return (parsed as TranscriptEnvelope).entries!
            .map((entry) => normalizeEntry(entry))
            .filter((entry): entry is TranscriptEntry => Boolean(entry));
    }

    if (parsed && typeof parsed === "object" && Array.isArray((parsed as TranscriptEnvelope).data)) {
        return (parsed as TranscriptEnvelope).data!
            .map((entry) => normalizeEntry(entry))
            .filter((entry): entry is TranscriptEntry => Boolean(entry));
    }

    if (parsed && typeof parsed === "object" && typeof (parsed as TranscriptEnvelope).text === "string") {
        return extractTranscriptEntries((parsed as TranscriptEnvelope).text);
    }

    if (typeof transcript === "string") {
        return transcript
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const separator = line.indexOf(":");
                if (separator > 0) {
                    return {
                        speaker: line.slice(0, separator).trim(),
                        text: line.slice(separator + 1).trim(),
                        startTime: 0,
                        endTime: 0,
                    };
                }

                return {
                    speaker: "Speaker",
                    text: line,
                    startTime: 0,
                    endTime: 0,
                };
            });
    }

    return [];
}

export function transcriptToText(transcript: unknown): string {
    const entries = extractTranscriptEntries(transcript);
    if (entries.length > 0) {
        return entries
            .map((entry) => `${entry.speaker || "Speaker"}: ${entry.text || ""}`.trim())
            .filter(Boolean)
            .join("\n");
    }

    if (typeof transcript === "string") {
        return transcript.trim();
    }

    return "";
}

export function collectTranscriptSpeakers(transcript: unknown): string[] {
    return Array.from(
        new Set(
            extractTranscriptEntries(transcript)
                .map((entry) => entry.speaker || "Speaker")
                .filter(Boolean)
        )
    );
}

export function normalizeTranscriptPayload(transcript: unknown) {
    const entries = extractTranscriptEntries(transcript);
    const text = transcriptToText(transcript);
    const serialized = typeof transcript === "string"
        ? transcript
        : JSON.stringify(Array.isArray(transcript) ? transcript : { entries });

    return {
        entries,
        text,
        serialized,
        speakers: collectTranscriptSpeakers(transcript),
    };
}
