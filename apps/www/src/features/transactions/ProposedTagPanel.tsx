import {
	LOCALES,
	type ProposedTag,
	type SimilarTagReason,
	type Tag,
	tagDisplayName,
} from "@repo/schemas";
import { Button } from "@repo/ui";
import { useId } from "react";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ProposedTagPanelProps {
	proposal: ProposedTag;
	tags: Tag[];
	/** Puts the lines on an existing tag instead. */
	onUseTag: (tagId: string) => void;
	/** Leaves the lines uncategorized, the tag not created. */
	onDismiss: () => void;
}

const reasonLabels: Record<SimilarTagReason, () => string> = {
	same_name: m.similar_tag_same_name,
	similar_name: m.similar_tag_similar_name,
	contains: m.similar_tag_contains,
};

/**
 * The tag the assistant proposed, to accept or not, with the existing tags
 * that look like it: it is created only when the transaction is saved on it.
 */
export function ProposedTagPanel({
	proposal,
	tags,
	onUseTag,
	onDismiss,
}: ProposedTagPanelProps) {
	const locale = getLocale();
	const titleId = useId();
	const paths = new Map(
		flattenTagTree(buildTagTree(tags, locale)).map(({ tag, path }) => [
			tag.id,
			path,
		]),
	);
	const parentPath =
		proposal.parentId === null ? undefined : paths.get(proposal.parentId);
	const name = proposal.names[locale];
	const otherNames = LOCALES.filter((other) => other !== locale).map(
		(other) => proposal.names[other],
	);
	const similar = proposal.similarTags.flatMap(({ tagId, reason }) => {
		const tag = tags.find((candidate) => candidate.id === tagId);
		return tag
			? [
					{
						tagId,
						reason,
						path: paths.get(tagId) ?? tagDisplayName(tag.names, locale),
					},
				]
			: [];
	});

	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4"
		>
			<div className="grid gap-1">
				<h2 id={titleId} className="font-medium text-sm">
					{m.proposed_tag_title()}
				</h2>
				<p className="break-words font-medium">
					{parentPath ? `${parentPath} › ${name}` : name}
				</p>
				<p className="text-muted-foreground text-sm">
					{otherNames.join(" · ")}
				</p>
				<p className="text-muted-foreground text-sm">{m.proposed_tag_hint()}</p>
			</div>
			{similar.length > 0 && (
				<div className="grid gap-2">
					<p className="font-medium text-sm">
						{m.proposed_tag_similar_title()}
					</p>
					<ul className="grid gap-2">
						{similar.map(({ tagId, reason, path }) => (
							<li
								key={tagId}
								className="flex flex-wrap items-center gap-x-3 gap-y-1"
							>
								<span className="min-w-0 flex-1 break-words">
									{path}
									<span className="text-muted-foreground text-sm">
										{" "}
										· {reasonLabels[reason]()}
									</span>
								</span>
								<Button
									type="button"
									variant="outline"
									size="sm"
									aria-label={m.proposed_tag_use_label({ path })}
									onClick={() => onUseTag(tagId)}
								>
									{m.proposed_tag_use_button()}
								</Button>
							</li>
						))}
					</ul>
				</div>
			)}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="justify-self-start"
				onClick={onDismiss}
			>
				{m.proposed_tag_dismiss_button()}
			</Button>
		</section>
	);
}
