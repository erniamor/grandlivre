import type { CSSProperties } from "react";
import {
	normalizeTurns,
	type Rect,
	relativeTo,
	rotatedSize,
	WHOLE,
} from "@/features/photo-edit/photo-geometry";

export interface Size {
	width: number;
	height: number;
}

/**
 * The shape of a view showing `region` of the photo turned by `turns`:
 * its width divided by its height, in pixels of the photo.
 */
export function viewAspect(size: Size, turns: number, region: Rect): number {
	const turned = rotatedSize(size, turns);
	return (region.width * turned.width) / (region.height * turned.height);
}

/**
 * Where the photo turned lies on a view showing `region` of it, in
 * proportions of the view: the whole view for the whole photo, beyond its
 * edges for a crop, which then fills the view.
 */
export function photoPlace(region: Rect): Rect {
	return relativeTo(WHOLE, region);
}

/** A rectangle in proportions, as the position of an element in its parent. */
export function placeStyle(rect: Rect): CSSProperties {
	return {
		left: `${rect.x * 100}%`,
		top: `${rect.y * 100}%`,
		width: `${rect.width * 100}%`,
		height: `${rect.height * 100}%`,
	};
}

/**
 * The image as stored, in a box the shape of the photo turned by `turns`:
 * turned around the box's middle, with its sides swapped by a quarter turn,
 * so it fills the box.
 */
export function turnedImageStyle(size: Size, turns: number): CSSProperties {
	const quarter = normalizeTurns(turns);
	const turned = rotatedSize(size, quarter);
	const sideways = quarter % 2 === 1;
	return {
		left: "50%",
		top: "50%",
		width: sideways ? `${(turned.height / turned.width) * 100}%` : "100%",
		height: sideways ? `${(turned.width / turned.height) * 100}%` : "100%",
		transform: `translate(-50%, -50%) rotate(${quarter * 90}deg)`,
	};
}
