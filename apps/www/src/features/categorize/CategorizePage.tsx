import type { Household } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { PayeeGroupItem } from "@/features/categorize/PayeeGroupItem";
import { TagSuggestionsBar } from "@/features/categorize/TagSuggestionsBar";
import {
	type ChoiceMap,
	groupId,
	shownTag,
	tagsToApply,
} from "@/features/categorize/tag-suggestions";
import { uncategorizedQueryOptions } from "@/features/categorize/uncategorized-query";
import { useApplyTags } from "@/features/categorize/use-apply-tags";
import { useTagSuggestions } from "@/features/categorize/use-tag-suggestions";
import { buildTagTree } from "@/features/tags/tag-tree";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface CategorizePageProps {
	household: Household;
	/** Opened from the first steps: its back link goes there, else to the transactions. */
	fromGettingStarted?: boolean;
}

/**
 * The user's expenses and incomes without a tag, by payee, the most
 * frequent first: one tag for all of a payee's at once, suggested by the
 * assistant on request. The next imports learn it.
 */
export function CategorizePage({
	household,
	fromGettingStarted = false,
}: CategorizePageProps) {
	const { data: groups } = useSuspenseQuery(
		uncategorizedQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const tagTree = buildTagTree(tags, getLocale());
	const tagIds = new Set(tags.map((tag) => tag.id));
	const [choices, setChoices] = useState<ChoiceMap>(new Map());
	const suggestions = useTagSuggestions(household.id, groups.items);
	const applyTags = useApplyTags(household.id);
	const toApply = tagsToApply(
		groups.items,
		choices,
		suggestions.suggestions,
		tagIds,
	);

	return (
		<section className="mx-auto grid max-w-2xl gap-8 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.categorize_title()}
				</h1>
				<p className="text-muted-foreground">{m.categorize_intro()}</p>
				<div className="flex flex-wrap gap-2">
					<Link
						to={fromGettingStarted ? "/getting-started" : "/transactions"}
						className={buttonVariants({ variant: "outline" })}
					>
						{fromGettingStarted
							? m.categorize_back()
							: m.categorize_back_transactions()}
					</Link>
					<Link to="/tags/new" className={buttonVariants({ variant: "ghost" })}>
						<PlusIcon aria-hidden />
						{m.tag_add_button()}
					</Link>
				</div>
			</header>
			{groups.items.length === 0 ? (
				<p className="text-muted-foreground">{m.categorize_empty()}</p>
			) : (
				<>
					<p className="text-sm">
						{m.categorize_count({ count: groups.total })}
					</p>
					<TagSuggestionsBar
						remaining={suggestions.remaining}
						askedCount={suggestions.askedCount}
						suggesting={suggestions.pending}
						onSuggest={suggestions.suggest}
						toApply={{
							payees: toApply.length,
							transactions: toApply.reduce(
								(sum, { group }) => sum + group.count,
								0,
							),
						}}
						applying={applyTags.pending}
						onApply={() => applyTags.apply(toApply)}
					/>
					<ul className="grid gap-3">
						{groups.items.map((group) => {
							const id = groupId(group);
							const shown = shownTag(
								group,
								choices,
								suggestions.suggestions,
								tagIds,
							);
							return (
								<PayeeGroupItem
									key={id}
									household={household}
									group={group}
									tagTree={tagTree}
									tagId={shown.tagId}
									suggested={shown.suggested}
									noSuggestion={
										suggestions.suggestions.get(id) === null && !choices.has(id)
									}
									onTagChange={(tagId) =>
										setChoices((before) => new Map(before).set(id, tagId))
									}
								/>
							);
						})}
					</ul>
				</>
			)}
		</section>
	);
}
