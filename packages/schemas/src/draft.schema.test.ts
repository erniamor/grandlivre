import { describe, expect, it } from "vitest";
import { createDraftSchema, DRAFT_TEXT_MAX_LENGTH } from "./draft.schema";

function messages(result: { error?: { issues: { message: string }[] } }) {
	return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("createDraftSchema", () => {
	it("accepts a note, trimmed, with the member's day", () => {
		expect(
			createDraftSchema.parse({ text: "  essence 72 $ ", today: "2026-11-15" }),
		).toEqual({ text: "essence 72 $", today: "2026-11-15" });
	});

	it("rejects an empty or too long note", () => {
		expect(
			messages(
				createDraftSchema.safeParse({ text: "  ", today: "2026-11-15" }),
			),
		).toEqual(["draft_text_required"]);
		expect(
			messages(
				createDraftSchema.safeParse({
					text: "a".repeat(DRAFT_TEXT_MAX_LENGTH + 1),
					today: "2026-11-15",
				}),
			),
		).toEqual(["draft_text_too_long"]);
	});

	it("rejects a day that isn't a calendar day", () => {
		expect(
			messages(createDraftSchema.safeParse({ text: "gas 72", today: "15/11" })),
		).toEqual(["date_invalid"]);
	});
});
