import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
	it("lets a key make its requests up to the limit, then refuses", () => {
		const limiter = createRateLimiter({
			limit: 2,
			windowMs: 1000,
			now: () => 0,
		});

		expect([
			limiter.consume("alice"),
			limiter.consume("alice"),
			limiter.consume("alice"),
		]).toEqual([true, true, false]);
		expect(limiter.consume("bob")).toBe(true);
	});

	it("frees a key once its oldest requests leave the window", () => {
		let time = 0;
		const limiter = createRateLimiter({
			limit: 1,
			windowMs: 1000,
			now: () => time,
		});

		limiter.consume("alice");
		time = 999;
		expect(limiter.consume("alice")).toBe(false);
		time = 1000;
		expect(limiter.consume("alice")).toBe(true);
	});
});
