import {
	type AccountType,
	type Locale,
	type Tag,
	tagDisplayName,
} from "@repo/schemas";

export interface ContextAccount {
	id: string;
	name: string;
	/** What it is: a "cash" account is a wallet. */
	type: AccountType;
	/** The member holds it, and it takes transactions. */
	writable: boolean;
}

export interface ContextPayee {
	payee: string;
	tagId: string;
}

/** The short references the assistant names accounts and tags by: "a1", "t3". */
export interface References {
	accounts: Map<string, string>;
	tags: Map<string, string>;
}

/** Each tag with the names leading to it: "Car › Gas", in the member's language. */
function tagPaths(tags: Tag[], locale: Locale): Map<string, string> {
	const byId = new Map(tags.map((tag) => [tag.id, tag]));
	const paths = new Map<string, string>();
	const pathOf = (tag: Tag, seen: Set<string>): string => {
		const name = tagDisplayName(tag.names, locale);
		const parent = tag.parentId === null ? undefined : byId.get(tag.parentId);
		// A parent missing, or a loop: the path stops there
		if (!parent || seen.has(parent.id)) {
			return name;
		}
		return `${pathOf(parent, new Set([...seen, tag.id]))} › ${name}`;
	};
	for (const tag of tags) {
		paths.set(tag.id, pathOf(tag, new Set([tag.id])));
	}
	return paths;
}

/**
 * The household as the assistant sees it, and the references it names
 * things by. Written the same way for the same household, so it caches.
 */
export function buildDraftContext({
	currency,
	locale,
	accounts,
	tags,
	payees,
}: {
	currency: string;
	locale: Locale;
	accounts: ContextAccount[];
	tags: Tag[];
	payees: ContextPayee[];
}): { context: string; references: References } {
	const references: References = { accounts: new Map(), tags: new Map() };
	const idOfTag = new Map<string, string>();
	const paths = tagPaths(tags, locale);
	const sortedTags = [...tags].sort((a, b) =>
		(paths.get(a.id) ?? "").localeCompare(paths.get(b.id) ?? ""),
	);
	const tagLines = sortedTags.map((tag, index) => {
		const reference = `t${index + 1}`;
		references.tags.set(reference, tag.id);
		idOfTag.set(tag.id, reference);
		return `${reference} | ${paths.get(tag.id)}`;
	});
	const accountLines = accounts.map((account, index) => {
		const reference = `a${index + 1}`;
		references.accounts.set(reference, account.id);
		return `${reference} | ${account.name} | ${account.type}${account.writable ? " | yours" : ""}`;
	});
	const payeeLines = payees.flatMap(({ payee, tagId }) => {
		const reference = idOfTag.get(tagId);
		return reference ? [`${payee} → ${reference}`] : [];
	});

	const context = [
		`Household currency: ${currency}`,
		`Member's language: ${locale}`,
		"",
		"Accounts:",
		...accountLines,
		"",
		"Tags:",
		...(tagLines.length > 0 ? tagLines : ["(none yet)"]),
		"",
		"Recent payees and their usual tag:",
		...(payeeLines.length > 0 ? payeeLines : ["(none yet)"]),
	].join("\n");
	return { context, references };
}

/** The member's note, with their day, as the assistant reads it. */
export function buildDraftEntry(text: string, today: string): string {
	// The note can't close its own tag and pass for instructions
	const safe = text.replaceAll("</entry>", "");
	return `Today: ${today}\n<entry>${safe}</entry>`;
}
