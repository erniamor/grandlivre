import type { Account, Tag } from "@repo/schemas";
import { useRef } from "react";
import { FormAlert } from "@/components/FormAlert";
import { goToFirstCorrection } from "@/features/imports/first-correction";
import { ImportActionBar } from "@/features/imports/ImportActionBar";
import { ImportSummaryPanel } from "@/features/imports/ImportSummaryPanel";
import { statementAccountName } from "@/features/imports/import-draft";
import {
	summarizeAccount,
	summarizeImport,
} from "@/features/imports/import-summary";
import { StatementAccountReview } from "@/features/imports/StatementAccountReview";
import type { StatementImporter } from "@/features/imports/use-statement-import";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface StatementReviewProps {
	importer: StatementImporter;
	accounts: Account[];
	tags: Tag[];
	currency: string;
}

/**
 * A file read: what it comes to, each of its accounts to review, and the
 * import, its actions kept in sight.
 */
export function StatementReview({
	importer,
	accounts,
	tags,
	currency,
}: StatementReviewProps) {
	const review = useRef<HTMLDivElement>(null);
	const { reviewing, problems } = importer;
	if (!reviewing) {
		return null;
	}
	const { preview, draft } = reviewing;
	const tagOptions = [
		{ value: "", label: m.transaction_uncategorized() },
		...flattenTagTree(buildTagTree(tags, getLocale())).map(({ tag, path }) => ({
			value: tag.id,
			label: path,
		})),
	];
	const nameOf = (index: number) => {
		const destination = draft.destinations[index];
		if (destination?.kind === "account") {
			return (
				accounts.find((account) => account.id === destination.accountId)
					?.name ?? null
			);
		}
		if (destination?.kind === "with") {
			const other = draft.destinations[destination.index];
			return other?.kind === "new"
				? other.name
				: other?.kind === "account"
					? (accounts.find((account) => account.id === other.accountId)?.name ??
						null)
					: null;
		}
		return destination?.kind === "new" ? destination.name : null;
	};
	const saveError = importer.saveError ? formErrors(importer.saveError) : null;
	const summary = summarizeImport(preview, draft);

	return (
		<div ref={review} className="grid gap-6">
			<ImportSummaryPanel summary={summary} currency={currency} />
			{preview.accounts.map((account) => (
				<StatementAccountReview
					key={account.index}
					account={account}
					summary={summarizeAccount(account, draft)}
					draft={draft}
					accounts={accounts}
					currency={currency}
					tagOptions={tagOptions}
					nameOf={nameOf}
					companions={preview.accounts
						.filter(
							(other) =>
								other.index !== account.index &&
								draft.destinations[other.index]?.kind === "new",
						)
						.map((other) => ({
							index: other.index,
							name: statementAccountName(other),
						}))}
					problems={problems}
					reading={importer.reading}
					onDestination={(destination) =>
						importer.setDestination(account.index, destination)
					}
					onChoice={(externalId, choice) =>
						importer.setChoice(account.index, externalId, choice)
					}
				/>
			))}
			<FormAlert
				message={
					problems.some((problem) => problem.kind === "nothing")
						? m.import_nothing()
						: problems.length > 0
							? m.import_problems()
							: (saveError?.form ?? Object.values(saveError?.fields ?? {})[0])
				}
			/>
			<ImportActionBar
				newTransactions={summary.newTransactions}
				corrections={problems.some((problem) => problem.kind !== "nothing")}
				onCorrection={() => goToFirstCorrection(review.current)}
				failed={importer.saveError !== null}
				onReadAgain={() => importer.choose(reviewing.file)}
				onOtherFile={importer.restart}
				saving={importer.saving}
				disabled={importer.saving || importer.reading}
				onSubmit={importer.submit}
			/>
		</div>
	);
}
