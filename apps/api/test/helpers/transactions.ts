import type { Account, Tag, Transaction } from "@repo/schemas";
import { api, json } from "@test/helpers/api";
import type { TestUser } from "@test/helpers/households";

/** Shortcuts to call the accounts, tags and transactions of one household. */
export function householdApi(householdId: string) {
	const base = `/v1/households/${householdId}`;

	return {
		base,

		async account(user: TestUser, fields: Record<string, unknown> = {}) {
			return json<Account>(
				await api(`${base}/accounts`, {
					method: "POST",
					cookie: user.cookie,
					body: {
						name: "Chequing",
						type: "checking",
						visibility: "details",
						openingBalance: 100_000,
						...fields,
					},
				}),
			);
		},

		async getAccount(user: TestUser, accountId: string) {
			return json<Account>(
				await api(`${base}/accounts/${accountId}`, { cookie: user.cookie }),
			);
		},

		updateAccount(user: TestUser, accountId: string, body: unknown) {
			return api(`${base}/accounts/${accountId}`, {
				method: "PATCH",
				cookie: user.cookie,
				body,
			});
		},

		async tag(user: TestUser, name: string, parentId?: string) {
			return json<Tag>(
				await api(`${base}/tags`, {
					method: "POST",
					cookie: user.cookie,
					body: { names: { en: name }, parentId },
				}),
			);
		},

		create(user: TestUser, body: unknown) {
			return api(`${base}/transactions`, {
				method: "POST",
				cookie: user.cookie,
				body,
			});
		},

		async created(user: TestUser, body: unknown) {
			return json<Transaction>(await this.create(user, body));
		},

		get(user: TestUser, transactionId: string) {
			return api(`${base}/transactions/${transactionId}`, {
				cookie: user.cookie,
			});
		},

		replace(user: TestUser, transactionId: string, body: unknown) {
			return api(`${base}/transactions/${transactionId}`, {
				method: "PUT",
				cookie: user.cookie,
				body,
			});
		},

		remove(user: TestUser, transactionId: string) {
			return api(`${base}/transactions/${transactionId}`, {
				method: "DELETE",
				cookie: user.cookie,
			});
		},

		list(user: TestUser, query = "") {
			return api(`${base}/transactions${query}`, { cookie: user.cookie });
		},
	};
}
