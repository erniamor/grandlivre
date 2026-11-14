import { describe, expect, it } from "vitest";
import { webManifest } from "@/features/pwa/manifest";

describe("webManifest", () => {
	it("opens the dashboard as a standalone app, in the requested language", () => {
		const manifest = webManifest("fr");

		expect(manifest).toMatchObject({
			name: "Grand Livre",
			lang: "fr",
			description:
				"Les finances de la famille : comptes, revenus et dépenses, au même endroit.",
			start_url: "/dashboard",
			display: "standalone",
		});
		expect(manifest.shortcuts).toEqual([
			{ name: "Tableau de bord", url: "/dashboard" },
		]);
	});

	it("offers the icons installation needs, including a maskable one", () => {
		const { icons } = webManifest("en");

		expect(icons.map((icon) => icon.sizes)).toEqual([
			"192x192",
			"512x512",
			"512x512",
		]);
		expect(
			icons.some((icon) => "purpose" in icon && icon.purpose === "maskable"),
		).toBe(true);
	});
});
