import { ApiError, ValidationError } from "@repo/resources";
import { decodePhoto, renderPhoto } from "@/features/photo-edit/photo-render";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

/**
 * The longest side of a receipt's photo once shrunk, in pixels: enough for
 * the assistant to read it, a few hundred kilobytes to send.
 */
export const RECEIPT_PHOTO_MAX_SIDE = 1600;

/**
 * The photo redrawn as a JPEG of at most RECEIPT_PHOTO_MAX_SIDE pixels, the
 * right way up: lighter to send, and without its metadata (place, device).
 * A browser that can't decode it sends it as it is: the API says whether
 * it is an image it takes.
 */
export async function shrinkPhoto(photo: Blob): Promise<Blob> {
	if (typeof document === "undefined") {
		return photo;
	}
	const bitmap = await decodePhoto(photo);
	if (!bitmap) {
		return photo;
	}
	try {
		return (
			(await renderPhoto({
				source: bitmap,
				maxSide: RECEIPT_PHOTO_MAX_SIDE,
			})) ?? photo
		);
	} finally {
		bitmap.close();
	}
}

/** What to tell the member when a receipt couldn't be turned into a draft. */
export function receiptErrorMessage(error: unknown): string {
	if (error instanceof ApiError && error.code === "draft_not_understood") {
		return m.error_receipt_not_understood();
	}
	if (error instanceof ApiError && error.status === 413) {
		return m.error_receipt_photo_too_large();
	}
	const { form, fields } = formErrors(error);
	if (error instanceof ValidationError && fields.photo) {
		return fields.photo;
	}
	return form ?? Object.values(fields)[0] ?? m.error_generic();
}
