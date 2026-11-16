import type { Account, Tag } from "@repo/schemas";
import { Button } from "@repo/ui";
import { ArrowUpIcon } from "lucide-react";
import { useRef } from "react";
import { FormAlert } from "@/components/FormAlert";
import { goToFirstCorrection } from "@/features/imports/first-correction";
import { statementAccountName } from "@/features/imports/import-draft";
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

/** A file read: each of its accounts to review, then the import. */
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

	return (
		<div ref={review} className="grid gap-6">
			{preview.accounts.map((account) => (
				<StatementAccountReview
					key={account.index}
					account={account}
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
			<div className="grid gap-2">
				<FormAlert
					message={
						problems.some((problem) => problem.kind === "nothing")
							? m.import_nothing()
							: problems.length > 0
								? m.import_problems()
								: (saveError?.form ?? Object.values(saveError?.fields ?? {})[0])
					}
				/>
				{problems.some((problem) => problem.kind !== "nothing") && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="justify-self-start"
						onClick={() => goToFirstCorrection(review.current)}
					>
						<ArrowUpIcon aria-hidden />
						{m.import_go_to_correction()}
					</Button>
				)}
			</div>
			<div className="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="outline" onClick={importer.restart}>
					{m.import_other_file()}
				</Button>
				{importer.saveError && (
					<Button
						type="button"
						variant="outline"
						onClick={() => importer.choose(reviewing.file)}
					>
						{m.import_read_again()}
					</Button>
				)}
				<Button
					type="button"
					disabled={importer.saving || importer.reading}
					onClick={importer.submit}
				>
					{importer.saving ? m.import_saving() : m.import_submit()}
				</Button>
			</div>
		</div>
	);
}
