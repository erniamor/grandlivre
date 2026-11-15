interface RateLimiterOptions {
	/** Requests allowed in a window. */
	limit: number;
	windowMs: number;
	now?: () => number;
}

/**
 * Counts each key's requests over a sliding window, in this process's
 * memory: with several instances of the API, each counts its own. Enough to
 * cap a cost, not to enforce an exact quota.
 */
export function createRateLimiter({
	limit,
	windowMs,
	now = Date.now,
}: RateLimiterOptions) {
	const hits = new Map<string, number[]>();

	return {
		/** Counts a request; false when the key is over its limit (not counted then). */
		consume(key: string): boolean {
			const time = now();
			const recent = (hits.get(key) ?? []).filter(
				(hit) => time - hit < windowMs,
			);
			if (recent.length >= limit) {
				hits.set(key, recent);
				return false;
			}
			recent.push(time);
			hits.set(key, recent);
			return true;
		},
		reset(): void {
			hits.clear();
		},
	};
}
