/**
 * The text of a statement file. Banks export in UTF-8 or in Windows-1252
 * (Desjardins' account statements, with their accents): UTF-8 is tried
 * first, strictly, so a Windows-1252 file never passes for it.
 */
export function decodeStatement(bytes: Uint8Array): string {
	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		text = new TextDecoder("windows-1252").decode(bytes);
	}
	// A byte order mark isn't part of the first field
	return text.startsWith("﻿") ? text.slice(1) : text;
}
