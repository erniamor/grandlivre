import {
	Button,
	cn,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Sheet,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@repo/ui";
import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
import { type ExtraTagChoice, TagBrowser } from "@/features/tags/TagBrowser";
import { tagPath } from "@/features/tags/tag-browser";
import type { TagNode } from "@/features/tags/tag-tree";
import { useMediaQuery } from "@/lib/use-media-query";
import { m } from "@/paraglide/messages";

interface TagPickerProps {
	/** What the tag is for: "Tag for COSTCO", named with the tag shown. */
	label: string;
	/** The household's tags (`buildTagTree()`), built once for a whole list of pickers. */
	tree: TagNode[];
	/** The tag chosen, null for none. */
	value: string | null;
	onChange: (tagId: string | null) => void;
	/** Shown while no tag is chosen ("Choose a tag"). */
	placeholder: string;
	/** Offers to choose no tag, under this name ("Uncategorized"). */
	noneLabel?: string;
	/** Offered at the top, after "no tag": a tag proposed, still to create. */
	extras?: ExtraTagChoice[];
	/** The button's id, for a label of its own. */
	id?: string;
	className?: string;
}

/**
 * A button showing the tag chosen, with its path, that opens the household's
 * tags to choose another (`TagBrowser`): under it on a wide screen, in a
 * panel rising from the bottom on a phone, where the list has room.
 */
/**
 * Opens on the panel itself rather than its search: no keyboard rising over
 * the list on a phone, and the tags read first; Tab still reaches the search.
 */
function focusPanel(event: Event) {
	event.preventDefault();
	if (event.currentTarget instanceof HTMLElement) {
		event.currentTarget.focus();
	}
}

export function TagPicker({
	label,
	tree,
	value,
	onChange,
	placeholder,
	noneLabel,
	extras = [],
	id,
	className,
}: TagPickerProps) {
	const [open, setOpen] = useState(false);
	const wide = useMediaQuery("(min-width: 48rem)");
	const shown =
		tagPath(tree, value) ??
		extras.find((extra) => extra.value === value)?.label ??
		(value === null && noneLabel ? noneLabel : placeholder);
	const choose = (tagId: string | null) => {
		onChange(tagId);
		setOpen(false);
	};

	const trigger = (
		<button
			type="button"
			id={id}
			aria-label={m.tag_picker_trigger({ label, tag: shown })}
			className={cn(
				"flex h-9 min-w-0 max-w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
				className,
			)}
		>
			<span className="truncate">{shown}</span>
			<ChevronsUpDownIcon
				aria-hidden
				className="size-4 shrink-0 text-muted-foreground"
			/>
		</button>
	);
	const browser = (
		<TagBrowser
			tree={tree}
			value={value}
			onSelect={choose}
			noneLabel={noneLabel}
			extras={extras}
		/>
	);

	if (wide) {
		return (
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>{trigger}</PopoverTrigger>
				<PopoverContent
					align="start"
					aria-label={label}
					onOpenAutoFocus={focusPanel}
					className="max-h-[min(28rem,var(--radix-popover-content-available-height))] w-80 overflow-y-auto p-2"
				>
					{browser}
				</PopoverContent>
			</Popover>
		);
	}
	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>{trigger}</SheetTrigger>
			<SheetContent
				side="bottom"
				showCloseButton={false}
				aria-describedby={undefined}
				onOpenAutoFocus={focusPanel}
				className="max-h-[85svh] gap-2 rounded-t-xl pb-[env(safe-area-inset-bottom)]"
			>
				<SheetHeader className="pb-0">
					<SheetTitle>{label}</SheetTitle>
				</SheetHeader>
				<div className="min-h-0 overflow-y-auto px-4">{browser}</div>
				<div className="p-4 pt-2">
					<SheetClose asChild>
						<Button type="button" variant="outline" className="w-full">
							{m.nav_more_close()}
						</Button>
					</SheetClose>
				</div>
			</SheetContent>
		</Sheet>
	);
}
