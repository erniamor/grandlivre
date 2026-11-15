import type { DraftWarning, TransactionDraft } from "@repo/schemas";
import { SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { m } from "@/paraglide/messages";

interface AssistantNotesProps {
	draft: TransactionDraft;
}

const warningMessages: Record<DraftWarning, () => string> = {
	receipt_total_mismatch: m.draft_warning_receipt_total_mismatch,
};

/** What the assistant says about its draft: its remark, then what to check. */
export function AssistantNotes({ draft }: AssistantNotesProps) {
	return (
		<>
			{draft.remark && (
				<p className="flex gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
					<SparklesIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
					<span>{m.assistant_remark({ remark: draft.remark })}</span>
				</p>
			)}
			{draft.warnings.map((warning) => (
				<p
					key={warning}
					className="flex gap-2 rounded-lg border border-destructive/50 p-3 text-sm"
				>
					<TriangleAlertIcon
						aria-hidden
						className="mt-0.5 size-4 shrink-0 text-destructive"
					/>
					<span>{warningMessages[warning]()}</span>
				</p>
			))}
		</>
	);
}
