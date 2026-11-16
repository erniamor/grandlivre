import { Button } from "@repo/ui";
import { RotateCcwIcon, RotateCwIcon } from "lucide-react";
import { m } from "@/paraglide/messages";

interface FrameToolsProps {
	/** A quarter turn: 1 clockwise, -1 anticlockwise. */
	onRotate: (by: 1 | -1) => void;
}

/** What is done to the photo while it is framed: turning it. */
export function FrameTools({ onRotate }: FrameToolsProps) {
	return (
		<div className="flex flex-wrap gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => onRotate(-1)}
			>
				<RotateCcwIcon aria-hidden />
				{m.photo_editor_rotate_left()}
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => onRotate(1)}
			>
				<RotateCwIcon aria-hidden />
				{m.photo_editor_rotate_right()}
			</Button>
		</div>
	);
}
