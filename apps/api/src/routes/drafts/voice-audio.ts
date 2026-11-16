import type { AudioType } from "@/lib/transcriber";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
	signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * The container of a recording, told by its first bytes rather than by the
 * type the browser announced: WebM (Chrome, Brave, Firefox), Ogg, MP4
 * (Safari), WAV; null for anything else.
 */
export function detectAudioType(bytes: Uint8Array): AudioType | null {
	// EBML, WebM's header
	if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
		return "audio/webm";
	}
	// "OggS"
	if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) {
		return "audio/ogg";
	}
	// Four bytes of size, then "ftyp"
	if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
		return "audio/mp4";
	}
	// "RIFF", four bytes of size, "WAVE"
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)
	) {
		return "audio/wav";
	}
	return null;
}
