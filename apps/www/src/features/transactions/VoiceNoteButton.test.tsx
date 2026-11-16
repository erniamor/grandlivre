import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickEntry } from "@/features/transactions/QuickEntry";
import { base, household } from "@/features/transactions/transaction-test-data";
import { recordingType } from "@/features/transactions/use-voice-recorder";
import { type ApiRequest, type ApiResponse, mockApi } from "@/test/mock-api";
import { renderWithQueryClient } from "@/test/render-with-router";

vi.mock("@/lib/api", () => ({ getApi: vi.fn() }));

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/**
 * A browser that records: a microphone whose track is let go, and a
 * recorder making a WebM recording of a few bytes when it stops.
 */
function fakeBrowser({ refused = false } = {}) {
	const track = { stop: vi.fn() };
	const stream = { getTracks: () => [track] };
	const getUserMedia = vi.fn(async () => {
		if (refused) {
			throw new DOMException("Refused", "NotAllowedError");
		}
		return stream;
	});
	vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
	class FakeRecorder extends EventTarget {
		static isTypeSupported = (type: string) => type.startsWith("audio/webm");
		state: "inactive" | "recording" = "inactive";
		mimeType: string;
		constructor(
			readonly stream: unknown,
			options?: { mimeType?: string },
		) {
			super();
			this.mimeType = options?.mimeType ?? "";
		}
		start() {
			this.state = "recording";
		}
		stop() {
			this.state = "inactive";
			const data = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], {
				type: this.mimeType,
			});
			this.dispatchEvent(Object.assign(new Event("dataavailable"), { data }));
			this.dispatchEvent(new Event("stop"));
		}
	}
	vi.stubGlobal("MediaRecorder", FakeRecorder);
	return { track, getUserMedia };
}

function setUp(
	response: ApiResponse = {
		status: 200,
		body: { text: "Café 4,25 $ ce matin" },
	},
) {
	const requests = mockApi((request) =>
		request.path === `${base}/transactions/draft/transcribe`
			? response
			: undefined,
	);
	renderWithQueryClient(
		<QuickEntry householdId={household.id} onDraft={vi.fn()} />,
	);
	return { user: userEvent.setup(), requests };
}

const transcriptions = (requests: ApiRequest[]) =>
	requests.filter((request) => request.path.endsWith("/draft/transcribe"));

describe("dictating a note through the microphone", () => {
	it("records, stops, and adds what was heard to the note, to read before sending", async () => {
		const { track } = fakeBrowser();
		const { user, requests } = setUp();
		const note = screen.getByLabelText("Describe the transaction");
		await user.type(note, "Hier :");

		await user.click(await screen.findByRole("button", { name: "Dictate" }));
		expect(
			screen.getByText("Recording: press again to stop."),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Stop · 0:00" }));

		await vi.waitFor(() =>
			expect(note).toHaveValue("Hier : Café 4,25 $ ce matin"),
		);
		expect(note).toHaveFocus();
		expect(track.stop).toHaveBeenCalled();
		const [transcription] = transcriptions(requests);
		const sent = (transcription?.body as FormData | undefined)?.get(
			"audio",
		) as File;
		expect(sent.type).toBe("audio/webm;codecs=opus");
		// Nothing drafted before the user sends it
		expect(
			requests.filter((request) =>
				request.path.endsWith("/transactions/draft"),
			),
		).toEqual([]);
	});

	it("stops by itself after a minute", async () => {
		fakeBrowser();
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
		const { requests } = setUp();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

		await user.click(await screen.findByRole("button", { name: "Dictate" }));
		await vi.advanceTimersByTimeAsync(30_000);
		expect(screen.getByRole("button", { name: "Stop · 0:30" })).toBeVisible();
		await vi.advanceTimersByTimeAsync(30_000);

		await vi.waitFor(() => expect(transcriptions(requests)).toHaveLength(1));
	});

	it("says when the microphone is refused, or dictation is unavailable", async () => {
		fakeBrowser({ refused: true });
		const { user } = setUp();

		await user.click(await screen.findByRole("button", { name: "Dictate" }));

		expect(
			await screen.findByText(
				"The microphone is blocked: allow it for this site in your browser, or type the note.",
			),
		).toBeVisible();
	});

	it("says when the transcription is unavailable", async () => {
		fakeBrowser();
		const { user } = setUp({
			status: 503,
			body: { error: { code: "voice_unavailable", message: "Unavailable" } },
		});

		await user.click(await screen.findByRole("button", { name: "Dictate" }));
		await user.click(screen.getByRole("button", { name: /^Stop/ }));

		expect(
			await screen.findByText(
				"Dictation is unavailable for now: type the note.",
			),
		).toBeVisible();
	});

	it("shows no microphone where the browser can't record", async () => {
		vi.stubGlobal("MediaRecorder", undefined);
		setUp();

		await screen.findByLabelText("Describe the transaction");
		expect(
			screen.queryByRole("button", { name: "Dictate" }),
		).not.toBeInTheDocument();
	});
});

describe("recordingType", () => {
	it("records in WebM where it can, MP4 for Safari, else the browser's choice", () => {
		expect(recordingType(() => true)).toBe("audio/webm;codecs=opus");
		expect(recordingType((type) => type === "audio/mp4")).toBe("audio/mp4");
		expect(recordingType(() => false)).toBeUndefined();
	});
});
