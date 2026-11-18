import { Button } from "@repo/ui";
import { LoaderIcon, MicIcon, SquareIcon } from "lucide-react";
import { WithTooltip } from "@/components/WithTooltip";
import type { VoiceNote } from "@/features/transactions/use-voice-note";
import { m } from "@/paraglide/messages";

interface VoiceNoteButtonProps {
	voice: VoiceNote;
}

/** "0:07": a duration, in minutes and seconds. */
const clock = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * The microphone beside the note: an icon to start dictating, the time
 * running in red while it records, then a spinner while the recording is
 * transcribed. Nothing where the browser can't record.
 */
export function VoiceNoteButton({ voice }: VoiceNoteButtonProps) {
	if (!voice.supported) {
		return null;
	}
	if (voice.recording) {
		const time = clock(voice.seconds);
		return (
			<Button
				type="button"
				variant="destructive"
				aria-label={m.voice_stop({ time })}
				onClick={voice.toggle}
			>
				<SquareIcon aria-hidden />
				<span className="tabular-nums">{time}</span>
			</Button>
		);
	}
	const label = voice.transcribing ? m.voice_transcribing() : m.voice_start();
	return (
		<WithTooltip label={label}>
			<Button
				type="button"
				variant="outline"
				size="icon"
				aria-label={label}
				disabled={voice.transcribing}
				onClick={voice.toggle}
			>
				{voice.transcribing ? (
					<LoaderIcon aria-hidden className="animate-spin" />
				) : (
					<MicIcon aria-hidden />
				)}
			</Button>
		</WithTooltip>
	);
}
