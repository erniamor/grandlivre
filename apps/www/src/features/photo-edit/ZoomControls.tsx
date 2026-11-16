import { Button } from "@repo/ui";
import { ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import {
	ZOOM_LEVELS,
	type Zoom,
	zoomIn,
	zoomOut,
} from "@/features/photo-edit/photo-zoom";
import { m } from "@/paraglide/messages";

interface ZoomControlsProps {
	zoom: Zoom;
	onChange: (zoom: Zoom) => void;
}

const [SMALLEST] = ZOOM_LEVELS;
const LARGEST = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

/** Zooms the photo in and out, or back to the whole photo. */
export function ZoomControls({ zoom, onChange }: ZoomControlsProps) {
	return (
		<fieldset
			aria-label={m.photo_editor_zoom()}
			className="flex items-center gap-1"
		>
			<IconButton
				label={m.photo_editor_zoom_out()}
				icon={ZoomOutIcon}
				variant="outline"
				disabled={zoom === SMALLEST}
				onClick={() => onChange(zoomOut(zoom))}
			/>
			<output className="min-w-12 text-center text-sm tabular-nums">
				{m.photo_editor_zoom_level({ percent: zoom * 100 })}
			</output>
			<IconButton
				label={m.photo_editor_zoom_in()}
				icon={ZoomInIcon}
				variant="outline"
				disabled={zoom === LARGEST}
				onClick={() => onChange(zoomIn(zoom))}
			/>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				disabled={zoom === SMALLEST}
				onClick={() => onChange(SMALLEST)}
			>
				{m.photo_editor_zoom_fit()}
			</Button>
		</fieldset>
	);
}
