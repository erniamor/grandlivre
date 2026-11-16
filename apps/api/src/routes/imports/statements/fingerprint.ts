import { createHash } from "node:crypto";

/**
 * A description reduced to its letters, without accents nor case: the same
 * line exported twice may differ in everything else ("/à 123456 EOP" in a
 * statement, "/a 0123456-EOP" in the history).
 */
export function descriptionKey(description: string): string {
	return description
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z]/g, "");
}

/**
 * Lines given their identity: a hash of their day, amount and description,
 * then their rank among the lines alike in the file. Two lines alike on the
 * same day are interchangeable: whichever comes first, the first is "-0".
 */
export function withExternalIds<
	Line extends { date: string; amount: number; description: string },
>(lines: Line[]): (Line & { externalId: string })[] {
	const seen = new Map<string, number>();
	return lines.map((line) => {
		const key = `${line.date}|${line.amount}|${descriptionKey(line.description)}`;
		const rank = seen.get(key) ?? 0;
		seen.set(key, rank + 1);
		const hash = createHash("sha256").update(key).digest("hex").slice(0, 32);
		return { ...line, externalId: `${hash}-${rank}` };
	});
}
