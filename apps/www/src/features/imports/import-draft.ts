import {
	ACCOUNT_DEBT_TYPES,
	type Account,
	type AccountType,
	type StatementImportPlan,
	type StatementLineDecision,
	type StatementPreview,
	type StatementPreviewAccount,
	type StatementPreviewLine,
	type StatementTargets,
} from "@repo/schemas";
import { parseAmount } from "@/lib/money";

/** Where an account of the file goes: an account of the household, a new one, nowhere. */
export type Destination =
	| { kind: "account"; accountId: string }
	| {
			kind: "new";
			name: string;
			type: AccountType;
			/**
			 * What the account owes today, as typed: asked only when the file
			 * gives no balance (a card), to find its opening balance.
			 */
			owed: string;
	  }
	/** Wherever another account of the file goes: a card replaced, say. */
	| { kind: "with"; index: number }
	| { kind: "skip" };

/** What becomes of a line. */
export type LineChoice =
	| { action: "skip" }
	| { action: "create"; tagId: string | null }
	/** With `pair`, the transfer is the one of the line's pair, in the file. */
	| { action: "transfer"; accountId: string | null; pair?: boolean }
	| { action: "link"; transactionId: string }
	| { action: "confirm"; occurrenceId: string }
	/** The other side, entered in another account, becomes the transfer. */
	| { action: "join"; transactionId: string };

/** The member's decisions on a previewed file: per account, by its place. */
export interface ImportDraft {
	destinations: Record<number, Destination>;
	/** Per account, then per line's identity. */
	choices: Record<number, Record<string, LineChoice>>;
}

/** What tells an account of the file: the bank's name and its number's end. */
export function statementAccountName(account: StatementPreviewAccount): string {
	return `${account.bankName} ···${account.numberEnd}`;
}

/** The first choice for a line: what the preview found, else what it suggests. */
export function initialChoice(line: StatementPreviewLine): LineChoice | null {
	if (line.status === "imported") {
		return null;
	}
	if (line.status === "matched" && line.match) {
		return { action: "link", transactionId: line.match.transactionId };
	}
	if (line.status === "recurring" && line.occurrence) {
		return { action: "confirm", occurrenceId: line.occurrence.id };
	}
	if (line.status === "counterpart" && line.match) {
		return { action: "join", transactionId: line.match.transactionId };
	}
	if (line.pair) {
		// The side the money leaves records the transfer; the other is its pair
		return line.amount < 0
			? { action: "transfer", accountId: null, pair: true }
			: { action: "skip" };
	}
	if (line.suggestion?.kind === "transfer") {
		return { action: "transfer", accountId: line.suggestion.accountId };
	}
	return {
		action: "create",
		tagId: line.suggestion?.kind === "tag" ? line.suggestion.tagId : null,
	};
}

/**
 * Where an account of the file goes at first: the account the preview
 * found, else the one the page was opened from (a file of one account),
 * else a new account named after the statement.
 */
export function initialDestination(
	account: StatementPreviewAccount,
	fileAccounts: number,
	fromAccountId?: string,
): Destination {
	if (account.accountId) {
		// Another member's account: not this member's to fill
		return account.writable
			? { kind: "account", accountId: account.accountId }
			: { kind: "skip" };
	}
	if (fromAccountId && fileAccounts === 1) {
		return { kind: "account", accountId: fromAccountId };
	}
	return {
		kind: "new",
		name: statementAccountName(account).slice(0, 60),
		type: account.type,
		owed: "",
	};
}

/** The decisions to start from, for a file previewed. */
export function initialDraft(
	preview: StatementPreview,
	fromAccountId?: string,
): ImportDraft {
	const destinations: Record<number, Destination> = Object.fromEntries(
		preview.accounts.map((account) => [
			account.index,
			initialDestination(account, preview.accounts.length, fromAccountId),
		]),
	);
	return {
		destinations,
		choices: Object.fromEntries(
			preview.accounts.map((account) => [
				account.index,
				choicesFor(account, destinations[account.index]),
			]),
		),
	};
}

/**
 * Whether the lines' standing (imported, already there, a recurring day)
 * holds where the account goes: the preview compared them with that account.
 */
export function standingHolds(
	account: StatementPreviewAccount,
	destination: Destination | undefined,
): boolean {
	return (
		destination?.kind === "account" &&
		destination.accountId === account.accountId
	);
}

/** The first choices for an account's lines, where it goes. */
export function choicesFor(
	account: StatementPreviewAccount,
	destination: Destination | undefined,
): Record<string, LineChoice> {
	const holds = standingHolds(account, destination);
	return Object.fromEntries(
		account.lines.flatMap((line) => {
			const choice = initialChoice(
				holds ||
					(line.status === "counterpart" &&
						(destination?.kind === "new" || destination?.kind === "with"))
					? line
					: { ...line, status: "new", match: null, occurrence: null },
			);
			return choice ? [[line.externalId, choice]] : [];
		}),
	);
}

