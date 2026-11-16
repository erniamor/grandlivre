import { useState } from "react";
import {
	intersect,
	newMask,
	normalizeTurns,
	type Rect,
	rotateRect,
	WHOLE,
} from "@/features/photo-edit/photo-geometry";

/**
 * What to send: the photo turned by quarter turns (clockwise), its crop and
 * the masks within it, on the photo turned.
 */
export interface PhotoEdits {
	turns: number;
	crop: Rect;
	masks: Rect[];
}

/**
 * The changes made to a photo before it is sent. The crop and the masks are
 * kept in proportions of the whole photo, turned: they turn with it, and a
 * mask left outside the crop is dropped.
 */
export function usePhotoEdits() {
	const [edits, setEdits] = useState<PhotoEdits>({
		turns: 0,
		crop: WHOLE,
		masks: [],
	});

	return {
		edits,
		/** A quarter turn: 1 clockwise, -1 anticlockwise. */
		rotate: (by: 1 | -1) =>
			setEdits(({ turns, crop, masks }) => ({
				turns: normalizeTurns(turns + by),
				crop: rotateRect(crop, by),
				masks: masks.map((mask) => rotateRect(mask, by)),
			})),
		changeCrop: (crop: Rect) =>
			setEdits(({ turns, masks }) => ({
				turns,
				crop,
				// A mask left outside the new frame is no longer in the photo sent
				masks: masks.filter((mask) => intersect(mask, crop)),
			})),
		/** A new mask in the middle of the crop, last of the masks. */
		addMask: () =>
			setEdits((current) => ({
				...current,
				masks: [...current.masks, newMask(current.crop)],
			})),
		changeMask: (index: number, mask: Rect) =>
			setEdits((current) => ({
				...current,
				masks: current.masks.map((each, at) => (at === index ? mask : each)),
			})),
		removeMask: (index: number) =>
			setEdits((current) => ({
				...current,
				masks: current.masks.filter((_, at) => at !== index),
			})),
	};
}
