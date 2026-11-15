import { useEffect, useState } from "react";

/**
 * A URL showing `blob` in the page (an `<img>`'s `src`), released when the
 * blob changes or the component goes: the browser keeps the blob in memory
 * as long as its URL lives. Undefined on the server and before the effect.
 */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
	const [url, setUrl] = useState<string>();

	// Synchronizes with the browser's object URLs, an external system
	useEffect(() => {
		if (!blob) {
			setUrl(undefined);
			return;
		}
		const created = URL.createObjectURL(blob);
		setUrl(created);
		return () => URL.revokeObjectURL(created);
	}, [blob]);

	return url;
}
