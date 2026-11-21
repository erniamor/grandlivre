import type { Account, Tag } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useState } from "react";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { AmountRangeFilter } from "@/features/transactions/AmountRangeFilter";
import { TransactionSearchField } from "@/features/transactions/TransactionSearchField";
import { TransactionTypeFilter } from "@/features/transactions/TransactionTypeFilter";
import {
	hasFilters,
	type TransactionListFilters,
} from "@/features/transactions/transaction-filters";
import { accountsWithDetails } from "@/features/transactions/transaction-view";
import { UntaggedFilter } from "@/features/transactions/UntaggedFilter";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface TransactionFiltersProps {
	filters: TransactionListFilters;
	accounts: Account[];
	tags: Tag[];
	/** The household's, for the amounts. */
	currency: string;
	onChange: (filters: TransactionListFilters) => void;
}

// A select's value is a string: this one stands for "no filter"
const ALL = "";

/**
 * Narrows the list: words searched, a type, the transactions without a tag
 * (to categorize or undetermined), an account, a tag, a period, an amount
 * range. Each applies at once, the search once typing pauses.
 */
export function TransactionFilters({
	filters,
	accounts,
	tags,
	currency,
	onChange,
}: TransactionFiltersProps) {
	const [periodError, setPeriodError] = useState<string>();
	const change = (next: TransactionListFilters) => {
		// Days written "YYYY-MM-DD" compare as text
		if (next.from && next.to && next.from > next.to) {
			setPeriodError(m.error_report_period_invalid());
			return;
		}
		setPeriodError(undefined);
		onChange(next);
	};
	const accountOptions: SelectOption<string>[] = [
		{ value: ALL, label: m.transactions_all_accounts() },
		...accountsWithDetails(accounts).map((account) => ({
			value: account.id,
			label: account.name,
		})),
	];
	const tagOptions: SelectOption<string>[] = [
		{ value: ALL, label: m.report_trend_all_tags() },
		...flattenTagTree(buildTagTree(tags, getLocale())).map(({ tag, path }) => ({
			value: tag.id,
			label: path,
		})),
	];

	return (
		<fieldset className="grid gap-4 rounded-lg border border-border p-4">
			<legend className="px-1 font-medium text-sm">
				{m.transactions_filters_label()}
			</legend>
			<TransactionSearchField
				value={filters.q}
				onSearch={(q) => change({ ...filters, q })}
			/>
			<TransactionTypeFilter
				value={filters.type}
				onChange={(type) => change({ ...filters, type })}
			/>
			<UntaggedFilter
				value={filters.untagged}
				onChange={(untagged) => change({ ...filters, untagged })}
			/>
			<div className="grid gap-3 sm:grid-cols-2">
				<SelectField
					label={m.transactions_account_filter_label()}
					value={filters.accountId ?? ALL}
					options={accountOptions}
					onChange={(value) =>
						change({ ...filters, accountId: value || undefined })
					}
					tone="default"
					className="grid items-stretch font-medium"
				/>
				<SelectField
					label={m.transaction_tag_label()}
					value={filters.tagId ?? ALL}
					options={tagOptions}
					onChange={(value) =>
						change({ ...filters, tagId: value || undefined })
					}
					tone="default"
					className="grid items-stretch font-medium"
				/>
				<TextField
					label={m.period_from_label()}
					type="date"
					value={filters.from ?? ""}
					onChange={(event) =>
						change({ ...filters, from: event.target.value || undefined })
					}
				/>
				<TextField
					label={m.period_to_label()}
					type="date"
					value={filters.to ?? ""}
					onChange={(event) =>
						change({ ...filters, to: event.target.value || undefined })
					}
					error={periodError}
				/>
			</div>
			<AmountRangeFilter
				range={filters}
				currency={currency}
				onChange={(range) => change({ ...filters, ...range })}
			/>
			{hasFilters(filters) && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="justify-self-start"
					onClick={() => change({})}
				>
					{m.transactions_clear_filters()}
				</Button>
			)}
		</fieldset>
	);
}