/** Whether a new preview is needed: an account goes to one it wasn't compared with. */
export function needsPreview(
	preview: StatementPreview,
	draft: ImportDraft,
): boolean {
	return preview.accounts.some((account) => {
		const destination = draft.destinations[account.index];
		return (
			destination?.kind === "account" && !standingHolds(account, destination)
		);
	});
}

/**
 * The decisions kept from a draft for a new preview of the same file (after
 * a destination changed): the destinations as they are, the choices of the
 * accounts going where they went, the others started again.
 */
export function redraft(
	draft: ImportDraft,
	previous: StatementPreview,
	next: StatementPreview,
): ImportDraft {
	return {
		destinations: draft.destinations,
		choices: Object.fromEntries(
			next.accounts.map((account) => {
				const before = previous.accounts.find(
					(each) => each.index === account.index,
				);
				const same = before?.accountId === account.accountId;
				return [
					account.index,
					same
						? (draft.choices[account.index] ?? {})
						: choicesFor(account, draft.destinations[account.index]),
				];
			}),
		),
	};
}

/** Where the accounts of the file go, for the preview: the accounts chosen. */
export function targetsOf(draft: ImportDraft): StatementTargets {
	return Object.entries(draft.destinations).flatMap(([index, destination]) =>
		destination.kind === "account"
			? [{ index: Number(index), accountId: destination.accountId }]
			: [],
	);
}

/**
 * The line of the file that records the transfer this line is the other
 * side of, when it does: then this line needs no decision of its own.
 */
export function pairedBy(
	draft: ImportDraft,
	accountIndex: number,
	line: StatementPreviewLine,
): { index: number; externalId: string } | null {
	const pair = line.pair;
	if (!pair || draft.destinations[accountIndex]?.kind === "skip") {
		return null;
	}
	const other = draft.choices[pair.index]?.[pair.externalId];
	return other?.action === "transfer" &&
		other.pair &&
		draft.destinations[pair.index]?.kind !== "skip"
		? pair
		: null;
}

/**
 * The opening balance of an account made from the statement: the file's,
 * or for a file without balances (a card), what is owed today less the
 * lines; null while what is owed isn't an amount.
 */
export function openingBalanceOf(
	account: StatementPreviewAccount,
	destination: Extract<Destination, { kind: "new" }>,
	currency: string,
	locale: string,
	/** The lines of the file's accounts that go with it, into the same account. */
	alongside: StatementPreviewLine[] = [],
): number | null {
	if (account.openingBalance !== null) {
		return account.openingBalance;
	}
	const owed = parseAmount(destination.owed, currency, locale);
	if (owed === null) {
		return null;
	}
	// A debt is a negative balance; any other account holds what is typed
	const today = ACCOUNT_DEBT_TYPES.includes(destination.type) ? -owed : owed;
	return (
		today -
		[...account.lines, ...alongside].reduce(
			(total, line) => total + line.amount,
			0,
		)
	);
}

/** What keeps the import from being sent, account by account. */
export type DraftProblem =
	| { kind: "name"; index: number }
	| { kind: "owed"; index: number }
	/** Goes with an account of the file that goes nowhere, or with another going with one. */
	| { kind: "with"; index: number }
	| { kind: "transfer"; index: number; externalId: string }
	| { kind: "nothing" };

/** The decisions as the API takes them, or what is missing first. */
export function buildPlan(
	preview: StatementPreview,
	draft: ImportDraft,
	currency: string,
	locale: string,
):
	| { plan: StatementImportPlan; problems: [] }
	| { plan: null; problems: DraftProblem[] } {
	const problems: DraftProblem[] = [];
	const accounts: StatementImportPlan["accounts"] = [];
	for (const account of preview.accounts) {
		const destination = draft.destinations[account.index];
		if (!destination || destination.kind === "skip") {
			continue;
		}
		let target: StatementImportPlan["accounts"][number]["target"];
		if (destination.kind === "account") {
			target = { accountId: destination.accountId };
		} else if (destination.kind === "with") {
			const other = draft.destinations[destination.index]?.kind;
			// Only with an account that goes somewhere of its own
			if (other !== "account" && other !== "new") {
				problems.push({ kind: "with", index: account.index });
			}
			target = { sameAs: destination.index };
		} else {
			const alongside = preview.accounts.flatMap((each) => {
				const with_ = draft.destinations[each.index];
				return with_?.kind === "with" && with_.index === account.index
					? each.lines
					: [];
			});
			const openingBalance = openingBalanceOf(
				account,
				destination,
				currency,
				locale,
				alongside,
			);
			if (destination.name.trim() === "") {
				problems.push({ kind: "name", index: account.index });
			}
			if (openingBalance === null) {
				problems.push({ kind: "owed", index: account.index });
			}
			target = {
				create: {
					name: destination.name.trim(),
					type: destination.type,
					visibility: "details",
					openingBalance: openingBalance ?? 0,
				},
			};
		}
		const lines: StatementLineDecision[] = [];
		for (const line of account.lines) {
			const choice = draft.choices[account.index]?.[line.externalId];
			if (!choice || pairedBy(draft, account.index, line)) {
				continue;
			}
			const decision = decisionOf(draft, line, choice);
			if (decision === "missing") {
				problems.push({
					kind: "transfer",
					index: account.index,
					externalId: line.externalId,
				});
			} else if (decision) {
				lines.push(decision);
			}
		}
		accounts.push({ index: account.index, target, lines });
	}
	if (accounts.length === 0) {
		problems.push({ kind: "nothing" });
	}
	return problems.length > 0
		? { plan: null, problems }
		: { plan: { accounts }, problems: [] };
}

