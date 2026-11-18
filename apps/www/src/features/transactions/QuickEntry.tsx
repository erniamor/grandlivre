import type { TransactionDraft } from "@repo/schemas";
import { Button, cn, Input, Label } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cardClass } from "@/components/card-styles";
import { FormAlert } from "@/components/FormAlert";
import { HelpHint } from "@/features/help/HelpHint";
import type { ReceiptPhotos } from "@/features/transactions/note-draft";
import { ReceiptScanButton } from "@/features/transactions/ReceiptScanButton";
import { localToday } from "@/features/transactions/use-local-today";
import { useVoiceNote } from "@/features/transactions/use-voice-note";
import { VoiceNoteButton } from "@/features/transactions/VoiceNoteButton";
import { getApi } from "@/lib/api";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface QuickEntryProps {
	householdId: string;
	/**
	 * Called with the draft the assistant made of a note or a receipt, to
	 * review, and the receipt's photo.
	 */
	onDraft: (
		draft: TransactionDraft,
		photos?: ReceiptPhotos,
	) => void | Promise<void>;
}

/**
 * A note typed, or dictated through the microphone beside it, "gas 72 $
 * yesterday", turned into a draft transaction by the assistant; or, apart,
 * the photo of a receipt. What happens to the note, the voice and the photo
 * is told in the "?".
 */
export function QuickEntry({ householdId, onDraft }: QuickEntryProps) {
	const titleId = useId();
	const fieldId = useId();
	const [text, setText] = useState("");
	const field = useRef<HTMLInputElement>(null);
	const draft = useMutation({
		mutationFn: (text: string) =>
			// The user's day, which only their device knows
			getApi().transactions.draft(householdId, { text, today: localToday() }),
		onSuccess: (next) => onDraft(next),
	});
	const voice = useVoiceNote(householdId, (heard) => {
		// After what is already there, to read and correct before sending
		setText((current) =>
			current.trim() ? `${current.trim()} ${heard}` : heard,
		);
		field.current?.focus();
	});
	const errors = draft.error ? formErrors(draft.error) : { fields: {} };
	const error = errors.form ?? Object.values(errors.fields)[0] ?? voice.error;

	return (
		<section aria-labelledby={titleId} className={cn("grid gap-4", cardClass)}>
			<div className="flex items-center gap-1">
				<h2 id={titleId} className="font-heading font-semibold text-lg">
					{m.quick_entry_title()}
				</h2>
				<HelpHint topic="quickEntry" />
			</div>
			<form
				noValidate
				className="grid gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					if (text.trim()) {
						draft.mutate(text);
					}
				}}
			>
				<Label htmlFor={fieldId} className="sr-only">
					{m.quick_entry_label()}
				</Label>
				<div className="flex gap-2">
					<Input
						id={fieldId}
						ref={field}
						name="text"
						autoComplete="off"
						enterKeyHint="go"
						placeholder={m.quick_entry_placeholder()}
						aria-invalid={error ? true : undefined}
						value={text}
						onChange={(event) => setText(event.currentTarget.value)}
						className="flex-1"
					/>
					<VoiceNoteButton voice={voice} />
				</div>
				{/* Says when recording starts, for those who can't see it */}
				<p aria-live="polite" className="sr-only">
					{voice.recording ? m.voice_recording() : ""}
				</p>
				<FormAlert message={error} />
				<Button
					type="submit"
					className="w-full sm:w-auto sm:justify-self-start"
					disabled={text.trim() === "" || draft.isPending}
				>
					<SparklesIcon aria-hidden />
					{draft.isPending ? m.quick_entry_pending() : m.quick_entry_button()}
				</Button>
			</form>
			<div
				aria-hidden
				className="flex items-center gap-3 text-muted-foreground text-xs uppercase"
			>
				<span className="h-px flex-1 bg-border" />
				{m.quick_entry_or()}
				<span className="h-px flex-1 bg-border" />
			</div>
			<ReceiptScanButton householdId={householdId} onDraft={onDraft} />
		</section>
	);
}
