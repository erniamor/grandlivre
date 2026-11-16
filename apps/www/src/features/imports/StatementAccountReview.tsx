import type { Account, StatementPreviewAccount } from "@repo/schemas";
import { useId } from "react";
import type { SelectOption } from "@/components/SelectField";
import { accountTypeLabels } from "@/features/accounts/account-type-labels";
import { DestinationField } from "@/features/imports/DestinationField";
import {
	type Destination,
	type DraftProblem,
	destinationAccounts,
	type ImportDraft,
	type LineChoice,
	statementAccountName,
} from "@/features/imports/import-draft";
import { StatementLineList } from "@/features/imports/StatementLineList";
import { formatShortDay } from "@/lib/dates";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface StatementAccountReviewProps {
	account: StatementPreviewAccount;
	draft: ImportDraft;
	accounts: Account[];
	currency: string;
	tagOptions: SelectOption<string>[];
	nameOf: (index: number) => string | null;
	/** The other accounts of the file going to a new account: this one can go with them. */
	companions: { index: number; name: string }[];
	problems: DraftProblem[];
	reading: boolean;
	onDestination: (destination: Destination) => void;
	onChoice: (externalId: string, choice: LineChoice) => void;
}

/** An account of the file: what it is, where it goes, and its lines. */
export function StatementAccountReview({
	account,
	draft,
	accounts,
	currency,
	tagOptions,
	nameOf,
	companions,
	problems,
	reading,
	onDestination,
	onChoice,
}: StatementAccountReviewProps) {
	const locale = getLocale();
	const titleId = useId();
	const destination = draft.destinations[account.index] ?? { kind: "skip" };
	const mine = problems.filter(
		(problem) => "index" in problem && problem.index === account.index,
	);
	const missing = new Set(
		mine.flatMap((problem) =>
			problem.kind === "transfer" ? [problem.externalId] : [],
		),
	);

	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-4 rounded-lg border border-border p-4"
		>
			<header className="grid gap-1">
				<h2 id={titleId} className="font-heading font-semibold text-lg">
					{statementAccountName(account)}
				</h2>
				<p className="text-muted-foreground text-sm">
					{m.import_account_summary({
						type: accountTypeLabels[account.type](),
						from: formatShortDay(account.from, locale),
						to: formatShortDay(account.to, locale),
						count: account.lines.length,
					})}
				</p>
			</header>
			<DestinationField
				account={account}
				destination={destination}
				accounts={destinationAccounts(accounts)}
				companions={companions}
				currency={currency}
				disabled={reading}
				errors={{
					name: mine.some((problem) => problem.kind === "name")
						? m.error_account_name_required()
						: undefined,
					owed: mine.some((problem) => problem.kind === "owed")
						? m.error_amount_invalid()
						: undefined,
					with: mine.some((problem) => problem.kind === "with")
						? m.import_destination_with_invalid()
						: undefined,
				}}
				onChange={onDestination}
			/>
			{destination.kind !== "skip" && (
				<StatementLineList
					account={account}
					draft={draft}
					accounts={accounts}
					currency={currency}
					tagOptions={tagOptions}
					nameOf={nameOf}
					missing={missing}
					onChoice={onChoice}
				/>
			)}
		</section>
	);
}
