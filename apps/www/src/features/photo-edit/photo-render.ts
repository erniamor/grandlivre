import {
	intersect,
	type Rect,
	relativeTo,
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
		"drawImage" | "fillRect" | "fillStyle"
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
	/** The part of the photo kept. */
	crop?: Rect;
	/** What is hidden: black, burnt into the pixels. */
	masks?: Rect[];
	/** The longest side of the image sent, in pixels. */
	maxSide: number;
	/** Makes the canvas; a page's own by default. */
	createCanvas?: () => DrawingCanvas;
}

/**
 * The photo to send: cropped, shrunk to `maxSide`, its masks painted black
 * on the pixels themselves, as a JPEG, without the original's metadata
 * (place, device). What is masked isn't anywhere in the file. Null when the
 * browser can't draw.
 */
export async function renderPhoto({
	source,
	crop = WHOLE,
	masks = [],
	maxSide,
	createCanvas = () => document.createElement("canvas"),
}: RenderOptions): Promise<Blob | null> {
	const area = toPixels(crop, source.width, source.height);
	const { width, height } = fitWithin(area.width, area.height, maxSide);
	const canvas = createCanvas();
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) {
		return null;
	}
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
