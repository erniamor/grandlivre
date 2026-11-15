import { buttonVariants } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { PencilIcon, PlusIcon } from "lucide-react";
import { WithTooltip } from "@/components/WithTooltip";
import type { TagNode } from "@/features/tags/tag-tree";
import { m } from "@/paraglide/messages";

interface TagTreeProps {
	nodes: TagNode[];
	/** Accessible name of the list, for the root level. */
	label?: string;
}

const iconLinkClass = buttonVariants({ variant: "ghost", size: "icon" });

/** The tags as nested lists, each with the links to change it and add a sub-tag. */
export function TagTree({ nodes, label }: TagTreeProps) {
	return (
		<ul
			aria-label={label}
			className={
				label ? "grid gap-1" : "ml-4 grid gap-1 border-border border-l pl-3"
			}
		>
			{nodes.map(({ tag, name, children }) => (
				<li key={tag.id} className="grid gap-1">
					<div className="flex items-center gap-1 rounded-md py-0.5 pl-2 hover:bg-muted/50">
						<span className="min-w-0 flex-1 break-words">{name}</span>
						<WithTooltip label={m.tag_add_child_tooltip()}>
							<Link
								to="/tags/new"
								search={{ parent: tag.id }}
								aria-label={m.tag_add_child_label({ name })}
								className={iconLinkClass}
							>
								<PlusIcon aria-hidden className="size-4" />
							</Link>
						</WithTooltip>
						<WithTooltip label={m.edit_tooltip()}>
							<Link
								to="/tags/$tagId"
								params={{ tagId: tag.id }}
								aria-label={m.tag_edit_label({ name })}
								className={iconLinkClass}
							>
								<PencilIcon aria-hidden className="size-4" />
							</Link>
						</WithTooltip>
					</div>
					{children.length > 0 && <TagTree nodes={children} />}
				</li>
			))}
		</ul>
	);
}
