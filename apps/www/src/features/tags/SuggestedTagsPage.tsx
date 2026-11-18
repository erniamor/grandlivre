import type { Household } from "@repo/schemas";
import { Button, cn, toast } from "@repo/ui";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { aboveTabBarClass } from "@/features/navigation/tab-bar";
import { SuggestedTagTree } from "@/features/tags/SuggestedTagTree";
import {
	suggestedKeys,
	toggleSuggestion,
} from "@/features/tags/suggested-selection";
import { suggestedTagsQueryOptions } from "@/features/tags/suggested-tags-query";
import { TagsBackLink } from "@/features/tags/TagsBackLink";
import { tagsQueryKey } from "@/features/tags/tags-query";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SuggestedTagsPageProps {
	household: Household;
	/** Called once the tags are added. */
	onAdded: () => void | Promise<void>;
}

/**
 * The suggested tags, all checked: the user unchecks what doesn't concern
 * their household, then adds the rest in one go.
 */
export function SuggestedTagsPage({
	household,
	onAdded,
}: SuggestedTagsPageProps) {
	const queryClient = useQueryClient();
	const { data: suggestions } = useSuspenseQuery(
		suggestedTagsQueryOptions(household.id),
	);
	const allKeys = suggestedKeys(suggestions);
	const [selected, setSelected] = useState<ReadonlySet<string>>(
		() => new Set(allKeys),
	);
	const add = useMutation({
		mutationFn: () =>
			getApi().tags.addSuggested(household.id, { keys: [...selected] }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: tagsQueryKey(household.id),
			});
			toast.success(m.toast_suggested_tags_added());
			await onAdded();
		},
	});

	return (
		<section className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
			<TagsBackLink />
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.suggested_tags_title()}
				</h1>
				<p className="text-muted-foreground">{m.suggested_tags_intro()}</p>
			</header>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setSelected(new Set(allKeys))}
				>
					{m.suggested_tags_select_all()}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setSelected(new Set())}
				>
					{m.suggested_tags_select_none()}
				</Button>
			</div>
			<SuggestedTagTree
				suggestions={suggestions}
				locale={getLocale()}
				selected={selected}
				onToggle={(key, checked) =>
					setSelected(toggleSuggestion(selected, allKeys, key, checked))
				}
				label={m.suggested_tags_title()}
			/>
			<FormAlert
				message={add.error ? actionErrorMessage(add.error) : undefined}
			/>
			{/* Stays in view at the bottom of a long list */}
			<div
				className={cn(
					"sticky bottom-0 -mx-4 border-border border-t bg-background px-4 py-3",
					aboveTabBarClass,
				)}
			>
				<Button
					type="button"
					disabled={selected.size === 0 || add.isPending}
					onClick={() => add.mutate()}
				>
					{m.suggested_tags_add_button({ count: selected.size })}
				</Button>
			</div>
		</section>
	);
}
