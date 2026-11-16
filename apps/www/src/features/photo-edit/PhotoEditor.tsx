import { Button } from "@repo/ui";
import { TriangleAlertIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { EditableRect } from "@/features/photo-edit/EditableRect";
import { FrameTools } from "@/features/photo-edit/FrameTools";
import { MaskTools } from "@/features/photo-edit/MaskTools";
import { PhotoView } from "@/features/photo-edit/PhotoView";
import {
	absoluteFrom,
	relativeTo,
	WHOLE,
} from "@/features/photo-edit/photo-geometry";
import { placeStyle, type Size } from "@/features/photo-edit/photo-view";
import type { Zoom } from "@/features/photo-edit/photo-zoom";
import {
	type PhotoEdits,
	usePhotoEdits,
} from "@/features/photo-edit/use-photo-edits";
import { ZoomControls } from "@/features/photo-edit/ZoomControls";
import { useObjectUrl } from "@/features/transactions/use-object-url";
import { m } from "@/paraglide/messages";

export type { PhotoEdits };

interface PhotoEditorProps {
	photo: Blob;
	/** Its size, the right way up: for the shape of the frame. */
	size: Size;
	sending: boolean;
	error?: string;
	onSend: (edits: PhotoEdits) => void;
	onCancel: () => void;
}

/** First the frame (turned, narrowed), then the masks over what it keeps. */
type Step = "frame" | "masks";

/**
 * Prepares a photo before it is sent, in two steps: the photo turned and a
 * frame narrowed on what matters, then black masks over what shouldn't
 * leave the device, on the frame shown alone, enlarged. Only the photo
 * prepared is sent; the original stays in the browser.
 */
export function PhotoEditor({
	photo,
	size,
	sending,
	error,
	onSend,
	onCancel,
}: PhotoEditorProps) {
	const hintId = useId();
	const surface = useRef<HTMLDivElement>(null);
	const stepTitle = useRef<HTMLParagraphElement>(null);
	const url = useObjectUrl(photo);
	const { edits, rotate, changeCrop, addMask, changeMask, removeMask } =
		usePhotoEdits();
	const { turns, crop, masks } = edits;
	const [step, setStep] = useState<Step>("frame");
	const [zoom, setZoom] = useState<Zoom>(1);
	// The mask chosen, to remove; -1 for none
	const [selected, setSelected] = useState(-1);

	const goTo = (next: Step) => {
		setStep(next);
		setZoom(1);
		setSelected(-1);
		// The button pressed is gone: the step's title takes the focus
		stepTitle.current?.focus();
	};
	const remove = (index: number) => {
		removeMask(index);
		setSelected(-1);
	};
	const framing = step === "frame";

	return (
		<div className="grid gap-4">
			<div className="grid gap-1">
				<p
					ref={stepTitle}
					tabIndex={-1}
					className="font-medium text-sm outline-none"
				>
					{framing ? m.photo_editor_step_frame() : m.photo_editor_step_masks()}
				</p>
				<p id={hintId} className="text-muted-foreground text-sm">
					{framing
						? `${m.photo_editor_hint_frame()} ${m.photo_editor_keyboard_frame()}`
						: `${m.photo_editor_hint_masks()} ${m.photo_editor_keyboard_masks()}`}
				</p>
			</div>
			<PhotoView
				url={url}
				size={size}
				turns={turns}
				region={framing ? WHOLE : crop}
				zoom={zoom}
				surface={surface}
			>
				{framing ? (
					<>
						{/* The masks already placed, shown under the frame */}
						{masks.map((mask, index) => (
							<div
								// Masks are only added at the end: their places stay put
								key={index}
								aria-hidden
								className="absolute bg-black"
								style={placeStyle(mask)}
							/>
						))}
						<EditableRect
							rect={crop}
							bounds={WHOLE}
							label={m.photo_editor_crop()}
							describedBy={hintId}
							variant="crop"
							selected
							surface={surface}
							onSelect={() => {}}
							onChange={changeCrop}
						/>
					</>
				) : (
					masks.map((mask, index) => (
						<EditableRect
							// A mask has nothing else to tell it apart: masks are only added
							// at the end, so their places stay put
							key={index}
							// Shown on the frame alone, kept on the whole photo
							rect={relativeTo(mask, crop)}
							bounds={WHOLE}
							label={m.photo_editor_mask({ n: index + 1 })}
							describedBy={hintId}
							variant="mask"
							selected={selected === index}
							surface={surface}
							onSelect={() => setSelected(index)}
							onChange={(next) => changeMask(index, absoluteFrom(next, crop))}
							onRemove={() => remove(index)}
						/>
					))
				)}
			</PhotoView>
			<div className="flex flex-wrap items-center justify-between gap-2">
				{framing ? (
					<FrameTools onRotate={rotate} />
				) : (
					<MaskTools
						selected={selected}
						onEditFrame={() => goTo("frame")}
						onAdd={() => {
							addMask();
							setSelected(masks.length);
						}}
						onRemove={remove}
					/>
				)}
				<ZoomControls zoom={zoom} onChange={setZoom} />
			</div>
			{!framing && (
				<p className="flex gap-2 text-sm">
					<TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
					{m.photo_editor_warning()}
				</p>
			)}
			<FormAlert message={error} />
			<div className="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="outline" onClick={onCancel}>
					{m.photo_editor_cancel()}
				</Button>
				{framing ? (
					<Button type="button" onClick={() => goTo("masks")}>
						{m.photo_editor_apply_frame()}
					</Button>
				) : (
					<Button
						type="button"
						disabled={sending}
						onClick={() => onSend(edits)}
					>
						{sending ? m.receipt_scan_pending() : m.photo_editor_send()}
					</Button>
				)}
			</div>
		</div>
	);
}
