import type { RecurrenceMode, RecurrenceUnit } from "@repo/schemas";
import { descriptionKey } from "@/routes/imports/statements/fingerprint";
import {
	addDays,
	nextOccurrence,
	occurrenceAt,
} from "@/routes/recurring/schedule";

/** A transaction of the history, as the detection reads it. */
export interface PastTransaction {
	id: string;
	type: "expense" | "income" | "transfer";
	accountId: string;
	/** Where a transfer goes; null otherwise. */
	toAccountId: string | null;
	payee: string | null;
	/** Minor units, positive. */
	amount: number;
	date: string;
	/** The tag of all its lines, null when untagged or split among tags. */
	tagId: string | null;
}

/** What a recurring transaction repeats: its account, payee and type. */
export interface PatternIdentity {
	accountId: string;
	toAccountId: string | null;
	type: PastTransaction["type"];
	/** The payee's key: its letters only, lowercased (see descriptionKey). */
	key: string;
}

/** A series of past transactions that repeats, offered as a recurring transaction. */
export interface RecurringPattern extends PatternIdentity {
	/** Its payee, as last written. */
	payee: string | null;
	unit: RecurrenceUnit;
	interval: number;
	/** What it amounts to now: its last amount when steady, else the median. */
	amount: number;
	minAmount: number;
	maxAmount: number;
	/** "automatic" when its last amounts are the same, "confirm" otherwise. */
	mode: RecurrenceMode;
	/** The next day it is expected on, from today: the recurring transaction's first day. */
	nextDate: string;
	/** The tag it is most often given, if any. */
	tagId: string | null;
	/** Its days in the history, oldest first. */
	dates: string[];
	transactionIds: string[];
}

export interface FindPatternsOptions {
	/** Today, "YYYY-MM-DD". */
	today: string;
	/** Series already covered by a recurring transaction or dismissed. */
	covered?: PatternIdentity[];
}

/** A cadence looked for, and how far a day may stray from it. */
interface Cadence {
	unit: RecurrenceUnit;
	interval: number;
	/** Days a transaction may come before or after its expected day. */
	tolerance: number;
	/** Fewest transactions for a series. */
	minCount: number;
	/**
	 * Fewest transactions for a series whose amount varies a lot (fuel,
	 * a restaurant come back to by chance need more to tell); null when such
	 * a series is never one.
	 */
	minCountVarying: number | null;
	/** About how many days a period lasts. */
	days: number;
}

/** From the shortest: a series is kept at the cadence that takes the most of it. */
const CADENCES: Cadence[] = [
	{
		unit: "week",
		interval: 1,
		tolerance: 1,
		minCount: 4,
		minCountVarying: 8,
		days: 7,
	},
	{
		unit: "week",
		interval: 2,
		tolerance: 2,
		minCount: 4,
		minCountVarying: 6,
		days: 14,
	},
	{
		unit: "month",
		interval: 1,
		tolerance: 3,
		minCount: 3,
		minCountVarying: 4,
		days: 30,
	},
	// Two transactions a year apart: only alike, an insurance renewed
	{
		unit: "year",
		interval: 1,
		tolerance: 7,
		minCount: 2,
		minCountVarying: null,
		days: 365,
	},
];

/** Amounts vary a lot when the highest is more than this times the lowest. */
const VARYING_RATIO = 1.25;

/** At least this share of a series' periods hold a transaction. */
const MIN_FILL = 0.75;

/** At least this share of a payee's transactions left over its days belong to a series. */
const MIN_SHARE = 0.5;

/** A series ends at this many periods in a row without a transaction. */
const MAX_MISSED_IN_A_ROW = 2;

/** How many of its last amounts must be the same for it to be recorded on its own. */
const STEADY_COUNT = 3;

/** Amounts this close (in minor units, or this share of them) are the same. */
const STEADY_CENTS = 100;
const STEADY_SHARE = 0.02;

/** A series is still alive until half a period after the day it was next expected. */
const ALIVE_PERIODS = 0.5;

const DAY_MS = 86_400_000;

