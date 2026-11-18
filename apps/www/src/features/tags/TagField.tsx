import { cn } from "@repo/ui";
import { useId } from "react";
import type { ExtraTagChoice } from "@/features/tags/TagBrowser";
import { TagPicker } from "@/features/tags/TagPicker";
import type { TagNode } from "@/features/tags/tag-tree";
import { m } from "@/paraglide/messages";

interface TagFieldProps {
	label: string;
	/** The household's tags (`buildTagTree()`), built once for a whole list of fields. */
	tree: TagNode[];
	/** The tag chosen, "" for none: a transaction's line left uncategorized. */
	value: string;
	onChange: (tagId: string) => void;
	/** Offered at the top, after "uncategorized": a tag proposed, still to create. */
	extras?: ExtraTagChoice[];
	/** Hides the label visually; it stays available to screen readers. */
	hideLabel?: boolean;
	className?: string;
}

/** A form's tag, with its label: a `TagPicker` offering "uncategorized" too. */
export function TagField({
	label,
	tree,
	value,
	onChange,
	extras,
	hideLabel = false,
	className,
}: TagFieldProps) {
	const id = useId();

	return (
		<div className={cn("grid gap-2", className)}>
			<label htmlFor={id} className={cn("text-sm", hideLabel && "sr-only")}>
				{label}
			</label>
			<TagPicker
				id={id}
				label={label}
				tree={tree}
				value={value === "" ? null : value}
				onChange={(tagId) => onChange(tagId ?? "")}
				placeholder={m.transaction_uncategorized()}
				noneLabel={m.transaction_uncategorized()}
				extras={extras}
				className="w-full font-normal"
			/>
		</div>
	);
}
