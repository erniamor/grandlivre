import type { TransactionDraft } from "@repo/schemas";
import { Button, cn } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cardClass } from "@/components/card-styles";
import { FormAlert } from "@/components/FormAlert";
import { TextField } from "@/components/TextField";
import type { ReceiptPhotos } from "@/features/transactions/note-draft";
import { ReceiptScanButton } from "@/features/transactions/ReceiptScanButton";
import { localToday } from "@/features/transactions/use-local-today";
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
 * A note typed, or dictated (through the microphone, or the keyboard's),
 * "gas 72 $ yesterday", or the photo of a receipt, turned into a draft
 * transaction by the assistant. A dictated note is read before it is sent.
 */
export function QuickEntry({ householdId, onDraft }: QuickEntryProps) {
	const titleId = useId();
	const [text, setText] = useState("");
	const field = useRef<HTMLInputElement>(null);
	const draft = useMutation({
		mutationFn: (text: string) =>
			// The user's day, which only their device knows
			getApi().transactions.draft(householdId, { text, today: localToday() }),
		onSuccess: (next) => onDraft(next),
	});
	const errors = draft.error ? formErrors(draft.error) : { fields: {} };

	return (
		<section aria-labelledby={titleId} className={cn("grid gap-3", cardClass)}>
			<h2 id={titleId} className="font-medium">
				{m.quick_entry_title()}
			</h2>
			<form
				noValidate
				className="grid gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					draft.mutate(text);
				}}
			>
				<TextField
					label={m.quick_entry_label()}
					name="text"
					autoComplete="off"
					enterKeyHint="go"
					placeholder={m.quick_entry_placeholder()}
					required
					error={errors.fields.text}
					ref={field}
					value={text}
					onChange={(event) => setText(event.currentTarget.value)}
				/>
				<VoiceNoteButton
					householdId={householdId}
					onText={(heard) => {
						// After what is already there, to read and correct before sending
						setText((current) =>
							current.trim() ? `${current.trim()} ${heard}` : heard,
						);
						field.current?.focus();
					}}
				/>
				<p className="text-muted-foreground text-sm">{m.quick_entry_hint()}</p>
				<FormAlert message={errors.form} />
				<Button
					type="submit"
					className="justify-self-start"
					disabled={draft.isPending}
				>
					<SparklesIcon aria-hidden />
					{draft.isPending ? m.quick_entry_pending() : m.quick_entry_button()}
				</Button>
			</form>
			<ReceiptScanButton householdId={householdId} onDraft={onDraft} />
		</section>
	);
}
