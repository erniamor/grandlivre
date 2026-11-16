import type { ReactNode, RefObject } from "react";
import type { Rect } from "@/features/photo-edit/photo-geometry";
import {
	photoPlace,
	placeStyle,
	type Size,
	turnedImageStyle,
	viewAspect,
} from "@/features/photo-edit/photo-view";
import type { Zoom } from "@/features/photo-edit/photo-zoom";
import { m } from "@/paraglide/messages";

interface PhotoViewProps {
	/** The photo's address in the browser; missing while it is being made. */
	url: string | undefined;
	/** Its size, the right way up, before it is turned. */
	size: Size;
	turns: number;
	/** The part of the photo turned shown: all of it, or the crop. */
	region: Rect;
	zoom: Zoom;
	/** The surface drawn on, whose size turns a pointer's moves into proportions. */
	surface: RefObject<HTMLDivElement | null>;
	/** What is drawn over the photo, placed in proportions of the region. */
	children: ReactNode;
}

/**
 * A part of a photo, turned, filling a view that fits the screen at 100 %
 * and grows with the zoom: the view then scrolls, by a finger off the
 * rectangles, a wheel or a touchpad.
 */
export function PhotoView({
	url,
	size,
	turns,
	region,
	zoom,
	surface,
	children,
}: PhotoViewProps) {
	const aspect = viewAspect(size, turns, region);

	return (
		<div className="mx-auto max-h-[60vh] w-full max-w-md overflow-auto rounded-md bg-muted ring-1 ring-border">
			<div
				ref={surface}
				className="relative mx-auto overflow-hidden"
				style={{
					aspectRatio: `${aspect}`,
					// As wide as the screen allows, and no taller than 60 % of it
					width: `calc(${zoom} * min(100%, 60vh * ${aspect}))`,
				}}
			>
				{url && (
					<div className="absolute" style={placeStyle(photoPlace(region))}>
						<img
							src={url}
							alt={m.photo_editor_alt()}
							draggable={false}
							className="absolute max-w-none select-none"
							style={turnedImageStyle(size, turns)}
						/>
					</div>
				)}
				{children}
			</div>
		</div>
	);
}
