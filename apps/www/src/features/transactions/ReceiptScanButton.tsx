import type { TransactionDraft } from "@repo/schemas";
import {
	cn,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { CameraIcon, ImageIcon } from "lucide-react";
import { type ChangeEvent, useId, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { HelpHint } from "@/features/help/HelpHint";
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
 * Takes the photo of a receipt (the tile opens the phone's camera, a link
 * under it the pictures already taken), lets the member crop it and mask what shouldn't leave the
 * device, then has the assistant read the photo prepared into a draft. The
 * original never leaves the browser; neither is kept, by the API or here
 * once the draft is reviewed.
 */
export function ReceiptScanButton({
	householdId,
	onDraft,
}: ReceiptScanButtonProps) {
	const inputId = useId();
	const galleryId = useId();
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
						turns: edits?.turns,
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

	const pick = async (event: ChangeEvent<HTMLInputElement>) => {
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
	};

	return (
		<div className="grid gap-2">
			<div className="flex items-start gap-2">
				{/* The input is the control, its label the tile the user sees */}
				<label
					htmlFor={inputId}
					className={cn(
						"flex flex-1 cursor-pointer items-center gap-4 rounded-lg border border-border border-dashed p-4 hover:bg-muted",
						"has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2",
						scan.isPending && "pointer-events-none opacity-50",
					)}
				>
					<span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
						<CameraIcon aria-hidden className="size-6" />
					</span>
					<span className="grid gap-0.5">
						<span className="font-medium">
							{scan.isPending
								? m.receipt_scan_pending()
								: m.receipt_scan_button()}
						</span>
						<span className="text-muted-foreground text-sm">
							{m.receipt_scan_subtitle()}
						</span>
					</span>
					<input
						id={inputId}
						type="file"
						accept="image/*"
						// The camera at once: some browsers would open the pictures
						capture="environment"
						className="sr-only"
						aria-label={m.receipt_scan_button()}
						disabled={scan.isPending}
						onChange={pick}
					/>
				</label>
				<HelpHint topic="receiptScan" />
			</div>
			{/* A photo already taken, or a screenshot */}
			<label
				htmlFor={galleryId}
				className={cn(
					"flex w-fit cursor-pointer items-center gap-2 rounded-md text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline",
					"has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2",
					scan.isPending && "pointer-events-none opacity-50",
				)}
			>
				<ImageIcon aria-hidden className="size-4" />
				{m.receipt_scan_choose()}
				<input
					id={galleryId}
					type="file"
					accept="image/*"
					className="sr-only"
					disabled={scan.isPending}
					onChange={pick}
				/>
			</label>
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
