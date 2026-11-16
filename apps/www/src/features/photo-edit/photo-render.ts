import {
	intersect,
	normalizeTurns,
	type Rect,
	relativeTo,
	rotatedSize,
	rotateRect,
	toPixels,
	WHOLE,
} from "@/features/photo-edit/photo-geometry";

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

/** The part of a canvas the rendering uses: a real one, or a fake in tests. */
export interface DrawingCanvas {
	width: number;
	height: number;
	getContext(
		type: "2d",
	): Pick<
		CanvasRenderingContext2D,
		| "drawImage"
		| "fillRect"
		| "fillStyle"
		| "translate"
		| "rotate"
		| "resetTransform"
	> | null;
	toBlob(
		callback: (blob: Blob | null) => void,
		type: string,
		quality: number,
	): void;
}

export interface RenderOptions {
	/** The photo decoded, the right way up. */
	source: CanvasImageSource & { width: number; height: number };
	/** Quarter turns, clockwise, given to the photo before the crop. */
	turns?: number;
	/** The part of the photo kept, on the photo turned. */
	crop?: Rect;
	/** What is hidden, on the photo turned: black, burnt into the pixels. */
	masks?: Rect[];
	/** The longest side of the image sent, in pixels. */
	maxSide: number;
	/** Makes the canvas; a page's own by default. */
	createCanvas?: () => DrawingCanvas;
}

/**
 * The photo to send: turned, cropped, shrunk to `maxSide`, its masks
 * painted black on the pixels themselves, as a JPEG, without the original's
 * metadata (place, device). What is masked isn't anywhere in the file. Null
 * when the browser can't draw.
 */
export async function renderPhoto({
	source,
	turns = 0,
	crop = WHOLE,
	masks = [],
	maxSide,
	createCanvas = () => document.createElement("canvas"),
}: RenderOptions): Promise<Blob | null> {
	const quarter = normalizeTurns(turns);
	// The crop on the photo as it is stored, before it is turned
	const area = toPixels(
		rotateRect(crop, -quarter),
		source.width,
		source.height,
	);
	const kept = rotatedSize(area, quarter);
	const { width, height } = fitWithin(kept.width, kept.height, maxSide);
	const canvas = createCanvas();
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) {
		return null;
	}
	if (quarter === 0) {
		context.drawImage(
			source,
			area.x,
			area.y,
			area.width,
			area.height,
			0,
			0,
			width,
			height,
		);
	} else {
		// Drawn around the canvas's middle, turned: the part kept, the
		// way it lies on the photo stored, fills the canvas once turned
		const drawn = rotatedSize({ width, height }, quarter);
		context.translate(width / 2, height / 2);
		context.rotate((quarter * Math.PI) / 2);
		context.drawImage(
			source,
			area.x,
			area.y,
			area.width,
			area.height,
			-drawn.width / 2,
			-drawn.height / 2,
			drawn.width,
			drawn.height,
		);
		context.resetTransform();
	}
	context.fillStyle = "#000";
	for (const mask of masks) {
		// Only what falls in the crop is in the image
		const inside = intersect(mask, crop);
		if (inside) {
			const pixels = toPixels(relativeTo(inside, crop), width, height);
			context.fillRect(pixels.x, pixels.y, pixels.width, pixels.height);
		}
	}
	return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

/**
 * The photo decoded the right way up, to show and to draw; null when the
 * browser can't decode it (it is then sent as it is).
 */
export async function decodePhoto(photo: Blob): Promise<ImageBitmap | null> {
	if (typeof createImageBitmap !== "function") {
		return null;
	}
	try {
		return await createImageBitmap(photo, { imageOrientation: "from-image" });
	} catch {
		return null;
	}
}
