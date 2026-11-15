import type {
	Account,
	Locale,
	RecurringTransaction,
	Tag,
	TransactionDraft,
} from "@repo/schemas";
import { buildTagTree, flattenTagTree } from "@/features/tags/tag-tree";
import { m } from "@/paraglide/messages";

type Template = RecurringTransaction["transaction"];

const typeLabels = {
	expense: m.transaction_type_expense,
	income: m.transaction_type_income,
	transfer: m.transaction_type_transfer,
};

/** Its name: who is paid, or who pays; else its type. */
export function templateTitle(template: Template): string {
	return template.payee ?? typeLabels[template.type]();
}

/**
 * Where its money goes, in words: its tags and its account, or the two
 * accounts of a transfer.
 */
export function templateWhere(
	template: Template,
	accounts: Account[],
	tags: Tag[],
	locale: Locale,
): string {
	const nameOf = (id: string | null) =>
		accounts.find((account) => account.id === id)?.name ??
		m.transaction_unknown_account();
	if (template.type === "transfer") {
		return m.transaction_transfer_accounts({
			from: nameOf(template.accountId),
			to: nameOf(template.toAccountId),
		});
	}
	const paths = new Map(
		flattenTagTree(buildTagTree(tags, locale)).map(({ tag, path }) => [
			tag.id,
			path,
		]),
	);
	return [
		...new Set(
			template.lines.map(
				(line) =>
					(line.tagId && paths.get(line.tagId)) ||
					m.transaction_uncategorized(),
			),
		),
		nameOf(template.accountId),
	].join(" · ");
}

/** -1 for money going out, 1 coming in, 0 moving between the household's accounts. */
export function templateDirection(template: Template): -1 | 0 | 1 {
	return template.type === "expense" ? -1 : template.type === "income" ? 1 : 0;
}

/**
 * A waiting day as a draft for the transaction form: what the recurring
 * transaction records, on that day, for the member to review.
 */
export function draftOfOccurrence(
	date: string,
	{ transaction }: RecurringTransaction,
): TransactionDraft {
	return {
		type: transaction.type,
		date,
		accountId: transaction.accountId,
		toAccountId: transaction.toAccountId,
		payee: transaction.payee,
		note: transaction.note,
		// A transfer's amount is the first line of the form
		lines:
			transaction.type === "transfer"
				? [{ amount: transaction.amount, tagId: null, usesProposedTag: false }]
				: transaction.lines.map((line) => ({
						...line,
						usesProposedTag: false,
					})),
		proposedTag: null,
		remark: null,
		receipt: null,
		warnings: [],
	};
}
