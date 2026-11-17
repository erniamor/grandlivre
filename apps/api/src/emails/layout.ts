import { env } from "@/env";
import type { Locale } from "@/lib/locale";

/**
 * The default theme's colors ("ledger" in @repo/themes, light mode), written
 * out: an email can't read the app's CSS variables, and most email apps
 * drop a <style> block. Keep them in sync with ledger.css by hand.
 */
const colors = {
	page: "#f8fafc",
	card: "#ffffff",
	text: "#0f172a",
	muted: "#475569",
	border: "#e2e8f0",
	band: "#0f172a",
	bandText: "#f8fafc",
	primary: "#047857",
	primaryText: "#ffffff",
	codeBackground: "#f1f5f9",
} as const;

const FONT =
	"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** What an email says, the same in its HTML and in its plain text. */
export interface EmailContent {
	locale: Locale;
	/** Shown by email apps next to the subject, before it is opened. */
	preview: string;
	greeting: string;
	/** Before the action: what the email is about. */
	intro: string[];
	/** The link to follow, as a button. */
	action?: { label: string; url: string };
	/** A code to type, shown large. */
	code?: string;
	/** After the action: how long it lasts, what to do if unexpected. */
	notes: string[];
}

/** A text safe inside HTML: names and household names come from members. */
export function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function paragraph(text: string, color: string = colors.text): string {
	return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${color};">${escapeHtml(text)}</p>`;
}

/** A button made of a table cell, the one kind every email app shows as a button. */
function button({ label, url }: { label: string; url: string }): string {
	const href = escapeHtml(url);
	return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${colors.primary};"><a href="${href}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:16px;font-weight:600;line-height:24px;color:${colors.primaryText};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table><p style="margin:0 0 16px;font-family:${FONT};font-size:13px;line-height:20px;color:${colors.muted};word-break:break-all;"><a href="${href}" style="color:${colors.primary};">${href}</a></p>`;
}

function codeBlock(code: string): string {
	return `<p style="margin:8px 0 24px;padding:16px;border-radius:8px;background:${colors.codeBackground};font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;color:${colors.text};">${escapeHtml(code)}</p>`;
}

/**
 * The email as HTML: the app's band with its logo and name, then a card
 * with the message, in the default theme's colors. Tables and inline
 * styles only: what every email app shows alike.
 */
export function renderEmailHtml(content: EmailContent): string {
	// The front end serves the logo: an email app can't show an SVG
	const logo = `${env.APP_URL.replace(/\/$/, "")}/icon-192.png`;
	return `<!doctype html>
<html lang="${content.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Grand Livre</title>
</head>
<body style="margin:0;padding:0;background:${colors.page};">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(content.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:16px 24px;background:${colors.band};border-radius:12px 12px 0 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:12px;"><img src="${escapeHtml(logo)}" width="36" height="36" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td style="font-family:${FONT};font-size:20px;font-weight:700;color:${colors.bandText};">Grand Livre</td>
</tr></table>
</td></tr>
<tr><td style="padding:32px 24px 16px;background:${colors.card};border:1px solid ${colors.border};border-top:0;border-radius:0 0 12px 12px;">
${paragraph(content.greeting)}
${content.intro.map((text) => paragraph(text)).join("\n")}
${content.action ? button(content.action) : ""}
${content.code ? codeBlock(content.code) : ""}
${content.notes.map((text) => paragraph(text, colors.muted)).join("\n")}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** The email as plain text, for the apps that don't show HTML. */
export function renderEmailText(content: EmailContent): string {
	const intro = [...content.intro];
	// The link or the code right under the paragraph that leads to it
	const follow = content.action?.url ?? content.code;
	if (follow !== undefined) {
		intro.push(`${intro.pop() ?? ""}\n${follow}`);
	}
	return [content.greeting, ...intro, content.notes.join("\n")].join("\n\n");
}
