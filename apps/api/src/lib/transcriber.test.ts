import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
	createMistralTranscriber,
	TRANSCRIPTION_MODEL,
} from "@/lib/transcriber";

const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]);

/** A fetch answering `status` with `body`, which records what it was sent. */
function fakeFetch(status: number, body: unknown) {
	return vi.fn(
		async (_url: string | URL | Request, _init?: RequestInit) =>
			new Response(typeof body === "string" ? body : JSON.stringify(body), {
				status,
				headers: { "Content-Type": "application/json" },
			}),
	);
}

const transcribeWith = (fetcher: ReturnType<typeof fakeFetch>) =>
	createMistralTranscriber(
		"key-for-tests",
		fetcher as unknown as typeof fetch,
	).transcribe({
		audio,
		type: "audio/webm",
		language: "fr",
	});

describe("createMistralTranscriber", () => {
	it("sends the recording to Mistral's transcriptions, with the model and the language", async () => {
		const fetcher = fakeFetch(200, {
			text: "  Épicerie chez Costco, 82,40 $, hier. ",
		});

		expect(await transcribeWith(fetcher)).toBe(
			"Épicerie chez Costco, 82,40 $, hier.",
		);
		const [url, init] = fetcher.mock.calls[0] ?? [];
		expect(url).toBe("https://api.mistral.ai/v1/audio/transcriptions");
		expect(init).toMatchObject({
			method: "POST",
			headers: { Authorization: "Bearer key-for-tests" },
		});
		const form = init?.body as FormData;
		expect(form.get("model")).toBe(TRANSCRIPTION_MODEL);
		expect(form.get("language")).toBe("fr");
		const file = form.get("file") as File;
		expect(file.name).toBe("note.webm");
		expect(file.type).toBe("audio/webm");
		expect(new Uint8Array(await file.arrayBuffer())).toEqual(audio);
	});

	it("says a recording Mistral can't decode is invalid", async () => {
		const error = await transcribeWith(
			fakeFetch(400, { message: "Audio input could not be decoded." }),
		).catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(AppError);
		expect(error).toMatchObject({
			status: 422,
			details: [{ field: "audio", message: "voice_audio_invalid" }],
		});
	});

	it("says dictation is unavailable when Mistral fails, answers oddly, or can't be reached", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const unreachable = vi.fn(async () => {
			throw new TypeError("fetch failed");
		});

		for (const fetcher of [
			fakeFetch(500, { message: "Internal error" }),
			fakeFetch(401, { message: "Unauthorized" }),
			fakeFetch(200, { transcript: "not the expected shape" }),
			fakeFetch(200, "not json"),
			unreachable as unknown as ReturnType<typeof fakeFetch>,
		]) {
			await expect(transcribeWith(fetcher)).rejects.toMatchObject({
				status: 503,
				code: "voice_unavailable",
			});
		}
		vi.restoreAllMocks();
	});
});
