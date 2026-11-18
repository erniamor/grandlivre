import type { Account, StatementPreviewAccount } from "@repo/schemas";
import { useState } from "react";
import {
	type ImportDraft,
	type LineChoice,
	lineStatus,
	pairedBy,
	standingHolds,
	transferAccounts,
} from "@/features/imports/import-draft";
import { LineFilterBar } from "@/features/imports/LineFilterBar";
import {
	countByFilter,
	defaultFilter,
	type FilteredLine,
	type LineFilter,
	visibleLines,
} from "@/features/imports/line-filters";
import { StatementLineItem } from "@/features/imports/StatementLineItem";
import type { TagNode } from "@/features/tags/tag-tree";
import { m } from "@/paraglide/messages";

interface StatementLineListProps {
	account: StatementPreviewAccount;
	draft: ImportDraft;
	accounts: Account[];
	currency: string;
	/** The household's tags (`buildTagTree()`), built once for every line. */
	tagTree: TagNode[];
	/** The name an account of the file goes by, where it goes. */
	nameOf: (index: number) => string | null;
	/** The lines whose transfer misses its account. */
	missing: Set<string>;
	onChoice: (externalId: string, choice: LineChoice) => void;
}

/**
 * An account's lines, one filter at a time (what is to decide first, then
 * what is already in the app, the recurring days waiting, and what was
 * imported before) and searched by payee; the lines still to correct always
 * show.
 */
export function StatementLineList({
	account,
	draft,
	accounts,
	currency,
	tagTree,
	nameOf,
	missing,
	onChoice,
}: StatementLineListProps) {
	const [chosen, setChosen] = useState<LineFilter | null>(null);
	const [search, setSearch] = useState("");
	const destination = draft.destinations[account.index];
	const holds = standingHolds(account, destination);
	const lines: FilteredLine[] = account.lines.map((line) => ({
		line,
		status: lineStatus(line, holds, destination),
		paired: pairedBy(draft, account.index, line) !== null,
	}));
	const counts = countByFilter(lines);
	const filter = chosen ?? defaultFilter(counts);
	const shown = visibleLines(lines, filter, search, missing);
	const item = ({ line, status }: FilteredLine) => {
		const pair = pairedBy(draft, account.index, line);
		return (
			<StatementLineItem
				key={line.externalId}
				line={line}
				status={status}
				choice={draft.choices[account.index]?.[line.externalId] ?? null}
				holds={holds}
				pairedWith={pair ? (nameOf(pair.index) ?? "") : null}
				pairName={line.pair ? nameOf(line.pair.index) : null}
				matchAccountName={
					accounts.find((each) => each.id === line.match?.accountId)?.name ??
					null
				}
				currency={currency}
				transferAccounts={transferAccounts(accounts, line, destination)}
				tagTree={tagTree}
				missing={
					missing.has(line.externalId) ? m.import_transfer_missing() : undefined
				}
				onChange={(choice) => onChoice(line.externalId, choice)}
			/>
		);
	};

	return (
		<div className="grid gap-3">
			<LineFilterBar
				counts={counts}
				filter={filter}
				onFilter={setChosen}
				search={search}
				onSearch={setSearch}
			/>
			{shown.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{search.trim() === ""
						? m.import_filter_empty()
						: m.import_search_empty()}
				</p>
			) : (
				<ul aria-label={m.import_lines_label()}>{shown.map(item)}</ul>
			)}
		</div>
	);
}
