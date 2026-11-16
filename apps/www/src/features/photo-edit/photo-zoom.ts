/** How much the photo can be enlarged in the editor: 1 shows it whole. */
export const ZOOM_LEVELS = [1, 1.5, 2, 3, 4] as const;

export type Zoom = (typeof ZOOM_LEVELS)[number];

/** The next level up, or the same at the largest. */
export function zoomIn(zoom: Zoom): Zoom {
	return ZOOM_LEVELS.find((level) => level > zoom) ?? zoom;
}

/** The next level down, or the same when the photo is shown whole. */
export function zoomOut(zoom: Zoom): Zoom {
	return [...ZOOM_LEVELS].reverse().find((level) => level < zoom) ?? zoom;
}
