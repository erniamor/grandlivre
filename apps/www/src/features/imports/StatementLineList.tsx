import type {
	Account,
	StatementPreviewAccount,
	StatementPreviewLine,
} from "@repo/schemas";
import type { SelectOption } from "@/components/SelectField";
import { HelpHint } from "@/features/help/HelpHint";
import {
	type ImportDraft,
	type LineChoice,
	lineStatus,
	pairedBy,
	standingHolds,
	transferAccounts,
} from "@/features/imports/import-draft";
import { StatementLineItem } from "@/features/imports/StatementLineItem";
import { m } from "@/paraglide/messages";

interface StatementLineListProps {
	account: StatementPreviewAccount;
	draft: ImportDraft;
	accounts: Account[];
	currency: string;
	tagOptions: SelectOption<string>[];
	/** The name an account of the file goes by, where it goes. */
	nameOf: (index: number) => string | null;
	/** The lines whose transfer misses its account. */
	missing: Set<string>;
	onChoice: (externalId: string, choice: LineChoice) => void;
}

/**
 * An account's lines, by what the preview found: the new ones first, then
 * those already in the app (entered, or their transfer's other side
 * entered elsewhere), the recurring days waiting, and those imported
 * before, folded away.
 */
export function StatementLineList({
	account,
	draft,
	accounts,
	currency,
	tagOptions,
	nameOf,
	missing,
	onChoice,
}: StatementLineListProps) {
	const destination = draft.destinations[account.index];
	const holds = standingHolds(account, destination);
	const statusOf = (line: StatementPreviewLine) =>
		lineStatus(line, holds, destination);
	const of = (...statuses: StatementPreviewLine["status"][]) =>
		account.lines.filter((line) => statuses.includes(statusOf(line)));
	const groups = [
		{ title: m.import_group_new(), lines: of("new") },
		{
			title: m.import_group_matched(),
			lines: of("matched", "counterpart"),
			hint: "importKnown" as const,
		},
		{ title: m.import_group_recurring(), lines: of("recurring") },
	];
	const imported = of("imported");
	const item = (line: StatementPreviewLine) => {
		const pair = pairedBy(draft, account.index, line);
		return (
			<StatementLineItem
				key={line.externalId}
				line={line}
				status={statusOf(line)}
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
				tagOptions={tagOptions}
				missing={
					missing.has(line.externalId) ? m.import_transfer_missing() : undefined
				}
				onChange={(choice) => onChoice(line.externalId, choice)}
			/>
		);
	};

	return (
		<div className="grid gap-4">
			{groups.map(
				({ title, lines, hint }) =>
					lines.length > 0 && (
						<section key={title} className="grid gap-1">
							<div className="flex items-center gap-1">
								<h3 className="font-medium text-sm">
									{title} ({lines.length})
								</h3>
								{hint && <HelpHint topic={hint} />}
							</div>
							<ul>{lines.map(item)}</ul>
						</section>
					),
			)}
			{imported.length > 0 && (
				<details className="grid gap-1">
					<summary className="cursor-pointer text-muted-foreground text-sm">
						{m.import_group_imported({ count: imported.length })}
					</summary>
					<ul>{imported.map(item)}</ul>
				</details>
			)}
		</div>
	);
}
