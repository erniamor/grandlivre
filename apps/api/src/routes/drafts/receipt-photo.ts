import type { ReceiptPhoto } from "@/lib/assistant";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
	signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * The image type of a file, told by its first bytes rather than by its name
 * or the type the browser announced; null for anything else.
 */
export function detectImageType(
	bytes: Uint8Array,
): ReceiptPhoto["mediaType"] | null {
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
		return "image/jpeg";
	}
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return "image/png";
	}
	// "RIFF", four bytes of size, "WEBP"
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
	) {
		return "image/webp";
	}
	// "GIF87a" or "GIF89a"
	if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
		return "image/gif";
	}
	return null;
}
