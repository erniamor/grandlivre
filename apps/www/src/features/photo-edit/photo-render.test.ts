import { describe, expect, it } from "vitest";
import {
	type DrawingCanvas,
	decodePhoto,
	fitWithin,
	renderPhoto,
} from "@/features/photo-edit/photo-render";

/** A canvas that records what is drawn on it, and gives a blob of its size. */
function fakeCanvas() {
	const calls: unknown[][] = [];
	const context = {
		fillStyle: "",
		drawImage: (...args: unknown[]) =>
			calls.push(["drawImage", ...args.slice(1)]),
		fillRect: (...args: unknown[]) =>
			calls.push(["fillRect", context.fillStyle, ...args]),
	};
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => context,
		toBlob: (callback: (blob: Blob | null) => void, type: string) =>
			callback(new Blob([`${canvas.width}x${canvas.height}`], { type })),
	};
	return { canvas: canvas as unknown as DrawingCanvas, calls };
}

/** A photo of a receipt, 4000 pixels high. */
const photo = { width: 2000, height: 4000 } as unknown as CanvasImageSource & {
	width: number;
	height: number;
};

describe("fitWithin", () => {
	it("shrinks the longest side to the limit, keeping the proportions", () => {
		expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
		expect(fitWithin(1000, 6000, 1600)).toEqual({ width: 267, height: 1600 });
	});

	it("never enlarges a small image", () => {
		expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
	});
});

describe("renderPhoto", () => {
	it("shrinks the whole photo as a JPEG", async () => {
		const { canvas, calls } = fakeCanvas();

		const blob = await renderPhoto({
			source: photo,
			maxSide: 1600,
			createCanvas: () => canvas,
		});

		expect(blob?.type).toBe("image/jpeg");
		expect(await blob?.text()).toBe("800x1600");
		expect(calls).toEqual([["drawImage", 0, 0, 2000, 4000, 0, 0, 800, 1600]]);
	});

	it("keeps only the crop, and paints the masks black on it", async () => {
		const { canvas, calls } = fakeCanvas();

		await renderPhoto({
			source: photo,
			// The right half
			crop: { x: 0.5, y: 0, width: 0.5, height: 1 },
			masks: [
				// Across the crop's edge: only its part inside
				{ x: 0.25, y: 0.5, width: 0.5, height: 0.1 },
				// Outside the crop: nothing
				{ x: 0, y: 0, width: 0.2, height: 0.2 },
			],
			maxSide: 1600,
			createCanvas: () => canvas,
		});

		// 1000 × 4000 pixels kept, shrunk to 400 × 1600
		expect(calls).toEqual([
			["drawImage", 1000, 0, 1000, 4000, 0, 0, 400, 1600],
			["fillRect", "#000", 0, 800, 200, 160],
		]);
	});

	it("gives nothing when the browser can't draw", async () => {
		const canvas = { ...fakeCanvas().canvas, getContext: () => null };

		expect(
			await renderPhoto({
				source: photo,
				maxSide: 1600,
				createCanvas: () => canvas,
			}),
		).toBeNull();
	});
});

describe("decodePhoto", () => {
	it("gives nothing for what the browser can't decode", async () => {
		expect(await decodePhoto(new Blob(["not an image"]))).toBeNull();
	});
});
