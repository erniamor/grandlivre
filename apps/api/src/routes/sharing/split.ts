import type {
	SettlementSuggestion,
	SharePart,
	ShareSplit,
} from "@repo/schemas";

/**
 * Splits `amount` in proportion to `weights`, rounded to the minor unit:
 * each share rounded down, then the units left go to the largest
 * remainders. The shares always add up to `amount`.
 */
export function allocate(amount: number, weights: number[]): number[] {
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	const exact = weights.map((weight) => (amount * weight) / total);
	const shares = exact.map((value) => Math.floor(value));
	let left = amount - shares.reduce((sum, share) => sum + share, 0);
	const byRemainder = exact
		.map((value, index) => ({ index, remainder: value - Math.floor(value) }))
		.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
	for (const { index } of byRemainder) {
		if (left <= 0) {
			break;
		}
		shares[index] = (shares[index] ?? 0) + 1;
		left -= 1;
	}
	return shares;
}

/** Each member's part of `amount` under a split, or the code of what is wrong. */
export function partsOf(
	split: ShareSplit,
	amount: number,
): { parts: SharePart[] } | { error: string } {
	const entries =
		split.mode === "equal"
			? split.userIds.map((userId) => ({ userId, value: 1 }))
			: split.mode === "weights"
				? split.parts.map(({ userId, weight }) => ({ userId, value: weight }))
				: split.parts.map(({ userId, amount: part }) => ({
						userId,
						value: part,
					}));
	if (new Set(entries.map((entry) => entry.userId)).size !== entries.length) {
		return { error: "share_members_invalid" };
	}
	if (split.mode === "amounts") {
		const sum = entries.reduce((total, entry) => total + entry.value, 0);
		return sum === amount
			? {
					parts: entries.map(({ userId, value }) => ({
						userId,
						amount: value,
					})),
				}
			: { error: "share_amounts_mismatch" };
	}
	if (entries.every((entry) => entry.value === 0)) {
		return { error: "share_weight_invalid" };
	}
	const shares = allocate(
		amount,
		entries.map((entry) => entry.value),
	);
	return {
		parts: entries.map(({ userId }, index) => ({
			userId,
			amount: shares[index] ?? 0,
		})),
	};
}

/**
 * The fewest payments that bring every balance to zero: the one who owes
 * the most pays the one owed the most, and so on. Balances add up to zero.
 */
export function settleUp(
	balances: { userId: string; balance: number }[],
): SettlementSuggestion[] {
	const owed = balances
		.filter((each) => each.balance > 0)
		.map((each) => ({ ...each }))
		.sort((a, b) => b.balance - a.balance || a.userId.localeCompare(b.userId));
	const owing = balances
		.filter((each) => each.balance < 0)
		.map((each) => ({ userId: each.userId, balance: -each.balance }))
		.sort((a, b) => b.balance - a.balance || a.userId.localeCompare(b.userId));
	const payments: SettlementSuggestion[] = [];
	let i = 0;
	let j = 0;
	while (i < owing.length && j < owed.length) {
		const debtor = owing[i];
		const creditor = owed[j];
		if (!debtor || !creditor) {
			break;
		}
		const amount = Math.min(debtor.balance, creditor.balance);
		payments.push({
			fromUserId: debtor.userId,
			toUserId: creditor.userId,
			amount,
		});
		debtor.balance -= amount;
		creditor.balance -= amount;
		if (debtor.balance === 0) {
			i += 1;
		}
		if (creditor.balance === 0) {
			j += 1;
		}
	}
	return payments;
}
