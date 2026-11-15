import type { Household } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon, SparklesIcon } from "lucide-react";
import { TagTree } from "@/features/tags/TagTree";
import { buildTagTree } from "@/features/tags/tag-tree";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface TagsPageProps {
	household: Household;
}

/** The household's tags as a tree, named in the user's language. */
export function TagsPage({ household }: TagsPageProps) {
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const tree = buildTagTree(tags, getLocale());

	return (
		<section className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.tags_title()}
				</h1>
				<p className="text-muted-foreground">{m.tags_intro()}</p>
			</header>
			<div className="flex flex-wrap gap-2">
				<Link to="/tags/new" className={buttonVariants()}>
					<PlusIcon aria-hidden />
					{m.tag_add_button()}
				</Link>
				{/* A starting point: offered only to a household without tags */}
				{tags.length === 0 && (
					<Link
						to="/tags/suggested"
						className={buttonVariants({ variant: "outline" })}
					>
						<SparklesIcon aria-hidden />
						{m.tags_suggested_link()}
					</Link>
				)}
			</div>
			{tags.length === 0 ? (
				<p className="text-muted-foreground">{m.tags_empty()}</p>
			) : (
				<TagTree nodes={tree} label={m.tags_title()} />
			)}
		</section>
	);
}
