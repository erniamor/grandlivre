import { VOICE_MAX_SECONDS } from "@repo/schemas";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	useVoiceRecorder,
	voiceRecordingSupported,
} from "@/features/transactions/use-voice-recorder";
import { getApi } from "@/lib/api";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

/** Where a dictated note stands, and what to do next. */
export interface VoiceNote {
	/** The browser records: false on the server, and where it can't. */
	supported: boolean;
	recording: boolean;
	/** How long it has been recording. */
	seconds: number;
	transcribing: boolean;
	/** Why the last dictation failed, in words. */
	error: string | undefined;
	/** Starts recording, or stops and transcribes. */
	toggle: () => void;
}

/**
 * Dictates a note through the microphone: a press records, another stops
 * (or a minute does), then the recording is transcribed and the text handed
 * over, to read before it is drafted.
 */
export function useVoiceNote(
	householdId: string,
	onText: (text: string) => void,
): VoiceNote {
	// What the browser can do is known once in it, never on the server
	const [supported, setSupported] = useState(false);
	useEffect(() => setSupported(voiceRecordingSupported()), []);
	const transcribe = useMutation({
		mutationFn: (audio: Blob) =>
			getApi().transactions.transcribe(householdId, { audio }),
		onSuccess: ({ text }) => onText(text),
	});
	const recorder = useVoiceRecorder({
		maxSeconds: VOICE_MAX_SECONDS,
		onRecorded: (audio) => transcribe.mutate(audio),
	});
	const { state } = recorder;
	const recording = state.status === "recording";
	const error =
		state.status === "denied"
			? m.voice_denied()
			: state.status === "failed"
				? m.voice_failed()
				: transcribe.error
					? (formErrors(transcribe.error).form ??
						Object.values(formErrors(transcribe.error).fields)[0])
					: undefined;

	return {
		supported,
		recording,
		seconds: recording ? state.seconds : 0,
		transcribing: transcribe.isPending,
		error,
		toggle: () => {
			if (recording) {
				recorder.stop();
			} else {
				transcribe.reset();
				recorder.start();
			}
		},
	};
}
