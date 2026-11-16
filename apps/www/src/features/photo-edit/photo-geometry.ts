/**
 * A rectangle on a photo, in proportions of its size: x and width from 0
 * (left) to 1 (right), y and height from 0 (top) to 1 (bottom). The same
 * on the photo shown, whatever its size on screen, and on the photo sent.
 */
export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The whole photo: the crop until the user narrows it. */
export const WHOLE: Rect = { x: 0, y: 0, width: 1, height: 1 };

/** The smallest side of a rectangle, so it stays visible and grabbable. */
export const MIN_SIDE = 0.04;

/** A side or a corner of a rectangle, its compass point. */
export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/** A rectangle moved by (dx, dy), kept whole within `bounds`. */
export function moveRect(
	rect: Rect,
	dx: number,
	dy: number,
	bounds: Rect = WHOLE,
): Rect {
	return {
		...rect,
		x: clamp(rect.x + dx, bounds.x, bounds.x + bounds.width - rect.width),
		y: clamp(rect.y + dy, bounds.y, bounds.y + bounds.height - rect.height),
	};
}

/**
 * A rectangle with one of its sides or corners dragged by (dx, dy): the
 * opposite side stays put, it never gets smaller than MIN_SIDE, nor leaves
 * `bounds`.
 */
export function resizeRect(
	rect: Rect,
	handle: Handle,
	dx: number,
	dy: number,
	bounds: Rect = WHOLE,
): Rect {
	let left = rect.x;
	let top = rect.y;
	let right = rect.x + rect.width;
	let bottom = rect.y + rect.height;
	if (handle.includes("w")) {
		left = clamp(left + dx, bounds.x, right - MIN_SIDE);
	}
	if (handle.includes("e")) {
		right = clamp(right + dx, left + MIN_SIDE, bounds.x + bounds.width);
	}
	if (handle.includes("n")) {
		top = clamp(top + dy, bounds.y, bottom - MIN_SIDE);
	}
	if (handle.includes("s")) {
		bottom = clamp(bottom + dy, top + MIN_SIDE, bounds.y + bounds.height);
	}
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** A new mask, in the middle of the crop: a band, the shape of a line of text. */
export function newMask(crop: Rect): Rect {
	const width = Math.max(MIN_SIDE, crop.width * 0.6);
	const height = Math.max(MIN_SIDE, crop.height * 0.08);
	return {
		x: crop.x + (crop.width - width) / 2,
		y: crop.y + (crop.height - height) / 2,
		width,
		height,
	};
}

/** Where two rectangles overlap, or null when they don't. */
export function intersect(a: Rect, b: Rect): Rect | null {
	const left = Math.max(a.x, b.x);
	const top = Math.max(a.y, b.y);
	const right = Math.min(a.x + a.width, b.x + b.width);
	const bottom = Math.min(a.y + a.height, b.y + b.height);
	return right > left && bottom > top
		? { x: left, y: top, width: right - left, height: bottom - top }
		: null;
}

/**
 * `rect` as seen inside `frame`, in proportions of the frame: where a mask
 * falls on the cropped photo.
 */
export function relativeTo(rect: Rect, frame: Rect): Rect {
	return {
		x: (rect.x - frame.x) / frame.width,
		y: (rect.y - frame.y) / frame.height,
		width: rect.width / frame.width,
		height: rect.height / frame.height,
	};
}

/** The inverse of `relativeTo`: a rectangle given inside `frame`, in proportions of the photo. */
export function absoluteFrom(rect: Rect, frame: Rect): Rect {
	return {
		x: frame.x + rect.x * frame.width,
		y: frame.y + rect.y * frame.height,
		width: rect.width * frame.width,
		height: rect.height * frame.height,
	};
}

/** A number of quarter turns, clockwise, brought back to 0, 1, 2 or 3. */
export function normalizeTurns(turns: number): number {
	return ((turns % 4) + 4) % 4;
}

/**
 * A rectangle on the photo, where it falls once the photo is turned by
 * `turns` quarter turns, clockwise (negative: anticlockwise). The crop and
 * the masks turn with the photo, so nothing drawn is lost.
 */
export function rotateRect(rect: Rect, turns: number): Rect {
	let turned = rect;
	for (let turn = 0; turn < normalizeTurns(turns); turn++) {
		// A quarter turn clockwise: the left side becomes the top
		turned = {
			x: 1 - turned.y - turned.height,
			y: turned.x,
			width: turned.height,
			height: turned.width,
		};
	}
	return turned;
}

/** The size of an image once turned by `turns` quarter turns. */
export function rotatedSize(
	size: { width: number; height: number },
	turns: number,
): { width: number; height: number } {
	return normalizeTurns(turns) % 2 === 0
		? size
		: { width: size.height, height: size.width };
}

/**
 * A rectangle in pixels of an image of `width` × `height`, widened to whole
 * pixels: a mask always covers at least what it was drawn over.
 */
export function toPixels(
	rect: Rect,
	width: number,
	height: number,
): { x: number; y: number; width: number; height: number } {
	const left = Math.max(0, Math.floor(rect.x * width));
	const top = Math.max(0, Math.floor(rect.y * height));
	const right = Math.min(width, Math.ceil((rect.x + rect.width) * width));
	const bottom = Math.min(height, Math.ceil((rect.y + rect.height) * height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}
