import { cn, Input } from "@repo/ui";
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	SearchIcon,
} from "lucide-react";
import { useState } from "react";
import { searchTags, tagLevel, trailTo } from "@/features/tags/tag-browser";
import type { TagNode } from "@/features/tags/tag-tree";
import { m } from "@/paraglide/messages";

/** A choice that isn't one of the household's tags: a tag proposed, still to create. */
export interface ExtraTagChoice {
	value: string;
	label: string;
}

interface TagBrowserProps {
	/** The household's tags (`buildTagTree()`). */
	tree: TagNode[];
	/** The tag chosen, null for none. */
	value: string | null;
	onSelect: (tagId: string | null) => void;
	/** Offers to choose no tag, under this name ("Uncategorized"). */
	noneLabel?: string;
	/** Offered at the top, after "no tag". */
	extras?: ExtraTagChoice[];
}

const rowClass =
	"flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2";

/**
 * The household's tags to choose one from: level by level, from the root
 * tags down, the path opened so far above to go back up; or, as soon as
 * something is searched, every tag whose path holds it. A tag with child
 * tags opens them, and is chosen itself from the first row of its level.
 * It opens on the level of the tag chosen.
 */
export function TagBrowser({
	tree,
	value,
	onSelect,
	noneLabel,
	extras = [],
}: TagBrowserProps) {
	const [trail, setTrail] = useState(() => trailTo(tree, value));
	const [search, setSearch] = useState("");
	const level = tagLevel(tree, trail);
	const opened = level.trail.at(-1);
	const found = searchTags(tree, search);
	const searching = search.trim() !== "";

	const chosenMark = (chosen: boolean) =>
		chosen && (
			<>
				<CheckIcon aria-hidden className="size-4 shrink-0" />
				<span className="sr-only">, {m.tag_picker_chosen()}</span>
			</>
		);

	return (
		<div className="grid gap-2">
			<div className="relative">
				<SearchIcon
					aria-hidden
					className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="search"
					aria-label={m.tag_picker_search()}
					placeholder={m.tag_picker_search()}
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					className="pl-8"
				/>
			</div>
			{searching ? (
				found.length === 0 ? (
					<p className="px-2 py-3 text-muted-foreground text-sm">
						{m.tag_picker_no_match({ search: search.trim() })}
					</p>
				) : (
					<ul className="grid gap-0.5">
						{found.map(({ tag, path }) => (
							<li key={tag.id}>
								<button
									type="button"
									className={rowClass}
									onClick={() => onSelect(tag.id)}
								>
									<span className="flex-1">{path}</span>
									{chosenMark(tag.id === value)}
								</button>
							</li>
						))}
					</ul>
				)
			) : (
				<>
					{level.trail.length > 0 && (
						<nav
							aria-label={m.tag_picker_trail()}
							className="flex items-center gap-1"
						>
							<button
								type="button"
								aria-label={m.tag_picker_up({
									name: level.trail.at(-2)?.name ?? m.tag_picker_all(),
								})}
								className={cn(rowClass, "w-auto shrink-0 px-1.5")}
								onClick={() => setTrail(trail.slice(0, -1))}
							>
								<ChevronLeftIcon aria-hidden className="size-4" />
							</button>
							<ol className="flex min-w-0 flex-wrap items-center gap-x-1 text-sm">
								<li>
									<button
										type="button"
										className="rounded-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
										onClick={() => setTrail([])}
									>
										{m.tag_picker_all()}
									</button>
								</li>
								{level.trail.map((node, index) => (
									<li key={node.tag.id} className="flex items-center gap-1">
										<span aria-hidden className="text-muted-foreground">
											›
										</span>
										{index === level.trail.length - 1 ? (
											<span aria-current="location" className="font-medium">
												{node.name}
											</span>
										) : (
											<button
												type="button"
												className="rounded-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
												onClick={() => setTrail(trail.slice(0, index + 1))}
											>
												{node.name}
											</button>
										)}
									</li>
								))}
							</ol>
						</nav>
					)}
					<ul className="grid gap-0.5">
						{opened && (
							<li>
								<button
									type="button"
									className={cn(rowClass, "font-medium")}
									onClick={() => onSelect(opened.tag.id)}
								>
									<span className="flex-1">
										{m.tag_picker_choose({ name: opened.name })}
									</span>
									{chosenMark(opened.tag.id === value)}
								</button>
							</li>
						)}
						{!opened && noneLabel && (
							<li>
								<button
									type="button"
									className={cn(rowClass, "text-muted-foreground")}
									onClick={() => onSelect(null)}
								>
									<span className="flex-1">{noneLabel}</span>
									{chosenMark(value === null)}
								</button>
							</li>
						)}
						{!opened &&
							extras.map((extra) => (
								<li key={extra.value}>
									<button
										type="button"
										className={cn(rowClass, "font-medium")}
										onClick={() => onSelect(extra.value)}
									>
										<span className="flex-1">{extra.label}</span>
										{chosenMark(extra.value === value)}
									</button>
								</li>
							))}
						{level.children.map((node) => (
							<li key={node.tag.id}>
								{node.children.length > 0 ? (
									<button
										type="button"
										className={rowClass}
										onClick={() => setTrail([...trail, node.tag.id])}
									>
										<span className="flex-1">
											{node.name}
											<span className="sr-only">, {m.tag_picker_opens()}</span>
										</span>
										{chosenMark(node.tag.id === value)}
										<ChevronRightIcon
											aria-hidden
											className="size-4 shrink-0 text-muted-foreground"
										/>
									</button>
								) : (
									<button
										type="button"
										className={rowClass}
										onClick={() => onSelect(node.tag.id)}
									>
										<span className="flex-1">{node.name}</span>
										{chosenMark(node.tag.id === value)}
									</button>
								)}
							</li>
						))}
					</ul>
					{tree.length === 0 && (
						<p className="px-2 py-3 text-muted-foreground text-sm">
							{m.tag_picker_empty()}
						</p>
					)}
				</>
			)}
		</div>
	);
}
