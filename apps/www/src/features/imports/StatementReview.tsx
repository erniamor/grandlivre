import type { Account, Tag } from "@repo/schemas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FormAlert } from "@/components/FormAlert";
import { AccountTabLabel } from "@/features/imports/AccountTabLabel";
import {
	firstCorrectionAccount,
	goToFirstCorrection,
} from "@/features/imports/first-correction";
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
	// The account of the file shown, by its place, while the file has several
	const [shown, setShown] = useState<string | null>(null);
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
	const summaries = new Map(
		preview.accounts.map((account) => [
			account.index,
			summarizeAccount(account, draft),
		]),
	);
	const tabs = preview.accounts.length > 1;
	const active =
		shown !== null &&
		preview.accounts.some((account) => String(account.index) === shown)
			? shown
			: String(preview.accounts[0]?.index ?? 0);
	const goToCorrection = () => {
		const index = firstCorrectionAccount(problems);
		if (tabs && index !== null) {
			// Its tab open first: only the tab shown is in the page
			flushSync(() => setShown(String(index)));
		}
		goToFirstCorrection(review.current);
	};
	const accountReview = (account: (typeof preview.accounts)[number]) => (
		<StatementAccountReview
			key={account.index}
			account={account}
			summary={summaries.get(account.index) ?? summary}
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
	);

	return (
		<div ref={review} className="grid gap-6">
			<ImportSummaryPanel summary={summary} currency={currency} />
			{tabs ? (
				<Tabs value={active} onValueChange={setShown}>
					<TabsList
						aria-label={m.import_tabs_label()}
						className="h-auto w-full justify-start overflow-x-auto"
					>
						{preview.accounts.map((account) => {
							const destination = draft.destinations[account.index];
							return (
								<TabsTrigger
									key={account.index}
									value={String(account.index)}
									className="flex-none"
								>
									<AccountTabLabel
										account={account}
										destination={
											destination?.kind === "skip"
												? null
												: (nameOf(account.index) ?? "")
										}
										fresh={summaries.get(account.index)?.fresh ?? 0}
										corrections={problems.some(
											(problem) =>
												"index" in problem && problem.index === account.index,
										)}
									/>
								</TabsTrigger>
							);
						})}
					</TabsList>
					{preview.accounts.map((account) => (
						<TabsContent key={account.index} value={String(account.index)}>
							{accountReview(account)}
						</TabsContent>
					))}
				</Tabs>
			) : (
				preview.accounts.map(accountReview)
			)}
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
				onCorrection={goToCorrection}
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
