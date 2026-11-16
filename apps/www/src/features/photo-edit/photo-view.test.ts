import { describe, expect, it } from "vitest";
import { WHOLE } from "@/features/photo-edit/photo-geometry";
import {
	photoPlace,
	placeStyle,
	turnedImageStyle,
	viewAspect,
} from "@/features/photo-edit/photo-view";

/** A photo of a receipt, twice as high as wide. */
const size = { width: 2000, height: 4000 };

describe("viewAspect", () => {
	it("has the shape of the photo, lying down once turned a quarter", () => {
		expect(viewAspect(size, 0, WHOLE)).toBe(0.5);
		expect(viewAspect(size, 1, WHOLE)).toBe(2);
		expect(viewAspect(size, 2, WHOLE)).toBe(0.5);
	});

	it("has the shape of the crop, in pixels", () => {
		// The top half of the photo: as wide as high
		expect(viewAspect(size, 0, { x: 0, y: 0, width: 1, height: 0.5 })).toBe(1);
	});
});

describe("photoPlace", () => {
	it("fills the view with the whole photo", () => {
		expect(photoPlace(WHOLE)).toEqual(WHOLE);
	});

	it("spreads the photo beyond the view, so the crop fills it", () => {
		// The right half, its bottom half
		expect(photoPlace({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 })).toEqual({
			x: -1,
			y: -1,
			width: 2,
			height: 2,
		});
	});
});

describe("placeStyle", () => {
	it("places an element in percent of its parent", () => {
		expect(placeStyle({ x: 0.1, y: 0.25, width: 0.5, height: 0.5 })).toEqual({
			left: "10%",
			top: "25%",
			width: "50%",
			height: "50%",
		});
	});
});

describe("turnedImageStyle", () => {
	it("fills its box with the image as it is", () => {
		expect(turnedImageStyle(size, 0)).toEqual({
			left: "50%",
			top: "50%",
			width: "100%",
			height: "100%",
			transform: "translate(-50%, -50%) rotate(0deg)",
		});
	});

	it("swaps the image's sides in a box lying down, then turns it", () => {
		// The box is 4000 × 2000: the image, 2000 × 4000, is half its width wide
		expect(turnedImageStyle(size, 1)).toEqual({
			left: "50%",
			top: "50%",
			width: "50%",
			height: "200%",
			transform: "translate(-50%, -50%) rotate(90deg)",
		});
		expect(turnedImageStyle(size, -1).transform).toBe(
			"translate(-50%, -50%) rotate(270deg)",
		);
	});
});
