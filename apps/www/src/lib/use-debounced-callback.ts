import { useEffect, useRef } from "react";

/**
 * `callback`, called only once `delay` milliseconds pass without a new call:
 * the last call's arguments win. A call still waiting when the component
 * goes away is dropped.
 */
export function useDebouncedCallback<Args extends unknown[]>(
	callback: (...args: Args) => void,
	delay: number,
): (...args: Args) => void {
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const latest = useRef(callback);
	latest.current = callback;
	// Synchronizes with the browser's timer: cleared on unmount
	useEffect(() => () => clearTimeout(timer.current), []);
	return (...args: Args) => {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => latest.current(...args), delay);
	};
}
