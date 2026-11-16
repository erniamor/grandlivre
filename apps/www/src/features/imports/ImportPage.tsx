import type { Household } from "@repo/schemas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { ImportHistory } from "@/features/imports/ImportHistory";
import { ImportResult } from "@/features/imports/ImportResult";
import { fileErrorMessage } from "@/features/imports/import-errors";
import { StatementFileField } from "@/features/imports/StatementFileField";
import { StatementReview } from "@/features/imports/StatementReview";
import { useStatementImport } from "@/features/imports/use-statement-import";
import { tagsQueryOptions } from "@/features/tags/tags-query";
import { m } from "@/paraglide/messages";

interface ImportPageProps {
	household: Household;
	/** The account the page was opened from: a file of one account goes there. */
	fromAccountId?: string;
}

/**
 * Imports a bank statement: a file chosen, read and compared with the
 * household; the member reviews where each account goes and what each line
 * becomes; then the import, and what it did. Their recent imports below.
 */
export function ImportPage({ household, fromAccountId }: ImportPageProps) {
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const importer = useStatementImport(
		household.id,
		household.currency,
		fromAccountId,
	);

	return (
		<section className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.import_title()}
				</h1>
				<p className="text-muted-foreground">{m.import_intro()}</p>
			</header>
			{importer.imported ? (
				<ImportResult
					imported={importer.imported}
					accounts={accounts.items}
					currency={household.currency}
					onAgain={importer.restart}
				/>
			) : importer.reviewing ? (
				<StatementReview
					importer={importer}
					accounts={accounts.items}
					tags={tags}
					currency={household.currency}
				/>
			) : (
				<StatementFileField
					reading={importer.reading}
					error={
						importer.readError
							? fileErrorMessage(importer.readError)
							: undefined
					}
					onFile={importer.choose}
				/>
			)}
			<ImportHistory household={household} accounts={accounts.items} />
		</section>
	);
}
