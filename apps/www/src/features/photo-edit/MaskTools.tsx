import { Button } from "@repo/ui";
import { CropIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { m } from "@/paraglide/messages";

interface MaskToolsProps {
	/** The mask chosen, from 0; -1 for none. */
	selected: number;
	onEditFrame: () => void;
	onAdd: () => void;
	onRemove: (index: number) => void;
}

/** What is done while the masks are placed: back to the frame, a mask added or removed. */
export function MaskTools({
	selected,
	onEditFrame,
	onAdd,
	onRemove,
}: MaskToolsProps) {
	return (
		<div className="flex flex-wrap gap-2">
			<Button type="button" variant="outline" size="sm" onClick={onEditFrame}>
				<CropIcon aria-hidden />
				{m.photo_editor_edit_frame()}
			</Button>
			<Button type="button" variant="outline" size="sm" onClick={onAdd}>
				<PlusIcon aria-hidden />
				{m.photo_editor_add_mask()}
			</Button>
			{selected >= 0 && (
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => onRemove(selected)}
				>
					<Trash2Icon aria-hidden />
					{m.photo_editor_remove_mask({ n: selected + 1 })}
				</Button>
			)}
		</div>
	);
}
