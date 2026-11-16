import type { StatementSuggestion } from "@repo/schemas";
import { descriptionKey } from "@/routes/imports/statements/fingerprint";

/** A transaction recorded before, as far as its payee tells what the next will be. */
export interface PastTransaction {
	payee: string;
	type: "expense" | "income" | "transfer";
	accountId: string;
	toAccountId: string | null;
	/** The tags of its lines; null for a line without one. */
	tagIds: (string | null)[];
}

/** What a payee was the last time: a tag, or a transfer between two accounts. */
type Habit =
	| { kind: "tag"; tagId: string }
	| { kind: "transfer"; accounts: [string, string] };

/** A payee's key is its letters: the shortest a payee may be to stand for longer ones. */
const MIN_PREFIX = 4;

/**
 * What each payee was the last time, from transactions most recent first:
 * a tag when all its lines have the same, the accounts of a transfer.
 */
export function payeeHabits(past: PastTransaction[]): Map<string, Habit> {
	const habits = new Map<string, Habit>();
	for (const transaction of past) {
		const key = descriptionKey(transaction.payee);
		if (key === "" || habits.has(key)) {
			continue;
		}
		if (transaction.type === "transfer" && transaction.toAccountId) {
			habits.set(key, {
				kind: "transfer",
				accounts: [transaction.accountId, transaction.toAccountId],
			});
			continue;
		}
		const [tagId, ...others] = new Set(transaction.tagIds);
		if (tagId && others.length === 0) {
			habits.set(key, { kind: "tag", tagId });
		}
	}
	return habits;
}

/**
 * What a statement line's payee was before, on the account `accountId`
 * (null for an account still to make): the habit of the same payee, or of
 * the longest one it starts with ("COSTCO ESSENCE W100" is "Costco"). A
 * transfer is only suggested on one of its two accounts, to the other.
 */
export function suggestFromHabits(
	habits: Map<string, Habit>,
	payee: string,
	accountId: string | null,
): StatementSuggestion | null {
	const key = descriptionKey(payee);
	let habit = habits.get(key);
	if (!habit) {
		let longest = "";
		for (const [known, each] of habits) {
			if (
				known.length >= MIN_PREFIX &&
				known.length > longest.length &&
				key.startsWith(known)
			) {
				longest = known;
				habit = each;
			}
		}
	}
	if (!habit) {
		return null;
	}
	if (habit.kind === "tag") {
		return habit;
	}
	const [from, to] = habit.accounts;
	const other = accountId === from ? to : accountId === to ? from : null;
	return other ? { kind: "transfer", accountId: other } : null;
}
