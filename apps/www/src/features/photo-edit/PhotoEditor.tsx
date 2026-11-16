import { Button } from "@repo/ui";
import { PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { EditableRect } from "@/features/photo-edit/EditableRect";
import {
	intersect,
	newMask,
	type Rect,
	WHOLE,
} from "@/features/photo-edit/photo-geometry";
import { useObjectUrl } from "@/features/transactions/use-object-url";
import { m } from "@/paraglide/messages";

/** What to send: the crop, and the masks within it. */
export interface PhotoEdits {
	crop: Rect;
	masks: Rect[];
}

interface PhotoEditorProps {
	photo: Blob;
	/** Its size, the right way up: for the shape of the frame. */
	size: { width: number; height: number };
	sending: boolean;
	error?: string;
	onSend: (edits: PhotoEdits) => void;
	onCancel: () => void;
}

/**
 * Prepares a photo before it is sent: a frame narrowed on what matters,
 * black masks over what shouldn't leave the device. Only the photo prepared
 * is sent; the original stays in the browser.
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
	const url = useObjectUrl(photo);
	const [crop, setCrop] = useState<Rect>(WHOLE);
	const [masks, setMasks] = useState<Rect[]>([]);
	// The mask chosen, to remove; -1 for the crop or nothing
	const [selected, setSelected] = useState(-1);

	const changeCrop = (next: Rect) => {
		setCrop(next);
		// A mask left outside the new frame is no longer in the photo sent
		setMasks((current) => current.filter((mask) => intersect(mask, next)));
	};
	const remove = (index: number) => {
		setMasks(masks.filter((_, each) => each !== index));
		setSelected(-1);
	};

	return (
		<div className="grid gap-4">
			<p id={hintId} className="text-muted-foreground text-sm">
				{m.photo_editor_hint()} {m.photo_editor_keyboard()}
			</p>
			<div
				ref={surface}
				className="relative mx-auto w-full max-w-md touch-none overflow-hidden rounded-md border border-border bg-muted"
				style={{
					aspectRatio: `${size.width} / ${size.height}`,
					maxHeight: "60vh",
				}}
			>
				{url && (
					<img
						src={url}
						alt={m.photo_editor_alt()}
						draggable={false}
						className="absolute inset-0 size-full select-none"
					/>
				)}
				<EditableRect
					rect={crop}
					bounds={WHOLE}
					label={m.photo_editor_crop()}
					describedBy={hintId}
					variant="crop"
					selected={selected === -1}
					surface={surface}
					onSelect={() => setSelected(-1)}
					onChange={changeCrop}
				/>
				{masks.map((mask, index) => (
					<EditableRect
						// A mask has nothing else to tell it apart: masks are only added
						// at the end, so their places stay put
						key={index}
						rect={mask}
						bounds={crop}
						label={m.photo_editor_mask({ n: index + 1 })}
						describedBy={hintId}
						variant="mask"
						selected={selected === index}
						surface={surface}
						onSelect={() => setSelected(index)}
						onChange={(next) =>
							setMasks(masks.map((each, at) => (at === index ? next : each)))
						}
						onRemove={() => remove(index)}
					/>
				))}
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => {
						setMasks([...masks, newMask(crop)]);
						setSelected(masks.length);
					}}
				>
					<PlusIcon aria-hidden />
					{m.photo_editor_add_mask()}
				</Button>
				{selected >= 0 && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => remove(selected)}
					>
						<Trash2Icon aria-hidden />
						{m.photo_editor_remove_mask({ n: selected + 1 })}
					</Button>
				)}
			</div>
			<p className="flex gap-2 text-sm">
				<TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
				{m.photo_editor_warning()}
			</p>
			<FormAlert message={error} />
			<div className="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="outline" onClick={onCancel}>
					{m.photo_editor_cancel()}
				</Button>
				<Button
					type="button"
					disabled={sending}
					onClick={() => onSend({ crop, masks })}
				>
					{sending ? m.receipt_scan_pending() : m.photo_editor_send()}
				</Button>
			</div>
		</div>
	);
}
