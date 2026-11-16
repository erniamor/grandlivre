import { cn } from "@repo/ui";
import {
	type KeyboardEvent,
	type PointerEvent,
	type RefObject,
	useRef,
} from "react";
import {
	type Handle,
	moveRect,
	type Rect,
	resizeRect,
} from "@/features/photo-edit/photo-geometry";

interface EditableRectProps {
	rect: Rect;
	/** Where it may go: the whole photo for the crop, the crop for a mask. */
	bounds: Rect;
	/** Its name, for screen readers: "Crop", "Mask 1". */
	label: string;
	/** Says how to move it from the keyboard. */
	describedBy: string;
	variant: "crop" | "mask";
	selected: boolean;
	/** The photo it is drawn on, to turn the pointer's moves into proportions. */
	surface: RefObject<HTMLElement | null>;
	onSelect: () => void;
	onChange: (rect: Rect) => void;
	/** Removes it (a mask), from the keyboard's Delete. */
	onRemove?: () => void;
}

/** One step of the keyboard, in proportions of the photo. */
const STEP = 0.01;

const corners: Handle[] = ["nw", "ne", "sw", "se"];

const cornerPlaces: Record<string, string> = {
	nw: "-top-2 -left-2 cursor-nwse-resize",
	ne: "-top-2 -right-2 cursor-nesw-resize",
	sw: "-bottom-2 -left-2 cursor-nesw-resize",
	se: "-bottom-2 -right-2 cursor-nwse-resize",
};

/**
 * A rectangle on a photo, moved by its body and resized by its corners,
 * with a finger, a mouse or the keyboard: the arrows move it, Shift and the
 * arrows resize it, Delete removes a mask.
 */
export function EditableRect({
	rect,
	bounds,
	label,
	describedBy,
	variant,
	selected,
	surface,
	onSelect,
	onChange,
	onRemove,
}: EditableRectProps) {
	// Where a drag started: the pointer, the rectangle, and what is dragged
	const drag = useRef<{
		x: number;
		y: number;
		rect: Rect;
		handle: Handle | null;
	} | null>(null);

	const start = (event: PointerEvent<HTMLElement>, handle: Handle | null) => {
		event.stopPropagation();
		event.currentTarget.setPointerCapture?.(event.pointerId);
		drag.current = { x: event.clientX, y: event.clientY, rect, handle };
		onSelect();
	};
	const follow = (event: PointerEvent<HTMLElement>) => {
		const from = drag.current;
		const box = surface.current?.getBoundingClientRect();
		if (!from || !box || box.width === 0 || box.height === 0) {
			return;
		}
		const dx = (event.clientX - from.x) / box.width;
		const dy = (event.clientY - from.y) / box.height;
		onChange(
			from.handle
				? resizeRect(from.rect, from.handle, dx, dy, bounds)
				: moveRect(from.rect, dx, dy, bounds),
		);
	};
	const stop = () => {
		drag.current = null;
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-STEP, 0],
			ArrowRight: [STEP, 0],
			ArrowUp: [0, -STEP],
			ArrowDown: [0, STEP],
		};
		const move = moves[event.key];
		if (move) {
			event.preventDefault();
			onChange(
				event.shiftKey
					? // The bottom right corner: wider, narrower, taller, shorter
						resizeRect(rect, "se", move[0], move[1], bounds)
					: moveRect(rect, move[0], move[1], bounds),
			);
		} else if (
			(event.key === "Delete" || event.key === "Backspace") &&
			onRemove
		) {
			event.preventDefault();
			onRemove();
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: a rectangle moved over a photo has no native element
		<div
			role="button"
			tabIndex={0}
			aria-label={label}
			aria-describedby={describedBy}
			aria-pressed={selected}
			className={cn(
				"absolute touch-none select-none outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring",
				variant === "crop"
					? // Darkens what the crop leaves out
						"cursor-move border-2 border-primary shadow-[0_0_0_9999px] shadow-background/70"
					: // A mask is black: the image sent is painted black there
						"cursor-move bg-black",
				selected && variant === "mask" && "ring-2 ring-primary",
			)}
			style={{
				left: `${rect.x * 100}%`,
				top: `${rect.y * 100}%`,
				width: `${rect.width * 100}%`,
				height: `${rect.height * 100}%`,
			}}
			onPointerDown={(event) => start(event, null)}
			onPointerMove={follow}
			onPointerUp={stop}
			onPointerCancel={stop}
			onKeyDown={onKeyDown}
			onFocus={onSelect}
		>
			{corners.map((handle) => (
				<span
					key={handle}
					aria-hidden
					className={cn(
						"absolute size-4 rounded-full border-2 border-primary bg-background",
						cornerPlaces[handle],
					)}
					onPointerDown={(event) => start(event, handle)}
					onPointerMove={follow}
					onPointerUp={stop}
					onPointerCancel={stop}
				/>
			))}
		</div>
	);
}
