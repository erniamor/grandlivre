import { describe, expect, it } from "vitest";
import { detectImageType } from "@/routes/drafts/receipt-photo";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("detectImageType", () => {
	it("tells the image types the assistant reads by their first bytes", () => {
		expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe(
			"image/jpeg",
		);
		expect(
			detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)),
		).toBe("image/png");
		expect(detectImageType(text("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
		expect(detectImageType(text("GIF89a"))).toBe("image/gif");
	});

	it("refuses anything else, whatever its name", () => {
		expect(detectImageType(text("%PDF-1.7"))).toBeNull();
		expect(detectImageType(text("<svg xmlns="))).toBeNull();
		expect(detectImageType(text("RIFF\0\0\0\0WAVE"))).toBeNull();
		expect(detectImageType(bytes())).toBeNull();
	});
});
