import type { Household } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { PayeeGroupItem } from "@/features/categorize/PayeeGroupItem";
import { uncategorizedQueryOptions } from "@/features/categorize/uncategorized-query";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface CategorizePageProps {
	household: Household;
}

/**
 * The user's expenses and incomes without a tag, by payee, the most
 * frequent first: one tag for all of a payee's at once. The next imports
 * learn it.
 */
export function CategorizePage({ household }: CategorizePageProps) {
	const { data: groups } = useSuspenseQuery(
		uncategorizedQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const tagOptions = [
		{ value: "", label: m.categorize_tag_choose() },
		...flattenTagTree(buildTagTree(tags, getLocale())).map(({ tag, path }) => ({
			value: tag.id,
			label: path,
		})),
	];

	return (
		<section className="mx-auto grid max-w-2xl gap-8 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.categorize_title()}
				</h1>
				<p className="text-muted-foreground">{m.categorize_intro()}</p>
				<div className="flex flex-wrap gap-2">
					<Link
						to="/getting-started"
						className={buttonVariants({ variant: "outline" })}
					>
						{m.categorize_back()}
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
					<ul className="grid gap-3">
						{groups.items.map((group) => (
							<PayeeGroupItem
								key={`${group.type}:${group.key}`}
								household={household}
								group={group}
								tagOptions={tagOptions}
							/>
						))}
					</ul>
				</>
			)}
		</section>
	);
}
