import { describe, expect, it } from "vitest";
import { ZOOM_LEVELS, zoomIn, zoomOut } from "@/features/photo-edit/photo-zoom";

describe("zoomIn and zoomOut", () => {
	it("goes up and down the levels, from the photo whole", () => {
		expect(ZOOM_LEVELS[0]).toBe(1);
		expect(zoomIn(1)).toBe(1.5);
		expect(zoomIn(2)).toBe(3);
		expect(zoomOut(3)).toBe(2);
		expect(zoomOut(1.5)).toBe(1);
	});

	it("stops at the ends", () => {
		expect(zoomIn(4)).toBe(4);
		expect(zoomOut(1)).toBe(1);
	});
});
