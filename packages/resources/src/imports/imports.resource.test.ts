import { STATEMENT_MAX_BYTES } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { ApiError, type ValidationError } from "../errors";
import { fakeApi } from "../test/fake-fetch";

const HOUSEHOLD_ID = "5f1b7c2e-8d4a-4e6b-9c3f-1a2b3c4d5e6f";
const ACCOUNT = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const IMPORT = "9c8b7a6d-5e4f-4d3c-a2b1-0f9e8d7c6b5a";
const USER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const base = `http://api.test/v1/households/${HOUSEHOLD_ID}/imports`;

const file = new Blob(
	[
		'"Caisse","123456","EOP","2026/10/01",1,"Achat /CAFE","",4.25,"","","","","",95.75',
	],
	{
		type: "text/csv",
	},
);

const preview = {
	format: "desjardins_accounts",
	accounts: [
		{
			index: 0,
			bankName: "Caisse",
			numberEnd: "456",
			type: "checking",
			openingBalance: 100_00,
			closingBalance: 95_75,
			from: "2026-10-01",
			to: "2026-10-01",
			accountId: null,
			recognized: false,
			writable: false,
			lines: [
				{
					externalId: "a1-0",
					date: "2026-10-01",
					amount: -4_25,
					description: "Achat /CAFE",
					payee: "CAFE",
					status: "new",
					match: null,
					occurrence: null,
					suggestion: null,
					pair: null,
				},
			],
		},
	],
};

const imported = {
	id: IMPORT,
	format: "desjardins_accounts",
	createdAt: "2026-11-16T12:00:00.000Z",
	createdBy: { userId: USER, name: "Alice" },
	accounts: [{ accountId: ACCOUNT, created: 1, linked: 0, confirmed: 0 }],
};

const plan = {
	accounts: [
		{
			index: 0,
			target: { accountId: ACCOUNT },
			lines: [{ externalId: "a1-0", action: "create" as const }],
		},
	],
};

describe("imports", () => {
	it("sends a file to preview, with where its accounts go", async () => {
		const { api, requests } = fakeApi(200, preview);

		expect(
			await api.imports.preview(HOUSEHOLD_ID, {
				file,
				targets: [{ index: 0, accountId: ACCOUNT }],
			}),
		).toEqual(preview);
		const [request] = requests;
		expect(request).toMatchObject({ url: `${base}/preview`, method: "POST" });
		const form = request?.body as FormData;
		expect((form.get("file") as File).name).toBe("statement.csv");
		expect(JSON.parse(form.get("targets") as string)).toEqual([
			{ index: 0, accountId: ACCOUNT },
		]);
	});

	it("imports the file as planned", async () => {
		const { api, requests } = fakeApi(201, imported);

		expect(await api.imports.create(HOUSEHOLD_ID, { file, plan })).toEqual(
			imported,
		);
		const form = requests[0]?.body as FormData;
		expect(requests[0]).toMatchObject({ url: base, method: "POST" });
		expect(JSON.parse(form.get("plan") as string)).toEqual(plan);
	});

	it("checks the file and the plan before sending", async () => {
		const { api, fetch } = fakeApi(200, preview);
		const issuesOf = (promise: Promise<unknown>) =>
			promise.catch((error: unknown) => (error as ValidationError).issues);

		expect(
			await issuesOf(api.imports.preview(HOUSEHOLD_ID, { file: new Blob([]) })),
		).toEqual([{ field: "file", message: "statement_empty" }]);
		expect(
			await issuesOf(
				api.imports.preview(HOUSEHOLD_ID, {
					file: new Blob([new Uint8Array(STATEMENT_MAX_BYTES + 1)]),
				}),
			),
		).toEqual([{ field: "file", message: "statement_too_large" }]);
		expect(
			await issuesOf(
				api.imports.create(HOUSEHOLD_ID, { file, plan: { accounts: [] } }),
			),
		).toEqual([{ field: "accounts", message: "import_accounts_required" }]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("reports a file the API can't read, with its line", async () => {
		const { api } = fakeApi(422, {
			error: {
				code: "validation_error",
				message: "Invalid request",
				details: [{ field: "file", message: "statement_unreadable", line: 3 }],
			},
		});

		const error = await api.imports
			.preview(HOUSEHOLD_ID, { file })
			.catch((reason: unknown) => reason);

		expect((error as ValidationError).issues).toEqual([
			{ field: "file", message: "statement_unreadable", line: 3 },
		]);
	});

	it("says when a line came in since the preview", async () => {
		const { api } = fakeApi(409, {
			error: { code: "statement_line_already_imported", message: "Already" },
		});

		const error = await api.imports
			.create(HOUSEHOLD_ID, { file, plan })
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			status: 409,
			code: "statement_line_already_imported",
		});
	});

	it("lists the member's imports, and undoes one", async () => {
		const listed = fakeApi(200, {
			data: [imported],
			pagination: { page: 1, pageSize: 20, total: 1 },
		});
		const removed = fakeApi(204);

		expect(
			await listed.api.imports.list(HOUSEHOLD_ID, { pageSize: 20 }),
		).toEqual({
			items: [imported],
			page: 1,
			pageSize: 20,
			total: 1,
		});
		await removed.api.imports.remove(HOUSEHOLD_ID, IMPORT);

		expect(listed.requests[0]?.url).toBe(`${base}?pageSize=20`);
		expect(removed.requests[0]).toMatchObject({
			url: `${base}/${IMPORT}`,
			method: "DELETE",
		});
	});
});
