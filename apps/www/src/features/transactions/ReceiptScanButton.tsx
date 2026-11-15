import type { TransactionDraft } from "@repo/schemas";
import { buttonVariants, cn } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { CameraIcon } from "lucide-react";
import { useId } from "react";
import { FormAlert } from "@/components/FormAlert";
import {
	receiptErrorMessage,
	shrinkPhoto,
} from "@/features/transactions/receipt-photo";
import { localToday } from "@/features/transactions/use-local-today";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface ReceiptScanButtonProps {
	householdId: string;
	/** Called with the draft read on the receipt, and the photo sent. */
	onDraft: (draft: TransactionDraft, photo: Blob) => void | Promise<void>;
}

/**
 * Takes the photo of a receipt (the phone offers its camera or its
 * pictures), shrinks it, and has the assistant read it into a draft. The
 * photo is never kept, by the API or here once the draft is reviewed.
 */
export function ReceiptScanButton({
	householdId,
	onDraft,
}: ReceiptScanButtonProps) {
	const inputId = useId();
	const hintId = useId();
	const scan = useMutation({
		mutationFn: async (file: File) => {
			const photo = await shrinkPhoto(file);
			const draft = await getApi().transactions.draftFromReceipt(householdId, {
				photo,
				today: localToday(),
			});
			return { draft, photo };
		},
		onSuccess: ({ draft, photo }) => onDraft(draft, photo),
	});

	return (
		<div className="grid gap-2">
			{/* The input is the control, its label the button the user sees */}
			<label
				htmlFor={inputId}
				className={cn(
					buttonVariants({ variant: "outline" }),
					"cursor-pointer justify-self-start has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2",
					scan.isPending && "pointer-events-none opacity-50",
				)}
			>
				<CameraIcon aria-hidden />
				{scan.isPending ? m.receipt_scan_pending() : m.receipt_scan_button()}
				<input
					id={inputId}
					type="file"
					accept="image/*"
					className="sr-only"
					aria-describedby={hintId}
					disabled={scan.isPending}
					onChange={(event) => {
						const file = event.currentTarget.files?.[0];
						// The same photo can be chosen again after an error
						event.currentTarget.value = "";
						if (file) {
							scan.mutate(file);
						}
					}}
				/>
			</label>
			<p id={hintId} className="text-muted-foreground text-sm">
				{m.receipt_scan_hint()}
			</p>
			<FormAlert
				message={scan.error ? receiptErrorMessage(scan.error) : undefined}
			/>
		</div>
	);
}
