import { createHmac } from "node:crypto";
import { env } from "@/env";

/**
 * What is kept of an account's number at the bank: a hash keyed with the
 * server's secret, enough to recognize the account in its next statements,
 * of no use to guess the number (a folio has few digits: a plain hash
 * would give it away).
 */
export function hashStatementNumber(number: string): string {
	return createHmac("sha256", env.BETTER_AUTH_SECRET)
		.update(`statement-account:${number}`)
		.digest("hex");
}
