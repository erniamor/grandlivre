import { ApiError, RateLimitError, ValidationError } from "@repo/resources";
import { describe, expect, it } from "vitest";
import {
	RECEIPT_PHOTO_MAX_SIDE,
	receiptErrorMessage,
} from "@/features/transactions/receipt-photo";

describe("RECEIPT_PHOTO_MAX_SIDE", () => {
	it("aims at a size the assistant reads well", () => {
		expect(RECEIPT_PHOTO_MAX_SIDE).toBe(1600);
	});
});

describe("receiptErrorMessage", () => {
	it("says a receipt couldn't be read in words about a receipt", () => {
		expect(
			receiptErrorMessage(new ApiError(422, "draft_not_understood", "No")),
		).toBe(
			"The assistant couldn't read this receipt. Try a sharper photo, or fill in the form below.",
		);
	});

	it("says what is wrong with the photo", () => {
		expect(
			receiptErrorMessage(
				new ValidationError(422, "validation_error", "Invalid", [
					{ field: "photo", message: "receipt_photo_invalid" },
				]),
			),
		).toBe(
			"This file isn't a photo the assistant can read. Choose a JPEG, PNG, WebP or GIF image.",
		);
		expect(
			receiptErrorMessage(new ApiError(413, "payload_too_large", "Too large")),
		).toBe("This photo is too large (5 MB at most).");
	});

	it("says the same as elsewhere for the rest", () => {
		expect(
			receiptErrorMessage(new RateLimitError(429, "too_many_requests", "Wait")),
		).toBe("Too many attempts. Wait a minute and try again.");
		expect(
			receiptErrorMessage(new ApiError(503, "assistant_unavailable", "Down")),
		).toBe("The assistant is unavailable for now. Fill in the form below.");
	});
});