function decisionOf(
	draft: ImportDraft,
	line: StatementPreviewLine,
	choice: LineChoice,
): StatementLineDecision | "missing" | null {
	const { externalId } = line;
	switch (choice.action) {
		case "skip":
			return null;
		case "create":
			return { externalId, action: "create", tagId: choice.tagId };
		case "link":
			return {
				externalId,
				action: "link",
				transactionId: choice.transactionId,
			};
		case "confirm":
			return {
				externalId,
				action: "confirm",
				occurrenceId: choice.occurrenceId,
			};
		case "join":
			return {
				externalId,
				action: "join",
				transactionId: choice.transactionId,
			};
		case "transfer": {
			const pair = line.pair;
			if (
				choice.pair &&
				pair &&
				draft.destinations[pair.index]?.kind !== "skip"
			) {
				return { externalId, action: "transfer", pair };
			}
			return choice.accountId
				? { externalId, action: "transfer", accountId: choice.accountId }
				: "missing";
		}
	}
}

/** How many lines of an account each decision takes, once imported. */
export function countChoices(
	account: StatementPreviewAccount,
	draft: ImportDraft,
): Record<LineChoice["action"] | "paired", number> {
	const counts = {
		skip: 0,
		create: 0,
		transfer: 0,
		link: 0,
		confirm: 0,
		join: 0,
		paired: 0,
	};
	for (const line of account.lines) {
		const choice = draft.choices[account.index]?.[line.externalId];
		if (pairedBy(draft, account.index, line)) {
			counts.paired += 1;
		} else if (choice) {
			counts[choice.action] += 1;
		}
	}
	return counts;
}

/**
 * The accounts a line can be a transfer with: any open account when the
 * money left the line's account, one the member holds when it came in
 * (they hold the account the money leaves).
 */
export function transferAccounts(
	accounts: Account[],
	line: StatementPreviewLine,
	destination: Destination | undefined,
): Account[] {
	const own = destination?.kind === "account" ? destination.accountId : null;
	return accounts.filter(
		(account) =>
			!account.archived &&
			account.id !== own &&
			(line.amount < 0 || account.isHolder),
	);
}

/** The accounts a file's account can go to: those the member holds, still open. */
export function destinationAccounts(accounts: Account[]): Account[] {
	return accounts.filter((account) => account.isHolder && !account.archived);
}

/** What the member picks for a line, in its list of actions. */
export type LineAction = LineChoice["action"] | "pair";

/** The actions a line can take: what it already is, its pair, then the usual ones. */
export function lineActions(
	line: StatementPreviewLine,
	holds: boolean,
): LineAction[] {
	return [
		...(holds && line.status === "matched" && line.match
			? (["link"] as const)
			: []),
		...(holds && line.occurrence ? (["confirm"] as const) : []),
		...(line.status === "counterpart" && line.match ? (["join"] as const) : []),
		...(line.pair && line.amount < 0 ? (["pair"] as const) : []),
		"create",
		"transfer",
		"skip",
	];
}

/** The action a choice shows as. */
export function actionOf(choice: LineChoice): LineAction {
	return choice.action === "transfer" && choice.pair ? "pair" : choice.action;
}

/** The choice an action picked for a line makes. */
export function choiceForAction(
	action: LineAction,
	line: StatementPreviewLine,
): LineChoice {
	switch (action) {
		case "link":
			return line.match
				? { action: "link", transactionId: line.match.transactionId }
				: { action: "skip" };
		case "confirm":
			return line.occurrence
				? { action: "confirm", occurrenceId: line.occurrence.id }
				: { action: "skip" };
		case "join":
			return line.match
				? { action: "join", transactionId: line.match.transactionId }
				: { action: "skip" };
		case "pair":
			return { action: "transfer", accountId: null, pair: true };
		case "transfer":
			return {
				action: "transfer",
				accountId:
					line.suggestion?.kind === "transfer"
						? line.suggestion.accountId
						: null,
			};
		case "create":
			return {
				action: "create",
				tagId: line.suggestion?.kind === "tag" ? line.suggestion.tagId : null,
			};
		case "skip":
			return { action: "skip" };
	}
}
