import type { Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { TagForm } from "@/features/tags/TagForm";
import { TagsBackLink } from "@/features/tags/TagsBackLink";
import { tagsQueryKey, tagsQueryOptions } from "@/features/tags/tags-query";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface NewTagPageProps {
	household: Household;
	/** The tag under which the new one is proposed, when it still exists. */
	parentId?: string;
	/** Called once the tag is created. */
	onCreated: () => void | Promise<void>;
}

/** Creates a tag in the household. */
export function NewTagPage({
	household,
	parentId,
	onCreated,
}: NewTagPageProps) {
	const queryClient = useQueryClient();
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const parentExists = tags.some((tag) => tag.id === parentId);

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<TagsBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.tag_new_title()}
			</h1>
			<TagForm
				tags={tags}
				defaultParentId={parentExists ? parentId : null}
				submitLabel={m.tag_create_button()}
				save={(input) => getApi().tags.create(household.id, input)}
				onSaved={async () => {
					await queryClient.invalidateQueries({
						queryKey: tagsQueryKey(household.id),
					});
					toast.success(m.toast_tag_created());
					await onCreated();
				}}
			/>
		</section>
	);
}
