import { VOICE_AUDIO_MAX_BYTES } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { ApiError, type ValidationError } from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const recording = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], {
	type: "audio/webm",
});

describe("transactions.transcribe", () => {
	it("sends a recording as a multipart form, and reads its text", async () => {
		const { api, requests } = fakeApi(200, { text: "Café 4,25 $" });

		expect(
			await api.transactions.transcribe(HOUSEHOLD_ID, { audio: recording }),
		).toEqual({
			text: "Café 4,25 $",
		});
		const [request] = requests;
		expect(request).toMatchObject({
			url: `http://api.test/v1/households/${HOUSEHOLD_ID}/transactions/draft/transcribe`,
			method: "POST",
		});
		// fetch sets the multipart type, with its boundary
		expect(request?.headers["content-type"]).toBeUndefined();
		const sent = (request?.body as FormData | undefined)?.get("audio") as File;
		expect(sent.name).toBe("note");
		expect(sent.size).toBe(4);
	});

	it("checks the recording before sending", async () => {
		const { api, fetch } = fakeApi(200, { text: "" });
		const issuesOf = (audio: Blob) =>
			api.transactions
				.transcribe(HOUSEHOLD_ID, { audio })
				.catch((error: unknown) => (error as ValidationError).issues);

		expect(await issuesOf(new Blob([]))).toEqual([
			{ field: "audio", message: "voice_audio_required" },
		]);
		expect(
			await issuesOf(new Blob([new Uint8Array(VOICE_AUDIO_MAX_BYTES + 1)])),
		).toEqual([{ field: "audio", message: "voice_audio_too_long" }]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("says when dictation is unavailable", async () => {
		const { api } = fakeApi(503, {
			error: { code: "voice_unavailable", message: "Unavailable" },
		});

		const error = await api.transactions
			.transcribe(HOUSEHOLD_ID, { audio: recording })
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 503, code: "voice_unavailable" });
	});
});
