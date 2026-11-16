import type { Locale } from "@repo/schemas";
import { z } from "zod";
import { env } from "@/env";
import { AppError } from "@/lib/errors";

/** Mistral's Voxtral, pinned: a newer model never changes what members get unseen. */
export const TRANSCRIPTION_MODEL = "voxtral-mini-transcribe-3-0";

const TRANSCRIPTIONS_URL = "https://api.mistral.ai/v1/audio/transcriptions";

/** How long a transcription may take before the member is told to type. */
const TIMEOUT_MS = 30_000;

/** The containers browsers record in. */
export type AudioType = "audio/webm" | "audio/ogg" | "audio/mp4" | "audio/wav";

export interface TranscriptionRequest {
	audio: Uint8Array;
	type: AudioType;
	/** The member's language: told to the model, it hears better. */
	language: Locale;
}

/** Turns a recording into text; replaced in tests, which never call Mistral. */
export interface Transcriber {
	transcribe(request: TranscriptionRequest): Promise<string>;
}

const answerSchema = z.object({ text: z.string() });

function unavailable(): AppError {
	return new AppError(
		503,
		"voice_unavailable",
		"Dictation is unavailable: type the note",
	);
}

const EXTENSIONS: Record<AudioType, string> = {
	"audio/webm": "webm",
	"audio/ogg": "ogg",
	"audio/mp4": "m4a",
	"audio/wav": "wav",
};

/**
 * A transcriber calling Mistral's API over HTTP. The audio is sent, then
 * forgotten: never stored, never logged. A recording Mistral can't decode
 * answers 422; anything else going wrong, 503.
 */
export function createMistralTranscriber(
	apiKey: string,
	fetcher: typeof fetch = fetch,
): Transcriber {
	return {
		async transcribe({ audio, type, language }) {
			const form = new FormData();
			form.set("model", TRANSCRIPTION_MODEL);
			form.set("language", language);
			form.set("file", new Blob([audio], { type }), `note.${EXTENSIONS[type]}`);
			let response: Response;
			try {
				response = await fetcher(TRANSCRIPTIONS_URL, {
					method: "POST",
					headers: { Authorization: `Bearer ${apiKey}` },
					body: form,
					signal: AbortSignal.timeout(TIMEOUT_MS),
				});
			} catch {
				throw unavailable();
			}
			if (response.status === 400) {
				// The recording itself: what Mistral says of it, never its content
				throw new AppError(422, "validation_error", "Invalid request", [
					{ field: "audio", message: "voice_audio_invalid" },
				]);
			}
			if (!response.ok) {
				console.error(`Transcription failed with status ${response.status}`);
				throw unavailable();
			}
			const answer = answerSchema.safeParse(
				await response.json().catch(() => null),
			);
			if (!answer.success) {
				throw unavailable();
			}
			return answer.data.text.trim();
		},
	};
}

/** Without a key: says dictation is unavailable, members type their notes. */
const unavailableTranscriber: Transcriber = {
	async transcribe() {
		throw unavailable();
	},
};

export const transcriber: Transcriber = env.MISTRAL_API_KEY
	? createMistralTranscriber(env.MISTRAL_API_KEY)
	: unavailableTranscriber;
