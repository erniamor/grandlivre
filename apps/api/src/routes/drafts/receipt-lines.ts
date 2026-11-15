/** The amount of a receipt's items that went to one tag, before taxes. */
export interface ItemGroup<Key> {
	key: Key;
	/** In minor units; negative when the group holds only discounts. */
	amount: number;
}

/**
 * Splits what was paid among the receipt's groups of items, in proportion
 * to their amounts before taxes: the taxes (and any gap between the items
 * and the total) are shared out, so that each tag carries its real cost
 * and the lines add up to the total to the cent.
 *
 * A group that isn't positive (discounts alone) joins the biggest group.
 * Without a positive group, the whole total is one line, under `fallback`.
 */
export function shareTotal<Key>(
	total: number,
	groups: ItemGroup<Key>[],
	fallback: Key,
): ItemGroup<Key>[] {
	const positive = groups.filter((group) => group.amount > 0);
	if (positive.length === 0) {
		return [{ key: fallback, amount: total }];
	}
	const biggest = positive.reduce((best, group) =>
		group.amount > best.amount ? group : best,
	);
	const rest = groups
		.filter((group) => group.amount <= 0)
		.reduce((sum, group) => sum + group.amount, 0);
	const weights = positive.map((group) => ({
		key: group.key,
		amount: group === biggest ? group.amount + rest : group.amount,
	}));
	const weightTotal = weights.reduce((sum, group) => sum + group.amount, 0);
	if (weightTotal <= 0) {
		return [{ key: fallback, amount: total }];
	}

	// Largest remainder: each share rounded down, then the cents left go to
	// the groups that lost the most in the rounding
	const exact = weights.map((group) => (total * group.amount) / weightTotal);
	const shares = exact.map((value) => Math.floor(value));
	let left = total - shares.reduce((sum, share) => sum + share, 0);
	const byRemainder = exact
		.map((value, index) => ({ index, remainder: value - Math.floor(value) }))
		.sort((a, b) => b.remainder - a.remainder);
	for (const { index } of byRemainder) {
		if (left <= 0) {
			break;
		}
		shares[index] = (shares[index] ?? 0) + 1;
		left -= 1;
	}
	return weights
		.map((group, index) => ({ key: group.key, amount: shares[index] ?? 0 }))
		.filter((group) => group.amount > 0);
}