function daysBetween(from: string, to: string): number {
	return Math.round(
		(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
	);
}

/** A series found: the transactions it takes, and its expected day for each. */
interface Chain {
	cadence: Cadence;
	members: PastTransaction[];
	/** The index of the last period that held a transaction. */
	lastIndex: number;
}

/**
 * The series at `cadence` starting at `start`: each period, a transaction
 * within the tolerance of its expected day, the one whose amount is closest
 * to the last one taken (two phone lines billed the same day make two
 * series), then the closest to the day; it ends at the last transaction,
 * or after too many periods in a row without one.
 */
function chainFrom(
	start: number,
	sorted: PastTransaction[],
	free: boolean[],
	cadence: Cadence,
): Chain {
	const first = sorted[start] as PastTransaction;
	const schedule = {
		unit: cadence.unit,
		interval: cadence.interval,
		startDate: first.date,
	};
	const members = [first];
	const taken = new Set([start]);
	let lastIndex = 0;
	let missed = 0;
	let cursor = start + 1;
	for (let index = 1; missed < MAX_MISSED_IN_A_ROW; index++) {
		const expected = occurrenceAt(schedule, index);
		const earliest = addDays(expected, -cadence.tolerance);
		const latest = addDays(expected, cadence.tolerance);
		// The transactions before the window can no longer be taken
		while (
			cursor < sorted.length &&
			(sorted[cursor] as PastTransaction).date < earliest
		) {
			cursor++;
		}
		if (cursor >= sorted.length) {
			break;
		}
		const previous = (members.at(-1) as PastTransaction).amount;
		let best: number | null = null;
		let bestScore: [number, number] = [Infinity, Infinity];
		for (
			let at = cursor;
			at < sorted.length && (sorted[at] as PastTransaction).date <= latest;
			at++
		) {
			if (!free[at] || taken.has(at)) {
				continue;
			}
			const candidate = sorted[at] as PastTransaction;
			const score: [number, number] = [
				Math.abs(candidate.amount - previous),
				Math.abs(daysBetween(expected, candidate.date)),
			];
			if (
				score[0] < bestScore[0] ||
				(score[0] === bestScore[0] && score[1] < bestScore[1])
			) {
				best = at;
				bestScore = score;
			}
		}
		if (best === null) {
			missed++;
			continue;
		}
		missed = 0;
		taken.add(best);
		members.push(sorted[best] as PastTransaction);
		lastIndex = index;
	}
	return { cadence, members, lastIndex };
}

/**
 * Whether a chain is a series: long enough, its periods mostly filled, and
 * most of the payee's transactions over its days, but those of the series
 * still going on found before (a grocery visited every few days always has
 * one near any day: that makes no series).
 */
function isSeries(
	chain: Chain,
	sorted: PastTransaction[],
	counted: boolean[],
): boolean {
	const { members, cadence } = chain;
	const amounts = members.map((member) => member.amount);
	const varying = Math.max(...amounts) > Math.min(...amounts) * VARYING_RATIO;
	const minCount = varying ? cadence.minCountVarying : cadence.minCount;
	if (
		minCount === null ||
		members.length < minCount ||
		members.length / (chain.lastIndex + 1) < MIN_FILL
	) {
		return false;
	}
	const first = (members[0] as PastTransaction).date;
	const last = (members.at(-1) as PastTransaction).date;
	const alongside = sorted.filter(
		(transaction, at) =>
			counted[at] && transaction.date >= first && transaction.date <= last,
	).length;
	return members.length / alongside >= MIN_SHARE;
}

/**
 * The series of one payee's transactions: each time, the series that takes
 * the most of what is left (at equal count, the longer cadence), until none.
 */
function chainsOf(sorted: PastTransaction[], today: string): Chain[] {
	// What a series may still take; what still weighs against a new series
	const free = sorted.map(() => true);
	const counted = sorted.map(() => true);
	const chains: Chain[] = [];
	for (;;) {
		let best: Chain | null = null;
		for (const cadence of CADENCES) {
			for (let start = 0; start < sorted.length; start++) {
				if (!free[start]) {
					continue;
				}
				const chain = chainFrom(start, sorted, free, cadence);
				if (
					isSeries(chain, sorted, counted) &&
					(best === null || chain.members.length >= best.members.length)
				) {
					best = chain;
				}
			}
		}
		if (best === null) {
			return chains;
		}
		// A series that stopped is offered nothing, and was likely chance
		const alive = isAlive(best, today);
		if (alive) {
			chains.push(best);
		}
		const ids = new Set(best.members.map((member) => member.id));
		sorted.forEach((transaction, at) => {
			if (ids.has(transaction.id)) {
				free[at] = false;
				counted[at] = !alive;
			}
		});
	}
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1
		? (sorted[middle] as number)
		: Math.round(
				((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2,
			);
}

/** Whether amounts are the same, give or take a dollar or 2 %. */
function isSteady(amounts: number[]): boolean {
	const low = Math.min(...amounts);
	const high = Math.max(...amounts);
	return high - low <= Math.max(STEADY_CENTS, Math.round(high * STEADY_SHARE));
}

function mostFrequent(values: (string | null)[]): string | null {
	const counts = new Map<string, number>();
	for (const value of values) {
		if (value !== null) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}
	let best: string | null = null;
	let bestCount = 0;
	for (const [value, count] of counts) {
		if (count > bestCount) {
			best = value;
			bestCount = count;
		}
	}
	return best;
}

/**
 * The day a series falls on: for a monthly one, its usual day of the month
 * (a bill posted on the 17th once, when the 15th was a Sunday, still falls
 * on the 15th), from January of its last transaction's year, which has
 * every day (the schedule brings a 31st back to a shorter month's last day);
 * its last day otherwise.
 */
function anchorOf(chain: Chain): string {
	const last = (chain.members.at(-1) as PastTransaction).date;
	if (chain.cadence.unit !== "month") {
		return last;
	}
	const day = median(
		chain.members.map((member) => Number(member.date.slice(8))),
	);
	return `${last.slice(0, 4)}-01-${String(day).padStart(2, "0")}`;
}

/** A series' schedule, and its day expected after its last transaction. */
function scheduleOf(chain: Chain) {
	const { cadence, members } = chain;
	const last = (members.at(-1) as PastTransaction).date;
	const schedule = {
		unit: cadence.unit,
		interval: cadence.interval,
		startDate: anchorOf(chain),
		endDate: null,
	};
	const expectedAfterLast = nextOccurrence(
		schedule,
		addDays(last, cadence.tolerance + 1),
	) as string;
	return { schedule, expectedAfterLast };
}

/** Whether a series still goes on: its next day not long past. */
function isAlive(chain: Chain, today: string): boolean {
	return (
		daysBetween(scheduleOf(chain).expectedAfterLast, today) <=
		Math.round(chain.cadence.days * ALIVE_PERIODS)
	);
}

/** A series still going on, offered as a recurring transaction. */
function patternOf(
	chain: Chain,
	identity: PatternIdentity,
	today: string,
): RecurringPattern {
	const { cadence, members } = chain;
	const { schedule, expectedAfterLast } = scheduleOf(chain);
	const nextDate = nextOccurrence(
		schedule,
		expectedAfterLast > today ? expectedAfterLast : today,
	) as string;
	const amounts = members.map((member) => member.amount);
	const recent = amounts.slice(-STEADY_COUNT);
	// All of them for a series that has fewer (a yearly one, from two years)
	const steady =
		recent.length >= Math.min(STEADY_COUNT, cadence.minCount) &&
		isSteady(recent);
	return {
		...identity,
		payee: (members.at(-1) as PastTransaction).payee,
		unit: cadence.unit,
		interval: cadence.interval,
		amount: steady ? (amounts.at(-1) as number) : median(amounts),
		minAmount: Math.min(...amounts),
		maxAmount: Math.max(...amounts),
		mode: steady ? "automatic" : "confirm",
		nextDate,
		tagId: mostFrequent(members.map((member) => member.tagId)),
		dates: members.map((member) => member.date),
		transactionIds: members.map((member) => member.id),
	};
}

function identityKey(identity: PatternIdentity): string {
	return [
		identity.accountId,
		identity.toAccountId ?? "",
		identity.type,
		identity.key,
	].join("|");
}

/**
 * The transactions of the history that repeat: by account, payee and type,
 * weekly, every two weeks, monthly or yearly, still going on today, and not
 * yet covered. A payee's transactions can make several series (a pay on
 * the 15th and another on the 30th); what is irregular makes none.
 */
export function findRecurringPatterns(
	history: PastTransaction[],
	{ today, covered = [] }: FindPatternsOptions,
): RecurringPattern[] {
	const skip = new Set(covered.map(identityKey));
	const groups = new Map<
		string,
		{ identity: PatternIdentity; items: PastTransaction[] }
	>();
	for (const transaction of history) {
		const key = descriptionKey(transaction.payee ?? "");
		// Without a payee, only a transfer has something to go by: its accounts
		if (key === "" && transaction.type !== "transfer") {
			continue;
		}
		const identity: PatternIdentity = {
			accountId: transaction.accountId,
			toAccountId: transaction.toAccountId,
			type: transaction.type,
			key,
		};
		const groupKey = identityKey(identity);
		if (skip.has(groupKey)) {
			continue;
		}
		const group = groups.get(groupKey) ?? { identity, items: [] };
		group.items.push(transaction);
		groups.set(groupKey, group);
	}
	const patterns: RecurringPattern[] = [];
	for (const { identity, items } of groups.values()) {
		const sorted = items
			.filter((item) => item.date <= today)
			.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
		for (const chain of chainsOf(sorted, today)) {
			patterns.push(patternOf(chain, identity, today));
		}
	}
	return patterns.sort(
		(a, b) => a.nextDate.localeCompare(b.nextDate) || b.amount - a.amount,
	);
}
