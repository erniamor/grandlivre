import type {
	AccountType,
	RecurrenceMode,
	RecurrenceUnit,
} from "@repo/schemas";
import type { Locale } from "@/lib/locale";
import { occurrenceAt } from "@/routes/recurring/schedule";

/** The accounts of a demo household, by a short reference. */
export type DemoAccountRef = "chequing" | "savings" | "card" | "wallet";

export interface DemoAccount {
	ref: DemoAccountRef;
	name: string;
	type: AccountType;
	/** In minor units; negative for what a card owes. */
	openingBalance: number;
}

export interface DemoTransaction {
	type: "expense" | "income" | "transfer";
	date: string;
	account: DemoAccountRef;
	/** Where a transfer goes. */
	toAccount?: DemoAccountRef;
	/** In minor units, positive. */
	amount: number;
	payee: string | null;
	/** A suggested tag's key ("food/groceries"); null to leave it to sort. */
	tagKey: string | null;
}

export interface DemoRecurring {
	type: "expense" | "income" | "transfer";
	account: DemoAccountRef;
	toAccount?: DemoAccountRef;
	amount: number;
	payee: string | null;
	tagKey: string | null;
	unit: RecurrenceUnit;
	startDate: string;
	mode: RecurrenceMode;
	/** Its next day not yet recorded. */
	nextDate: string;
	/** A day come due, waiting for the member to confirm it. */
	pendingDate?: string;
}

export interface DemoBudget {
	tagKey: string;
	/** In minor units, per month. */
	amount: number;
	/** The first month it is in force, "YYYY-MM-01". */
	fromMonth: string;
}

/** A demo household's content, made up from a day. */
export interface DemoPlan {
	name: string;
	accounts: DemoAccount[];
	/** The suggested tags it uses, by their key. */
	tagKeys: string[];
	transactions: DemoTransaction[];
	recurring: DemoRecurring[];
	budgets: DemoBudget[];
}

/** How many months of history a demo household starts with, this one included. */
export const DEMO_MONTHS = 6;

const names: Record<
	Locale,
	{ household: string } & Record<DemoAccountRef, string>
> = {
	en: {
		household: "Demo household",
		chequing: "Chequing",
		savings: "Savings",
		card: "Credit card",
		wallet: "Wallet",
	},
	fr: {
		household: "Foyer de démo",
		chequing: "Compte courant",
		savings: "Épargne",
		card: "Carte de crédit",
		wallet: "Portefeuille",
	},
	es: {
		household: "Hogar de demostración",
		chequing: "Cuenta corriente",
		savings: "Ahorros",
		card: "Tarjeta de crédito",
		wallet: "Cartera",
	},
};

/**
 * The made-up payees: invented businesses, never real ones, the same in
 * every language as names are.
 */
const PAYEES = {
	employer: "Atelier Boréal",
	landlord: "Gestion Riverain",
	power: "Énergie Plus",
	phone: "Télécom Nova",
	internet: "Réseau Fibrex",
	streaming: "CinéFlux",
	gym: "Club Élan",
	groceries: ["Épicerie du Coin", "Marché Frais"],
	restaurants: ["Bistro Central", "Pizzeria Luna"],
	coffee: "Café Soleil",
	bakery: "Boulangerie Levain",
	gas: "Station Nord",
	pharmacy: "Pharmacie Santé+",
	// Left without a tag, to try sorting by payee
	untagged: ["Quincaillerie Delorme", "Librairie Pages"],
} as const;

