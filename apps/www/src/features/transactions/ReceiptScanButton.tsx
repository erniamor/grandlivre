import type { TransactionDraft } from "@repo/schemas";
import {
	buttonVariants,
	cn,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { CameraIcon } from "lucide-react";
import { useId, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import {
	PhotoEditor,
	type PhotoEdits,
} from "@/features/photo-edit/PhotoEditor";
import { decodePhoto, renderPhoto } from "@/features/photo-edit/photo-render";
import type { ReceiptPhotos } from "@/features/transactions/note-draft";
import {
	RECEIPT_PHOTO_MAX_SIDE,
	receiptErrorMessage,
} from "@/features/transactions/receipt-photo";
import { localToday } from "@/features/transactions/use-local-today";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface ReceiptScanButtonProps {
	householdId: string;
	/** Called with the draft read on the receipt, and its photos: sent and taken. */
	onDraft: (
		draft: TransactionDraft,
		photos: ReceiptPhotos,
	) => void | Promise<void>;
}

/** A photo chosen, decoded, being prepared. */
interface Editing {
	file: File;
	bitmap: ImageBitmap;
}

/**
 * Takes the photo of a receipt (the phone offers its camera or its
 * pictures), lets the member crop it and mask what shouldn't leave the
 * device, then has the assistant read the photo prepared into a draft. The
 * original never leaves the browser; neither is kept, by the API or here
 * once the draft is reviewed.
 */
export function ReceiptScanButton({
	householdId,
	onDraft,
}: ReceiptScanButtonProps) {
	const inputId = useId();
	const hintId = useId();
	const [editing, setEditing] = useState<Editing | null>(null);
	const close = () => {
		editing?.bitmap.close();
		setEditing(null);
	};
	const scan = useMutation({
		mutationFn: async ({
			file,
			bitmap,
			edits,
		}: {
			file: File;
			bitmap?: ImageBitmap;
			edits?: PhotoEdits;
		}) => {
			// A photo the browser can't decode goes as it is: the API says
			// whether it takes it
			const sent =
				(bitmap &&
					(await renderPhoto({
						source: bitmap,
						crop: edits?.crop,
						masks: edits?.masks,
						maxSide: RECEIPT_PHOTO_MAX_SIDE,
					}))) ||
				file;
			const draft = await getApi().transactions.draftFromReceipt(householdId, {
				photo: sent,
				today: localToday(),
			});
			return { draft, photos: { sent, original: file } };
		},
		onSuccess: ({ draft, photos }) => {
			close();
			return onDraft(draft, photos);
		},
	});
	const error = scan.error ? receiptErrorMessage(scan.error) : undefined;

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
					onChange={async (event) => {
						const file = event.currentTarget.files?.[0];
						// The same photo can be chosen again after an error
						event.currentTarget.value = "";
						if (!file) {
							return;
						}
						scan.reset();
						const bitmap = await decodePhoto(file);
						if (bitmap) {
							setEditing({ file, bitmap });
						} else {
							scan.mutate({ file });
						}
					}}
				/>
			</label>
			<p id={hintId} className="text-muted-foreground text-sm">
				{m.receipt_scan_hint()}
			</p>
			{!editing && <FormAlert message={error} />}
			<Dialog open={editing !== null} onOpenChange={(open) => !open && close()}>
				<DialogContent className="max-h-[95vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{m.photo_editor_title()}</DialogTitle>
						<DialogDescription>
							{m.photo_editor_description()}
						</DialogDescription>
					</DialogHeader>
					{editing && (
						<PhotoEditor
							photo={editing.file}
							size={{
								width: editing.bitmap.width,
								height: editing.bitmap.height,
							}}
							sending={scan.isPending}
							error={error}
							onSend={(edits) =>
								scan.mutate({
									file: editing.file,
									bitmap: editing.bitmap,
									edits,
								})
							}
							onCancel={close}
						/>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
