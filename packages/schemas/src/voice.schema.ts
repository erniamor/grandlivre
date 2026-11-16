import { z } from "zod";

/** The largest recording taken, in bytes: a minute of speech is far less. */
export const VOICE_AUDIO_MAX_BYTES = 2 * 1024 * 1024;

/** The longest recording, in seconds: the front ends stop there. */
export const VOICE_MAX_SECONDS = 60;

/** A recording turned into text, to read before it becomes a note. */
export const transcriptionSchema = z.object({
	text: z.string(),
});

export type Transcription = z.infer<typeof transcriptionSchema>;
