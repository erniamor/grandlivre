import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ASSISTANT_MODEL,
	type AssistantDraft,
	createClaudeAssistant,
	type MessagesClient,
} from "@/lib/assistant";
import { AppError } from "@/lib/errors";

afterEach(() => {
	vi.restoreAllMocks();
});

const answer: AssistantDraft = {
	type: "expense",
	date: null,
	account: null,
	to_account: null,
	payee: "Shell",
	note: null,
	lines: [{ amount: "72.00", tag: "t1" }],
	new_tag: null,
	remark: null,
};

/** A client that answers `response` and records the request. */
function fakeClient(response: object | Error) {
	const parse = vi.fn(async () => {
		if (response instanceof Error) {
			throw response;
		}
		return response;
	});
	return {
		client: { beta: { messages: { parse } } } as unknown as MessagesClient,
		parse,
	};
}

const request = {
	context: "Household currency: CAD",
	entry: "<entry>gas 72</entry>",
};

async function failure(response: object | Error) {
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	const { client } = fakeClient(response);
	return createClaudeAssistant(client)
		.draftTransaction(request)
		.catch((error: unknown) => error);
}

describe("the Claude assistant", () => {
	it("asks for a structured answer at low effort, with the context cached and a fallback on refusal", async () => {
		const { client, parse } = fakeClient({
			stop_reason: "end_turn",
			parsed_output: answer,
		});

		expect(
			await createClaudeAssistant(client).draftTransaction(request),
		).toEqual(answer);
		// The fake records untyped calls: read the request back as plain data
		const [params] =
			(parse.mock.calls as unknown as Record<string, unknown>[][])[0] ?? [];
		expect(params).toMatchObject({
			model: ASSISTANT_MODEL,
			betas: ["server-side-fallback-2026-07-01"],
			fallbacks: "default",
			output_config: { effort: "low", format: expect.any(Object) },
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: request.context,
							cache_control: { type: "ephemeral" },
						},
						{ type: "text", text: request.entry },
					],
				},
			],
		});
		// Nothing volatile before the cached context
		expect(params?.system).toEqual(expect.any(String));
		expect(String(params?.system)).not.toContain("2026");
	});

	it("sends a receipt's photo after the cached context, then the day, and asks for its figures", async () => {
		const reading = {
			merchant: "IGA",
			date: null,
			account: null,
			note: null,
			items: [{ name: "Apples", amount: "5.00", tag: null, taxable: null }],
			subtotal: null,
			taxes: [],
			total: "5.00",
			new_tag: null,
			remark: null,
		};
		const { client, parse } = fakeClient({
			stop_reason: "end_turn",
			parsed_output: reading,
		});

		expect(
			await createClaudeAssistant(client).readReceipt({
				context: request.context,
				photo: { mediaType: "image/png", data: "iVBORw0KGgo=" },
				today: "2026-11-15",
			}),
		).toEqual(reading);
		const [params] =
			(parse.mock.calls as unknown as Record<string, unknown>[][])[0] ?? [];
		expect(params).toMatchObject({
			model: ASSISTANT_MODEL,
			output_config: { effort: "low", format: expect.any(Object) },
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: request.context,
							cache_control: { type: "ephemeral" },
						},
						{
							type: "image",
							source: {
								type: "base64",
								media_type: "image/png",
								data: "iVBORw0KGgo=",
							},
						},
						{ type: "text", text: expect.stringContaining("2026-11-15") },
					],
				},
			],
		});
		expect(String(params?.system)).toContain("receipt");
	});

	it("says the note wasn't understood when every model declines it", async () => {
		const error = await failure({
			stop_reason: "refusal",
			parsed_output: null,
		});

		expect(error).toBeInstanceOf(AppError);
		expect(error).toMatchObject({ status: 422, code: "draft_not_understood" });
	});

	it("says it is unavailable when the answer can't be used", async () => {
		for (const response of [
			{ stop_reason: "max_tokens", parsed_output: answer },
			{ stop_reason: "end_turn", parsed_output: null },
		]) {
			expect(await failure(response)).toMatchObject({
				status: 503,
				code: "assistant_unavailable",
			});
		}
	});

	it("says it is unavailable when the Claude API can't be reached, without logging the note", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { client } = fakeClient(
			new Anthropic.APIConnectionError({ message: "Connection error." }),
		);

		const error = await createClaudeAssistant(client)
			.draftTransaction(request)
			.catch((reason: unknown) => reason);

		expect(error).toMatchObject({ status: 503, code: "assistant_unavailable" });
		expect(JSON.stringify(log.mock.calls)).not.toContain("gas 72");
	});

	it("lets any other error through", async () => {
		const bug = new TypeError("A bug");

		expect(await failure(bug)).toBe(bug);
	});
});
