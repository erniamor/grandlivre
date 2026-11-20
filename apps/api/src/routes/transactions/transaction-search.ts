import { and, type SQL, sql } from "drizzle-orm";
import { transactions } from "@/db/schema";

/** At most this many words are searched, the rest dropped. */
const MAX_WORDS = 10;

/** A word as a LIKE pattern matching it anywhere: its wildcards taken literally. */
function containing(word: string): string {
	return `%${word.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/**
 * The transactions whose payee, note, or receipt's merchant or items hold
 * every word of `query`, accents and case aside; undefined without a word.
 */
export function searchCondition(query: string | undefined): SQL | undefined {
	const words = (query ?? "").split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
	if (words.length === 0) {
		return undefined;
	}
	// Raw SQL: Drizzle has no unaccent() nor JSON path; the words are parameters
	const searched = sql`unaccent(concat_ws(' ', ${transactions.payee}, ${transactions.note}, ${transactions.receipt} ->> 'merchant', jsonb_path_query_array(${transactions.receipt}, '$.items[*].name')::text))`;
	return and(
		...words.map(
			(word) => sql`${searched} ilike unaccent(${containing(word)})`,
		),
	);
}
