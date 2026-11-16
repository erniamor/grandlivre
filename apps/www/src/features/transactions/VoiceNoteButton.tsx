import { VOICE_MAX_SECONDS } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { MicIcon, SquareIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import {
	useVoiceRecorder,
	voiceRecordingSupported,
} from "@/features/transactions/use-voice-recorder";
import { getApi } from "@/lib/api";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface VoiceNoteButtonProps {
	householdId: string;
	/** Called with what was heard, to add to the note. */
	onText: (text: string) => void;
}

/** "0:07": a duration, in minutes and seconds. */
const clock = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Dictates a note through the microphone: a press records, another stops
 * (or a minute does), then the recording is transcribed and the text handed
 * over, to read before it is drafted. Shown only where the browser records.
 */
export function VoiceNoteButton({ householdId, onText }: VoiceNoteButtonProps) {
	const hintId = useId();
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
	if (!supported) {
		return null;
	}
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

	return (
		<div className="grid gap-2">
			<Button
				type="button"
				variant={recording ? "destructive" : "outline"}
				className="justify-self-start"
				aria-describedby={hintId}
				disabled={transcribe.isPending}
				onClick={() => {
					if (recording) {
						recorder.stop();
					} else {
						transcribe.reset();
						recorder.start();
					}
				}}
			>
				{recording ? <SquareIcon aria-hidden /> : <MicIcon aria-hidden />}
				{recording
					? m.voice_stop({ time: clock(state.seconds) })
					: transcribe.isPending
						? m.voice_transcribing()
						: m.voice_start()}
			</Button>
			{/* Says when recording starts and stops, for those who can't see it */}
			<p aria-live="polite" className="sr-only">
				{recording ? m.voice_recording() : ""}
			</p>
			<p id={hintId} className="text-muted-foreground text-sm">
				{m.voice_privacy()}
			</p>
			<FormAlert message={error} />
		</div>
	);
}
