import type {
	ShareSplit,
	SharingWeight,
	TransactionSharing,
} from "@repo/schemas";
import { formatAmountInput, parseAmount } from "@/lib/money";

/** How a transaction is shared, as the form holds it, as typed. */
export interface ShareFormState {
	/** Whether it is shared at all. */
	on: boolean;
	mode: ShareSplit["mode"];
	/** The members it is shared among, in equal parts. */
	included: string[];
	/** Each member's weight, as typed: "60". */
	weights: Record<string, string>;
	/** Each member's amount, as typed: "12,50". */
	amounts: Record<string, string>;
}

/**
 * The form's sharing: as the transaction is shared, or, until turned on,
 * the household's default split: equal parts when every weight is the
 * same, the weights otherwise.
 */
export function shareStateOf(
	sharing: TransactionSharing | undefined,
	defaults: SharingWeight[],
	currency: string,
	locale: string,
): ShareFormState {
	const weights = Object.fromEntries(
		defaults.map(({ userId, weight }) => [userId, String(weight)]),
	);
	if (!sharing) {
		const values = new Set(defaults.map((each) => each.weight));
		return {
			on: false,
			mode: values.size <= 1 ? "equal" : "weights",
			included: defaults
				.filter((each) => each.weight > 0)
				.map((each) => each.userId),
			weights,
			amounts: {},
		};
	}
	const { split, parts } = sharing;
	return {
		on: true,
		mode: split.mode,
		included: parts
			.filter((part) => part.amount > 0)
			.map((part) => part.userId),
		weights:
			split.mode === "weights"
				? Object.fromEntries(
						split.parts.map(({ userId, weight }) => [userId, String(weight)]),
					)
				: weights,
		amounts: Object.fromEntries(
			parts.map(({ userId, amount }) => [
				userId,
				formatAmountInput(amount, currency, locale),
			]),
		),
	};
}

type ShareResult =
	| { ok: true; split: ShareSplit }
	| { ok: false; error: string };

/** The split to send, from what was typed; or the code of what is wrong. */
export function toShareSplit(
	state: ShareFormState,
	memberIds: string[],
	currency: string,
	locale: string,
): ShareResult {
	if (state.mode === "equal") {
		const userIds = memberIds.filter((id) => state.included.includes(id));
		return userIds.length > 0
			? { ok: true, split: { mode: "equal", userIds } }
			: { ok: false, error: "share_members_required" };
	}
	if (state.mode === "weights") {
		const parts: { userId: string; weight: number }[] = [];
		for (const userId of memberIds) {
			const text = (state.weights[userId] ?? "").trim();
			if (text === "") {
				continue;
			}
			if (!/^\d+$/.test(text)) {
				return { ok: false, error: "share_weight_invalid" };
			}
			parts.push({ userId, weight: Number(text) });
		}
		return parts.some((part) => part.weight > 0)
			? { ok: true, split: { mode: "weights", parts } }
			: { ok: false, error: "share_weight_invalid" };
	}
	const parts: { userId: string; amount: number }[] = [];
	for (const userId of memberIds) {
		const text = (state.amounts[userId] ?? "").trim();
		if (text === "") {
			continue;
		}
		const amount = parseAmount(text, currency, locale);
		if (amount === null || amount < 0) {
			return { ok: false, error: "amount_invalid" };
		}
		parts.push({ userId, amount });
	}
	return parts.length > 0
		? { ok: true, split: { mode: "amounts", parts } }
		: { ok: false, error: "share_members_required" };
}
