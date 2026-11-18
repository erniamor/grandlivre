import { describe, expect, it } from "vitest";
import { DEMO_MONTHS, demoPlan } from "@/routes/households/demo/demo-plan";
import { suggestedTags } from "@/routes/tags/suggested-tags";

const TODAY = "2026-11-17";

function keysOf(tags: typeof suggestedTags): string[] {
	return tags.flatMap((tag) => [tag.key, ...keysOf(tag.children)]);
}

describe("demoPlan", () => {
	const plan = demoPlan(TODAY, "fr");

	it("names the household and its accounts in the member's language", () => {
		expect(plan.name).toBe("Foyer de démo");
		expect(plan.accounts.map(({ name, type }) => [name, type])).toEqual([
			["Compte courant", "checking"],
			["Épargne", "savings"],
			["Carte de crédit", "credit_card"],
			["Portefeuille", "cash"],
		]);
		expect(demoPlan(TODAY, "es").name).toBe("Hogar de demostración");
	});

	it("goes back six months, up to today and never past it", () => {
		const dates = plan.transactions.map(({ date }) => date);
		expect(dates[0]?.startsWith("2026-06")).toBe(true);
		expect(dates.every((date) => date <= TODAY)).toBe(true);
		expect(new Set(dates.map((date) => date.slice(0, 7))).size).toBe(
			DEMO_MONTHS,
		);
		expect(plan.transactions.length).toBeGreaterThan(150);
	});

	it("only uses suggested tags, and leaves a few payees to sort", () => {
		const known = new Set(keysOf(suggestedTags));
		expect(plan.tagKeys.every((key) => known.has(key))).toBe(true);
		const untagged = plan.transactions.filter(
			(each) => each.type !== "transfer" && each.tagKey === null,
		);
		expect(new Set(untagged.map(({ payee }) => payee))).toEqual(
			new Set(["Quincaillerie Delorme", "Librairie Pages"]),
		);
	});

	it("makes transactions the app accepts: positive amounts, transfers between two accounts", () => {
		for (const each of plan.transactions) {
			expect(each.amount).toBeGreaterThan(0);
			expect(Number.isInteger(each.amount)).toBe(true);
			if (each.type === "transfer") {
				expect(each.toAccount).toBeDefined();
				expect(each.toAccount).not.toBe(each.account);
			} else {
				expect(each.toAccount).toBeUndefined();
			}
		}
	});

	it("pays the card each month for what it spent the month before", () => {
		const payment = plan.transactions.find(
			(each) => each.toAccount === "card" && each.date === "2026-11-22",
		);
		const october = plan.transactions
			.filter(
				(each) =>
					each.account === "card" &&
					each.type === "expense" &&
					each.date.startsWith("2026-10"),
			)
			.reduce((total, each) => total + each.amount, 0);
		// Not yet: the 22nd is to come
		expect(payment).toBeUndefined();
		expect(
			plan.transactions.find(
				(each) => each.toAccount === "card" && each.date === "2026-10-22",
			)?.amount,
		).toBeGreaterThan(0);
		expect(october).toBeGreaterThan(0);
	});

	it("leaves the latest power bill waiting to be confirmed, the rest recorded on their own", () => {
		const power = plan.recurring.find(
			(each) => each.tagKey === "home/electricity",
		);
		expect(power).toMatchObject({
			mode: "confirm",
			pendingDate: "2026-10-20",
			nextDate: "2026-11-20",
		});
		expect(
			plan.transactions.some(
				(each) =>
					each.tagKey === "home/electricity" && each.date === "2026-10-20",
			),
		).toBe(false);
		expect(
			plan.recurring.filter(({ mode }) => mode === "automatic"),
		).toHaveLength(4);
		expect(plan.recurring.every(({ nextDate }) => nextDate > TODAY)).toBe(true);
	});

	it("sets three monthly budgets from the first month", () => {
		expect(
			plan.budgets.map(({ tagKey, fromMonth }) => [tagKey, fromMonth]),
		).toEqual([
			["food/groceries", "2026-06-01"],
			["food/restaurant", "2026-06-01"],
			["transport/car/gas", "2026-06-01"],
		]);
	});

	it("is the same for the same day", () => {
		expect(demoPlan(TODAY, "fr")).toEqual(plan);
	});
});
