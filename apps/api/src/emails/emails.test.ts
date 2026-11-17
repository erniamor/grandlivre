import { describe, expect, it } from "vitest";
import { householdInvitationEmail } from "@/emails/household-invitation";
import { escapeHtml } from "@/emails/layout";
import { signInCodeEmail, signInLinkEmail } from "@/emails/sign-in";

describe("the sign-in emails", () => {
	it("keep their plain text, the link under the paragraph leading to it", () => {
		const email = signInLinkEmail({
			to: "alice@example.com",
			url: "http://localhost:3001/v1/auth/magic-link/verify?token=abc",
			locale: "en",
			expiresInMinutes: 15,
		});

		expect(email.text).toBe(
			[
				"Hello,",
				"",
				"Click this link to sign in to Grand Livre:",
				"http://localhost:3001/v1/auth/magic-link/verify?token=abc",
				"",
				"This link is valid for 15 minutes and works only once.",
				"If you didn't ask to sign in, ignore this email.",
			].join("\n"),
		);
	});

	it("show the app's logo and name, and the link as a button, in the member's language", () => {
		const { html } = signInLinkEmail({
			to: "alice@example.com",
			url: "http://localhost:3001/v1/auth/magic-link/verify?token=a&b=c",
			locale: "fr",
			expiresInMinutes: 15,
		});

		expect(html).toContain('<html lang="fr">');
		expect(html).toContain('src="http://localhost:3000/icon-192.png"');
		expect(html).toContain("Grand Livre");
		expect(html).toContain(
			'href="http://localhost:3001/v1/auth/magic-link/verify?token=a&amp;b=c"',
		);
		expect(html).toContain(">Se connecter</a>");
		// The default theme's primary color on the button
		expect(html).toContain("background:#047857");
	});

	it("show the code large, and keep it in the subject and the text", () => {
		const email = signInCodeEmail({
			to: "alice@example.com",
			code: "123456",
			locale: "es",
			expiresInMinutes: 10,
		});

		expect(email.subject).toContain("123456");
		expect(email.text).toContain(
			"Tu código de inicio de sesión en Grand Livre es:\n123456",
		);
		expect(email.html).toMatch(/font-size:32px[^>]*>123456<\/p>/);
	});
});

describe("the invitation email", () => {
	it("escapes in its HTML the names members chose", () => {
		const email = householdInvitationEmail({
			to: "bob@example.com",
			locale: "en",
			inviter: "Alice <script>",
			household: 'The "Tremblays" & co',
			url: "http://localhost:3000/dashboard",
			expiresInDays: 7,
		});

		expect(email.html).toContain(
			"Alice &lt;script&gt; invites you to join the household &quot;The &quot;Tremblays&quot; &amp; co&quot;",
		);
		expect(email.html).not.toContain("<script>");
		expect(email.text).toContain(
			'Alice <script> invites you to join the household "The "Tremblays" & co"',
		);
		expect(email.html).toContain(">See the invitation</a>");
	});
});

describe("escapeHtml", () => {
	it("escapes what HTML reads as markup", () => {
		expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
			"&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
		);
	});
});
