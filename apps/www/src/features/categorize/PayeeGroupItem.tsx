import type { Household, UncategorizedPayee } from "@repo/schemas";
import { Button, cn, toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import { useId } from "react";
import { FormAlert } from "@/components/FormAlert";
import { sensitiveClass } from "@/components/sensitive";
import { TagPicker } from "@/features/tags/TagPicker";
import type { TagNode } from "@/features/tags/tag-tree";
import { getApi } from "@/lib/api";
import { formatShortDay } from "@/lib/dates";
import { formErrors } from "@/lib/error-messages";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface PayeeGroupItemProps {
	household: Household;
	group: UncategorizedPayee;
	/** The household's tags (`buildTagTree()`), to choose one from. */
	tagTree: TagNode[];
	/** The tag shown: chosen by the user, or suggested by the assistant; "" for none. */
	tagId: string;
	/** The tag shown is the assistant's. */
	suggested: boolean;
	/** The assistant was asked and had no tag for it. */
	noSuggestion: boolean;
	onTagChange: (tagId: string) => void;
}

/**
 * A payee's transactions without a tag: how many, how much, since when;
 * and one tag for all of them, the assistant's when it suggested one.
 */
export function PayeeGroupItem({
	household,
	group,
	tagTree,
	tagId,
	suggested,
	noSuggestion,
	onTagChange,
}: PayeeGroupItemProps) {
	const locale = getLocale();
	const titleId = useId();
	const queryClient = useQueryClient();
	const categorize = useMutation({
		mutationFn: () =>
			getApi().transactions.categorize(household.id, {
				key: group.key,
				type: group.type,
				tagId,
			}),
		onSuccess: ({ count }) => {
			toast.success(m.toast_categorized({ count, payee: group.payee }));
			queryClient.invalidateQueries({ queryKey: ["households", household.id] });
		},
	});
	const error = categorize.error ? formErrors(categorize.error) : null;

	return (
		<li
			aria-labelledby={titleId}
			className="grid gap-2 rounded-lg border border-border p-4"
		>
			<div className="flex flex-wrap items-baseline justify-between gap-x-4">
				<h2 id={titleId} className={cn("font-medium", sensitiveClass)}>
					{group.payee}
				</h2>
				<p className={cn("tabular-nums", sensitiveClass)}>
					{formatAmount(group.total, household.currency, locale)}
				</p>
			</div>
			<p className="text-muted-foreground text-sm">
				{(group.type === "expense"
					? m.categorize_group_expenses
					: m.categorize_group_incomes)({
					count: group.count,
					from: formatShortDay(group.firstDate, locale),
					to: formatShortDay(group.lastDate, locale),
				})}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<TagPicker
					label={m.categorize_tag_label({ payee: group.payee })}
					tree={tagTree}
					value={tagId === "" ? null : tagId}
					onChange={(next) => onTagChange(next ?? "")}
					placeholder={m.categorize_tag_choose()}
					className="w-full sm:w-72"
				/>
				{suggested && (
					<span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 font-medium text-xs">
						<SparklesIcon aria-hidden className="size-3" />
						{m.categorize_suggested()}
					</span>
				)}
				<Button
					type="button"
					disabled={tagId === "" || categorize.isPending}
					onClick={() => categorize.mutate()}
				>
					{m.categorize_submit()}
				</Button>
			</div>
			{noSuggestion && (
				<p className="text-muted-foreground text-sm">
					{m.categorize_no_suggestion()}
				</p>
			)}
			<FormAlert
				message={error?.form ?? Object.values(error?.fields ?? {})[0]}
			/>
		</li>
	);
}
