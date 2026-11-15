import { ApiError, ValidationError } from "@repo/resources";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

/**
 * The longest side of a receipt's photo once shrunk, in pixels: enough for
 * the assistant to read it, a few hundred kilobytes to send.
 */
export const RECEIPT_PHOTO_MAX_SIDE = 1600;

/** The size of an image of `width` × `height` fit within `maxSide`, never enlarged. */
export function fitWithin(
	width: number,
	height: number,
	maxSide: number,
): { width: number; height: number } {
	const scale = Math.min(1, maxSide / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

/**
 * The photo redrawn as a JPEG of at most RECEIPT_PHOTO_MAX_SIDE pixels, the
 * right way up: lighter to send, and without its metadata (place, device).
 * A browser that can't decode it sends it as it is: the API says whether
 * it is an image it takes.
 */
export async function shrinkPhoto(photo: Blob): Promise<Blob> {
	if (
		typeof createImageBitmap !== "function" ||
		typeof document === "undefined"
	) {
		return photo;
	}
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(photo, { imageOrientation: "from-image" });
	} catch {
		return photo;
	}
	try {
		const { width, height } = fitWithin(
			bitmap.width,
			bitmap.height,
			RECEIPT_PHOTO_MAX_SIDE,
		);
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) {
			return photo;
		}
		context.drawImage(bitmap, 0, 0, width, height);
		const shrunk = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/jpeg", 0.85),
		);
		return shrunk ?? photo;
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
