import type { TransactionDraft } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import { useId } from "react";
import { FormAlert } from "@/components/FormAlert";
import { TextField } from "@/components/TextField";
import { localToday } from "@/features/transactions/use-local-today";
import { getApi } from "@/lib/api";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface QuickEntryProps {
	householdId: string;
	/** Called with the draft the assistant made of the note, to review. */
	onDraft: (draft: TransactionDraft) => void | Promise<void>;
}

/**
 * A note typed, or dictated with the keyboard's microphone ("gas 72 $
 * yesterday"), turned into a draft transaction by the assistant.
 */
export function QuickEntry({ householdId, onDraft }: QuickEntryProps) {
	const titleId = useId();
	const draft = useMutation({
		mutationFn: (text: string) =>
			// The user's day, which only their device knows
			getApi().transactions.draft(householdId, { text, today: localToday() }),
		onSuccess: onDraft,
	});
	const errors = draft.error ? formErrors(draft.error) : { fields: {} };

	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
		>
			<h2 id={titleId} className="font-medium">
				{m.quick_entry_title()}
			</h2>
			<form
				noValidate
				className="grid gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					draft.mutate(
						String(new FormData(event.currentTarget).get("text") ?? ""),
					);
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
		</section>
	);
}