/** A small seeded random number generator (mulberry32): the same plan for the same day. */
function random(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/** The first day of the month `months` before the month of `day`. */
function monthStart(day: string, months: number): string {
	const [year = 0, month = 1] = day.split("-").map(Number);
	const total = year * 12 + (month - 1) - months;
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** The day of a month ("2026-11") at `day`, or its last day when shorter. */
function dayOf(month: string, day: number): string {
	const [year = 0, index = 1] = month.split("-").map(Number);
	const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
	return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

/** A monthly schedule's next day after `today`, from its first day. */
function nextMonthly(startDate: string, today: string): string {
	for (let index = 0; ; index++) {
		const day = occurrenceAt({ unit: "month", interval: 1, startDate }, index);
		if (day > today) {
			return day;
		}
	}
}

/**
 * A demo household's content, made up for `today`: four accounts, a few
 * of the suggested tags, about six months of transactions up to today,
 * recurring ones (one day waiting to be confirmed), and three budgets, one
 * close to its end. The same day always gives the same plan.
 */
export function demoPlan(
	today: string,
	locale: Locale,
	seed = 20_261_117,
): DemoPlan {
	const next = random(seed);
	/** A whole number of cents between `min` and `max` dollars. */
	const amount = (min: number, max: number) =>
		Math.round((min + next() * (max - min)) * 100);
	const pick = <T>(items: readonly T[]): T =>
		items[Math.floor(next() * items.length)] as T;
	const label = names[locale];
	const first = monthStart(today, DEMO_MONTHS - 1);
	const months = Array.from({ length: DEMO_MONTHS }, (_, index) =>
		monthStart(today, DEMO_MONTHS - 1 - index).slice(0, 7),
	);
	const transactions: DemoTransaction[] = [];
	const add = (transaction: DemoTransaction) => {
		if (transaction.date <= today) {
			transactions.push(transaction);
		}
	};
	const expense = (
		date: string,
		account: DemoAccountRef,
		cents: number,
		payee: string,
		tagKey: string | null,
	) => add({ type: "expense", date, account, amount: cents, payee, tagKey });

	// The power bill of the latest month it came due waits to be confirmed
	const powerDay = 20;
	const lastPowerMonth =
		dayOf(months.at(-1) as string, powerDay) <= today
			? (months.at(-1) as string)
			: (months.at(-2) as string);

	for (const month of months) {
		add({
			type: "income",
			date: dayOf(month, 15),
			account: "chequing",
			amount: 1_900_00,
			payee: PAYEES.employer,
			tagKey: "income/salary",
		});
		add({
			type: "income",
			date: dayOf(month, 31),
			account: "chequing",
			amount: 1_900_00,
			payee: PAYEES.employer,
			tagKey: "income/salary",
		});
		expense(
			dayOf(month, 1),
			"chequing",
			1_350_00,
			PAYEES.landlord,
			"home/rent",
		);
		if (month !== lastPowerMonth) {
			expense(
				dayOf(month, powerDay),
				"chequing",
				amount(55, 140),
				PAYEES.power,
				"home/electricity",
			);
		}
		expense(dayOf(month, 3), "card", 39_99, PAYEES.gym, "leisure/gym");
		expense(
			dayOf(month, 5),
			"card",
			16_99,
			PAYEES.streaming,
			"subscriptions/streaming",
		);
		expense(dayOf(month, 8), "card", 45_00, PAYEES.phone, "home/mobile-phone");
		expense(dayOf(month, 12), "card", 70_00, PAYEES.internet, "home/internet");
		add({
			type: "transfer",
			date: dayOf(month, 16),
			account: "chequing",
			toAccount: "savings",
			amount: 400_00,
			payee: null,
			tagKey: null,
		});
		add({
			type: "transfer",
			date: dayOf(month, 6),
			account: "chequing",
			toAccount: "wallet",
			amount: 100_00,
			payee: null,
			tagKey: null,
		});
		// Groceries twice a week, fuel every nine days or so
		for (let day = 2; day <= 28; day += 3 + Math.floor(next() * 2)) {
			expense(
				dayOf(month, day),
				"card",
				amount(35, 150),
				pick(PAYEES.groceries),
				"food/groceries",
			);
		}
		for (let day = 4; day <= 28; day += 8 + Math.floor(next() * 3)) {
			expense(
				dayOf(month, day),
				"card",
				amount(45, 75),
				PAYEES.gas,
				"transport/car/gas",
			);
		}
		for (const day of [9, 18, 26]) {
			expense(
				dayOf(month, day + Math.floor(next() * 2)),
				"card",
				amount(28, 85),
				pick(PAYEES.restaurants),
				"food/restaurant",
			);
		}
		for (const day of [7, 14, 21]) {
			expense(
				dayOf(month, day),
				"wallet",
				amount(4, 7),
				PAYEES.coffee,
				"food/coffee",
			);
		}
		expense(
			dayOf(month, 23),
			"wallet",
			amount(8, 18),
			PAYEES.bakery,
			"food/bakery",
		);
		expense(
			dayOf(month, 11 + Math.floor(next() * 10)),
			"card",
			amount(12, 45),
			PAYEES.pharmacy,
			"health/pharmacy",
		);
	}
	// A few purchases without a tag, in the last months
	for (const [index, payee] of PAYEES.untagged.entries()) {
		for (const month of months.slice(-2 - index)) {
			expense(
				dayOf(month, 13 + index * 4),
				"card",
				amount(20, 90),
				payee,
				null,
			);
		}
	}
	// The card paid each month, on the 22nd, for what it spent the month before
	for (const [index, month] of months.entries()) {
		const before = months[index - 1];
		if (!before) {
			continue;
		}
		const spent = transactions
			.filter(
				(each) =>
					each.account === "card" &&
					each.type === "expense" &&
					each.date.startsWith(before),
			)
			.reduce((total, each) => total + each.amount, 0);
		add({
			type: "transfer",
			date: dayOf(month, 22),
			account: "chequing",
			toAccount: "card",
			amount: spent,
			payee: null,
			tagKey: null,
		});
	}
	transactions.sort((a, b) => a.date.localeCompare(b.date));

	const monthly = (
		template: Omit<DemoRecurring, "unit" | "nextDate" | "mode"> & {
			mode?: RecurrenceMode;
		},
	): DemoRecurring => ({
		mode: "automatic",
		...template,
		unit: "month",
		nextDate: nextMonthly(template.startDate, today),
	});
	const powerStart = dayOf(months[0] as string, powerDay);
	const recurring: DemoRecurring[] = [
		monthly({
			type: "expense",
			account: "chequing",
			amount: 1_350_00,
			payee: PAYEES.landlord,
			tagKey: "home/rent",
			startDate: dayOf(months[0] as string, 1),
		}),
		monthly({
			type: "income",
			account: "chequing",
			amount: 1_900_00,
			payee: PAYEES.employer,
			tagKey: "income/salary",
			startDate: dayOf(months[0] as string, 15),
		}),
		monthly({
			type: "transfer",
			account: "chequing",
			toAccount: "savings",
			amount: 400_00,
			payee: null,
			tagKey: null,
			startDate: dayOf(months[0] as string, 16),
		}),
		monthly({
			type: "expense",
			account: "card",
			amount: 16_99,
			payee: PAYEES.streaming,
			tagKey: "subscriptions/streaming",
			startDate: dayOf(months[0] as string, 5),
		}),
		{
			...monthly({
				type: "expense",
				account: "chequing",
				amount: 95_00,
				payee: PAYEES.power,
				tagKey: "home/electricity",
				startDate: powerStart,
				mode: "confirm",
			}),
			pendingDate: dayOf(lastPowerMonth, powerDay),
		},
	];

	// Groceries close to their end this month: 5 % above what the month spent so far
	const thisMonth = months.at(-1) as string;
	const spentOn = (tagKey: string) =>
		transactions
			.filter(
				(each) => each.tagKey === tagKey && each.date.startsWith(thisMonth),
			)
			.reduce((total, each) => total + each.amount, 0);
	const groceries = Math.max(
		400_00,
		Math.round((spentOn("food/groceries") * 1.05) / 100_00) * 100_00,
	);
	const budgets: DemoBudget[] = [
		{ tagKey: "food/groceries", amount: groceries, fromMonth: first },
		{ tagKey: "food/restaurant", amount: 200_00, fromMonth: first },
		{ tagKey: "transport/car/gas", amount: 250_00, fromMonth: first },
	];

	const tagKeys = [
		...new Set(
			[...transactions, ...recurring]
				.map((each) => each.tagKey)
				.concat(budgets.map((budget) => budget.tagKey))
				.filter((key): key is string => key !== null),
		),
	];

	return {
		name: label.household,
		accounts: [
			{
				ref: "chequing",
				name: label.chequing,
				type: "checking",
				openingBalance: 2_350_00,
			},
			{
				ref: "savings",
				name: label.savings,
				type: "savings",
				openingBalance: 6_500_00,
			},
			{ ref: "card", name: label.card, type: "credit_card", openingBalance: 0 },
			{
				ref: "wallet",
				name: label.wallet,
				type: "cash",
				openingBalance: 40_00,
			},
		],
		tagKeys,
		transactions,
		recurring,
		budgets,
	};
}
