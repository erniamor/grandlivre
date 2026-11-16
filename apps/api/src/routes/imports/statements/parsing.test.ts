import { describe, expect, it } from "vitest";
import {
	parseBankAmount,
	parseBankDate,
} from "@/routes/imports/statements/amounts";
import { parseCsv } from "@/routes/imports/statements/csv";
import { decodeStatement } from "@/routes/imports/statements/decode";
import {
	descriptionKey,
	withExternalIds,
} from "@/routes/imports/statements/fingerprint";

describe("parseCsv", () => {
	it("splits fields, with quotes, doubled quotes, commas and line breaks inside", () => {
		expect(parseCsv('a,"b, c","say ""hi""",\r\n"two\nlines",x\n')).toEqual([
			["a", "b, c", 'say "hi"', ""],
			["two\nlines", "x"],
		]);
	});

	it("leaves blank lines out, and reads a last line without its end", () => {
		expect(parseCsv("\r\n1,2\r\n\r\n3,4")).toEqual([
			["1", "2"],
			["3", "4"],
		]);
	});
});

describe("decodeStatement", () => {
	it("reads UTF-8, without its byte order mark", () => {
		expect(decodeStatement(Buffer.from("﻿Dépôt", "utf-8"))).toBe("Dépôt");
	});

	it("reads Windows-1252 when the bytes aren't UTF-8", () => {
		expect(decodeStatement(Buffer.from("Dépôt", "latin1"))).toBe("Dépôt");
	});
});

describe("parseBankAmount and parseBankDate", () => {
	it("reads amounts in minor units, without floats", () => {
		expect(
			["1234.56", "35.9", "12", "0.07", "1,50", "-3", ""].map(parseBankAmount),
		).toEqual([123456, 3590, 1200, 7, null, null, null]);
		expect(parseBankAmount("1.15")).toBe(115);
	});

	it("reads days written YYYY/MM/DD, and only real ones", () => {
		expect(parseBankDate("2026/10/05")).toBe("2026-10-05");
		expect(parseBankDate("2026/02/31")).toBeNull();
		expect(parseBankDate("05/10/2026")).toBeNull();
	});
});

describe("withExternalIds", () => {
	const line = { date: "2026-10-15", amount: -300_00 };

	it("gives the same identity whatever the accents, digits and punctuation", () => {
		const [statement] = withExternalIds([
			{ ...line, description: "Virement - AccèsD Internet /à 654321 EOP" },
		]);
		const [history] = withExternalIds([
			{ ...line, description: "Virement - AccesD Internet /a 0654321-EOP" },
		]);

		expect(descriptionKey("AccèsD /à 1-EOP")).toBe("accesdaeop");
		expect(statement?.externalId).toBe(history?.externalId);
	});

	it("tells apart lines of another day, amount or description", () => {
		const ids = withExternalIds([
			{ ...line, description: "Achat /CAFE" },
			{ ...line, date: "2026-10-16", description: "Achat /CAFE" },
			{ ...line, amount: -301_00, description: "Achat /CAFE" },
			{ ...line, description: "Achat /THE" },
		]).map((each) => each.externalId);

		expect(new Set(ids).size).toBe(4);
	});
});
