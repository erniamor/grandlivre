import type { Household, UncategorizedPayee } from "@repo/schemas";
import { Button, toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { getApi } from "@/lib/api";
import { formatShortDay } from "@/lib/dates";
import { formErrors } from "@/lib/error-messages";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface PayeeGroupItemProps {
	household: Household;
	group: UncategorizedPayee;
	/** The household's tags, by their path; an empty value first, for none chosen. */
	tagOptions: SelectOption<string>[];
}

/**
 * A payee's transactions without a tag: how many, how much, since when;
 * and one tag for all of them.
 */
export function PayeeGroupItem({
	household,
	group,
	tagOptions,
}: PayeeGroupItemProps) {
	const locale = getLocale();
	const titleId = useId();
	const queryClient = useQueryClient();
	const [tagId, setTagId] = useState("");
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
				<h2 id={titleId} className="font-medium">
					{group.payee}
				</h2>
				<p className="tabular-nums">
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
				<SelectField
					label={m.categorize_tag_label({ payee: group.payee })}
					hideLabel
					value={tagId}
					options={tagOptions}
					onChange={setTagId}
					tone="default"
				/>
				<Button
					type="button"
					disabled={tagId === "" || categorize.isPending}
					onClick={() => categorize.mutate()}
				>
					{m.categorize_submit()}
				</Button>
			</div>
			<FormAlert
				message={error?.form ?? Object.values(error?.fields ?? {})[0]}
			/>
		</li>
	);
}
