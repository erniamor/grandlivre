import { type Household, tagDisplayName } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { NotFound } from "@/components/NotFound";
import { DeleteTagButton } from "@/features/tags/DeleteTagButton";
import { TagForm } from "@/features/tags/TagForm";
import { TagsBackLink } from "@/features/tags/TagsBackLink";
import { tagsQueryKey, tagsQueryOptions } from "@/features/tags/tags-query";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface EditTagPageProps {
	household: Household;
	tagId: string;
	/** Called once the tag is saved or deleted. */
	onDone: () => void | Promise<void>;
}

/** Changes a tag (its names, its parent) or deletes it. */
export function EditTagPage({ household, tagId, onDone }: EditTagPageProps) {
	const queryClient = useQueryClient();
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const tag = tags.find((candidate) => candidate.id === tagId);
	const finish = async (message: string) => {
		// Leave first: the page must not show a tag that no longer exists
		await onDone();
		toast.success(message);
		await queryClient.invalidateQueries({
			queryKey: tagsQueryKey(household.id),
		});
	};

	// Deleted meanwhile, by this user or another member
	if (!tag) {
		return <NotFound />;
	}
	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<TagsBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.tag_edit_title()}
			</h1>
			<TagForm
				tags={tags}
				tag={tag}
				submitLabel={m.save_button()}
				save={(input) => getApi().tags.update(household.id, tag.id, input)}
				onSaved={() => finish(m.toast_tag_saved())}
			/>
			<div className="justify-self-start">
				<DeleteTagButton
					householdId={household.id}
					tagId={tag.id}
					name={tagDisplayName(tag.names, getLocale())}
					onDeleted={() => finish(m.toast_tag_deleted())}
				/>
			</div>
		</section>
	);
}
