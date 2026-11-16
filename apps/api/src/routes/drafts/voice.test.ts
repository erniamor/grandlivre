import type { Transcription } from "@repo/schemas";
import { VOICE_AUDIO_MAX_BYTES } from "@repo/schemas";
import { json } from "@test/helpers/api";
import { WEB_ORIGIN } from "@test/helpers/auth";
import {
	createTestHousehold,
	signInUser,
	type TestUser,
} from "@test/helpers/households";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "@/app";
import { AppError } from "@/lib/errors";
import { transcriber } from "@/lib/transcriber";
import { VOICE_PER_HOUR, voiceLimiter } from "@/routes/drafts/voice.service";

beforeEach(() => {
	voiceLimiter.reset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** The first bytes of a WebM recording, as a browser makes it. */
const WEBM = new Uint8Array([
	0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 1,
]);

async function setUp() {
	const alice = await signInUser("alice@example.com");
	const carol = await signInUser("carol@example.com");
	const household = await createTestHousehold(alice.cookie);
	/** Sends a recording as the browser does: a multipart form. */
	const dictate = (
		user: TestUser | undefined,
		audio: Blob | null = new Blob([WEBM], { type: "audio/webm" }),
		language = "fr-CA,fr;q=0.9",
	) => {
		const form = new FormData();
		if (audio) {
			form.set("audio", audio, "note.webm");
		}
		return app.request(
			`/v1/households/${household.id}/transactions/draft/transcribe`,
			{
				method: "POST",
				headers: {
					Origin: WEB_ORIGIN,
					"Accept-Language": language,
					...(user ? { Cookie: user.cookie } : {}),
				},
				body: form,
			},
		);
	};
	return { alice, carol, dictate };
}

/** Mistral hears `text`, whatever the recording; its requests are recorded. */
const hears = (text: string | Error) =>
	vi.spyOn(transcriber, "transcribe").mockImplementation(async () => {
		if (text instanceof Error) {
			throw text;
		}
		return text;
	});

describe("POST /v1/households/:householdId/transactions/draft/transcribe", () => {
	it("turns a recording into text, in the member's language, saving nothing", async () => {
		const { alice, dictate } = await setUp();
		const transcribe = hears("Épicerie chez Costco, 82,40 $, hier.");

		const response = await dictate(alice);

		expect(response.status).toBe(200);
		expect(await json<Transcription>(response)).toEqual({
			text: "Épicerie chez Costco, 82,40 $, hier.",
		});
		expect(transcribe).toHaveBeenCalledWith({
			audio: WEBM,
			type: "audio/webm",
			language: "fr",
		});
	});

	it("takes what browsers record, told by its first bytes, and nothing else", async () => {
		const { alice, dictate } = await setUp();
		const transcribe = hears("Café");
		const types = [
			[[0x4f, 0x67, 0x67, 0x53, 0], "audio/ogg"],
			[[0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x4d], "audio/mp4"],
			[
				[0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45],
				"audio/wav",
			],
		] as const;

		for (const [bytes] of types) {
			expect(
				(await dictate(alice, new Blob([new Uint8Array(bytes)]))).status,
			).toBe(200);
		}
		const notAudio = await dictate(
			alice,
			new Blob(["not a recording"], { type: "audio/webm" }),
		);

		expect(transcribe.mock.calls.map(([request]) => request.type)).toEqual(
			types.map(([, type]) => type),
		);
		expect(notAudio.status).toBe(422);
		expect(await notAudio.json()).toMatchObject({
			error: { details: [{ field: "audio", message: "voice_audio_invalid" }] },
		});
		expect(transcribe).toHaveBeenCalledTimes(3);
	});

	it("refuses no recording, or one too long", async () => {
		const { alice, dictate } = await setUp();
		const transcribe = hears("Café");

		const missing = await dictate(alice, null);
		const tooLong = await dictate(
			alice,
			new Blob([WEBM, new Uint8Array(VOICE_AUDIO_MAX_BYTES)], {
				type: "audio/webm",
			}),
		);

		expect(missing.status).toBe(422);
		expect(await missing.json()).toMatchObject({
			error: { details: [{ field: "audio", message: "voice_audio_required" }] },
		});
		expect(tooLong.status).toBe(413);
		expect(transcribe).not.toHaveBeenCalled();
	});

	it("says when nothing was heard, or dictation is unavailable", async () => {
		const { alice, dictate } = await setUp();

		hears("");
		const silence = await dictate(alice);
		vi.restoreAllMocks();
		hears(new AppError(503, "voice_unavailable", "Unavailable"));
		const unavailable = await dictate(alice);

		expect(silence.status).toBe(422);
		expect(await silence.json()).toMatchObject({
			error: { code: "voice_not_understood" },
		});
		expect(unavailable.status).toBe(503);
		expect(await unavailable.json()).toMatchObject({
			error: { code: "voice_unavailable" },
		});
	});

	it("limits the recordings a member has transcribed in an hour", async () => {
		const { alice, dictate } = await setUp();
		hears("Café");
		for (let used = 0; used < VOICE_PER_HOUR; used++) {
			voiceLimiter.consume(alice.id);
		}

		const response = await dictate(alice);

		expect(response.status).toBe(429);
	});

	it("hides the household from outsiders and requires a session", async () => {
		const { carol, dictate } = await setUp();
		const transcribe = hears("Café");

		expect((await dictate(carol)).status).toBe(404);
		expect((await dictate(undefined)).status).toBe(401);
		expect(transcribe).not.toHaveBeenCalled();
	});
});
