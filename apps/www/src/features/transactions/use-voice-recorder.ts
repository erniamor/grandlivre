import { useEffect, useRef, useState } from "react";

/** Where a recording stands. */
export type RecorderState =
	| { status: "idle" }
	| { status: "recording"; seconds: number }
	/** The microphone was refused: by the user, or the browser. */
	| { status: "denied" }
	/** No microphone, or the browser couldn't record. */
	| { status: "failed" };

/** The containers to record in, the ones the API takes, the most common first. */
const RECORDING_TYPES = [
	"audio/webm;codecs=opus",
	"audio/webm",
	"audio/mp4",
	"audio/ogg;codecs=opus",
];

/**
 * Whether the browser can record from the microphone: a recorder, and a
 * page served securely (HTTPS, or localhost), without which it has no
 * microphone at all.
 */
export function voiceRecordingSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof window.MediaRecorder !== "undefined" &&
		typeof navigator.mediaDevices?.getUserMedia === "function"
	);
}

/** The first container the browser records in; its own choice otherwise. */
export function recordingType(
	isSupported: (type: string) => boolean,
): string | undefined {
	return RECORDING_TYPES.find((type) => isSupported(type));
}

interface VoiceRecorderOptions {
	/** The recording stops by itself then. */
	maxSeconds: number;
	onRecorded: (audio: Blob) => void;
}

/**
 * Records the microphone, from `start()` to `stop()`, or to `maxSeconds`:
 * the recording is handed to `onRecorded`, and the microphone let go.
 */
export function useVoiceRecorder({
	maxSeconds,
	onRecorded,
}: VoiceRecorderOptions) {
	const [state, setState] = useState<RecorderState>({ status: "idle" });
	const recorder = useRef<MediaRecorder | null>(null);
	const timer = useRef<ReturnType<typeof setInterval> | null>(null);
	const recorded = useRef(onRecorded);
	recorded.current = onRecorded;

	const release = () => {
		if (timer.current) {
			clearInterval(timer.current);
			timer.current = null;
		}
		for (const track of recorder.current?.stream.getTracks() ?? []) {
			track.stop();
		}
		recorder.current = null;
	};

	// The microphone is let go when the page goes, even mid-recording
	useEffect(() => release, []);

	const stop = () => {
		if (recorder.current?.state === "recording") {
			recorder.current.stop();
		}
	};

	const start = async () => {
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (error) {
			setState({
				status:
					error instanceof DOMException && error.name === "NotAllowedError"
						? "denied"
						: "failed",
			});
			return;
		}
		const type = recordingType((candidate) =>
			MediaRecorder.isTypeSupported(candidate),
		);
		const next = new MediaRecorder(
			stream,
			type ? { mimeType: type } : undefined,
		);
		const chunks: Blob[] = [];
		next.addEventListener("dataavailable", (event) => chunks.push(event.data));
		next.addEventListener("stop", () => {
			release();
			setState({ status: "idle" });
			recorded.current(new Blob(chunks, { type: next.mimeType || type }));
		});
		recorder.current = next;
		next.start();
		const startedAt = Date.now();
		setState({ status: "recording", seconds: 0 });
		timer.current = setInterval(() => {
			const seconds = Math.floor((Date.now() - startedAt) / 1000);
			if (seconds >= maxSeconds) {
				stop();
			} else {
				setState({ status: "recording", seconds });
			}
		}, 250);
	};

	return { state, start, stop };
}
