import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PrivateModeToggle } from "@/features/privacy/PrivateModeToggle";
import {
	PRIVATE_COOKIE,
	parsePrivateMode,
} from "@/features/privacy/private-mode";
import { readCookie } from "@/lib/cookies";
import { setTestLocale } from "@/test/locale";
import { renderWithQueryClient } from "@/test/render-with-router";

afterEach(() => {
	delete document.documentElement.dataset.private;
	// biome-ignore lint/suspicious/noDocumentCookie: clears the cookie the test wrote
	document.cookie = `${PRIVATE_COOKIE}=; path=/; max-age=0`;
});

describe("parsePrivateMode", () => {
	it("is on only for the cookie's own value", () => {
		expect(parsePrivateMode("1")).toBe(true);
		expect(parsePrivateMode("0")).toBe(false);
		expect(parsePrivateMode(undefined)).toBe(false);
		expect(parsePrivateMode("yes")).toBe(false);
	});
});

describe("PrivateModeToggle", () => {
	it("hides what is sensitive at once, says so, and remembers it on this device", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<PrivateModeToggle initialPrivate={false} />);
		const toggle = screen.getByRole("button", { name: "Private mode" });

		expect(toggle).toHaveAttribute("aria-pressed", "false");
		await user.click(toggle);

		expect(toggle).toHaveAttribute("aria-pressed", "true");
		expect(toggle).toHaveTextContent("Private");
		expect(document.documentElement.dataset.private).toBe("");
		expect(readCookie(document.cookie, PRIVATE_COOKIE)).toBe("1");

		await user.click(toggle);
		expect(toggle).toHaveAttribute("aria-pressed", "false");
		expect(document.documentElement.dataset.private).toBeUndefined();
		expect(readCookie(document.cookie, PRIVATE_COOKIE)).toBe("0");
	});

	it("starts as the page was rendered, in French", () => {
		setTestLocale("fr");
		renderWithQueryClient(<PrivateModeToggle initialPrivate />);

		const toggle = screen.getByRole("button", { name: "Mode privé" });
		expect(toggle).toHaveAttribute("aria-pressed", "true");
		expect(toggle).toHaveTextContent("Privé");
	});
});
