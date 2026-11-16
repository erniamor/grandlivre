import {
	type Locale,
	type Transcription,
	VOICE_AUDIO_MAX_BYTES,
} from "@repo/schemas";
import { AppError } from "@/lib/errors";
import { createRateLimiter } from "@/lib/rate-limit";
import { transcriber } from "@/lib/transcriber";
import type { Viewer } from "@/routes/accounts/accounts.service";
import { detectAudioType } from "@/routes/drafts/voice-audio";

/** Recordings a member may have transcribed per hour: far above any real use. */
export const VOICE_PER_HOUR = 60;

export const voiceLimiter = createRateLimiter({
	limit: VOICE_PER_HOUR,
	windowMs: 60 * 60 * 1000,
});

/**
 * A note dictated through the microphone, as text to read before it is
 * drafted. The audio is read in memory, sent to Mistral and forgotten:
 * never stored, never logged.
 */
export async function transcribeNote(
	viewer: Viewer,
	{ audio }: { audio: File },
	language: Locale,
): Promise<Transcription> {
	if (audio.size > VOICE_AUDIO_MAX_BYTES) {
		throw new AppError(413, "payload_too_large", "The recording is too long");
	}
	const bytes = new Uint8Array(await audio.arrayBuffer());
	const type = detectAudioType(bytes);
	if (!type) {
		throw new AppError(422, "validation_error", "Invalid request", [
			{ field: "audio", message: "voice_audio_invalid" },
		]);
	}
	if (!voiceLimiter.consume(viewer.userId)) {
		throw new AppError(
			429,
			"too_many_requests",
			"Too many in the last hour: type the note or try again later",
		);
	}
	const text = await transcriber.transcribe({ audio: bytes, type, language });
	if (text === "") {
		throw new AppError(422, "voice_not_understood", "Nothing was heard");
	}
	return { text };
}
