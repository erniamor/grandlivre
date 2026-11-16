import { describe, expect, it } from "vitest";
import {
	absoluteFrom,
	intersect,
	MIN_SIDE,
	moveRect,
	newMask,
	normalizeTurns,
	relativeTo,
	resizeRect,
	rotatedSize,
	rotateRect,
	toPixels,
	WHOLE,
} from "@/features/photo-edit/photo-geometry";

const mask = { x: 0.2, y: 0.3, width: 0.4, height: 0.1 };

describe("moveRect", () => {
	it("moves a rectangle, never past the photo's edges", () => {
		expect(moveRect(mask, 0.1, -0.1)).toEqual({
			...mask,
			x: expect.closeTo(0.3),
			y: expect.closeTo(0.2),
		});
		expect(moveRect(mask, 5, 5)).toEqual({ ...mask, x: 0.6, y: 0.9 });
		expect(moveRect(mask, -5, -5)).toEqual({ ...mask, x: 0, y: 0 });
	});

	it("keeps a mask within the crop", () => {
		const crop = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };

		expect(moveRect(mask, 1, 1, crop)).toMatchObject({
			x: expect.closeTo(0.2),
			y: expect.closeTo(0.5),
		});
	});
});

describe("resizeRect", () => {
	it("drags a side or a corner, the opposite one staying put", () => {
		expect(resizeRect(mask, "e", 0.1, 0)).toMatchObject({
			x: 0.2,
			width: expect.closeTo(0.5),
		});
		expect(resizeRect(mask, "nw", -0.1, -0.1)).toMatchObject({
			x: expect.closeTo(0.1),
			y: expect.closeTo(0.2),
			width: expect.closeTo(0.5),
			height: expect.closeTo(0.2),
		});
	});

	it("never makes it smaller than its minimum, nor larger than the photo", () => {
		expect(resizeRect(mask, "w", 1, 0).width).toBeCloseTo(MIN_SIDE);
		expect(resizeRect(mask, "s", 0, 5)).toMatchObject({
			y: 0.3,
			height: expect.closeTo(0.7),
		});
	});
});

describe("newMask", () => {
	it("is a band in the middle of the crop", () => {
		const crop = { x: 0.2, y: 0, width: 0.5, height: 1 };

		expect(newMask(crop)).toEqual({
			x: expect.closeTo(0.3),
			y: expect.closeTo(0.46),
			width: expect.closeTo(0.3),
			height: expect.closeTo(0.08),
		});
		expect(newMask(WHOLE).width).toBeCloseTo(0.6);
	});
});

describe("intersect and relativeTo", () => {
	it("finds where a mask falls on the cropped photo", () => {
		const crop = { x: 0.5, y: 0, width: 0.5, height: 1 };

		const inside = intersect(mask, crop);

		expect(inside).toEqual({
			x: 0.5,
			y: 0.3,
			width: expect.closeTo(0.1),
			height: expect.closeTo(0.1),
		});
		expect(relativeTo(inside ?? WHOLE, crop)).toEqual({
			x: 0,
			y: 0.3,
			width: expect.closeTo(0.2),
			height: expect.closeTo(0.1),
		});
		expect(intersect(mask, { x: 0.7, y: 0, width: 0.3, height: 1 })).toBeNull();
	});
});

describe("toPixels", () => {
	it("widens to whole pixels: a mask covers at least what it was drawn over", () => {
		expect(
			toPixels({ x: 0.101, y: 0.25, width: 0.2, height: 0.1 }, 1000, 800),
		).toEqual({
			x: 101,
			y: 200,
			width: 201,
			height: 80,
		});
		expect(toPixels(WHOLE, 1600, 900)).toEqual({
			x: 0,
			y: 0,
			width: 1600,
			height: 900,
		});
	});
});

describe("absoluteFrom", () => {
	it("gives back, on the photo, a rectangle drawn inside a frame", () => {
		const frame = { x: 0.5, y: 0.2, width: 0.5, height: 0.5 };

		expect(
			absoluteFrom({ x: 0.5, y: 0, width: 0.5, height: 1 }, frame),
		).toEqual({ x: 0.75, y: 0.2, width: 0.25, height: 0.5 });
	});

	it("undoes relativeTo", () => {
		const frame = { x: 0.1, y: 0.3, width: 0.6, height: 0.4 };
		const back = absoluteFrom(relativeTo(mask, frame), frame);

		expect(back).toEqual({
			x: expect.closeTo(mask.x),
			y: expect.closeTo(mask.y),
			width: expect.closeTo(mask.width),
			height: expect.closeTo(mask.height),
		});
	});
});

describe("rotateRect", () => {
	// A band along the top of the photo, on its left
	const band = { x: 0, y: 0, width: 0.5, height: 0.1 };

	it("turns a rectangle with the photo, a quarter turn clockwise", () => {
		// The top of the photo becomes its right side
		expect(rotateRect(band, 1)).toEqual({
			x: 0.9,
			y: 0,
			width: 0.1,
			height: 0.5,
		});
	});

	it("turns it anticlockwise, and half a turn", () => {
		// The top becomes the left side, then the bottom
		expect(rotateRect(band, -1)).toEqual({
			x: expect.closeTo(0),
			y: 0.5,
			width: 0.1,
			height: 0.5,
		});
		expect(rotateRect(band, 2)).toEqual({
			x: 0.5,
			y: 0.9,
			width: 0.5,
			height: expect.closeTo(0.1),
		});
	});

	it("comes back where it was after a whole turn, or a turn and back", () => {
		expect(rotateRect(mask, 4)).toEqual(mask);
		const back = rotateRect(rotateRect(mask, 1), -1);
		expect(back).toEqual({
			x: expect.closeTo(mask.x),
			y: expect.closeTo(mask.y),
			width: expect.closeTo(mask.width),
			height: expect.closeTo(mask.height),
		});
	});

	it("leaves the whole photo whole", () => {
		expect(rotateRect(WHOLE, 1)).toEqual(WHOLE);
	});
});

describe("normalizeTurns and rotatedSize", () => {
	it("brings any number of quarter turns back to 0 to 3", () => {
		expect([-1, 0, 4, 5, -6].map(normalizeTurns)).toEqual([3, 0, 0, 1, 2]);
	});

	it("swaps the sides of an image turned by a quarter, not by a half", () => {
		const size = { width: 3000, height: 4000 };

		expect(rotatedSize(size, 1)).toEqual({ width: 4000, height: 3000 });
		expect(rotatedSize(size, -1)).toEqual({ width: 4000, height: 3000 });
		expect(rotatedSize(size, 2)).toEqual(size);
	});
});
