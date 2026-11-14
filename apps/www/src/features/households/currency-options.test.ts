import { HOUSEHOLD_CURRENCIES } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { currencyOptions } from "@/features/households/currency-options";

describe("currencyOptions", () => {
	it("offers every currency a household can use", () => {
		expect(currencyOptions("en").map((option) => option.value)).toEqual([
			...HOUSEHOLD_CURRENCIES,
		]);
	});

	it("names the currencies in the given language", () => {
		const label = (locale: string) => currencyOptions(locale)[0]?.label;

		expect(label("en")).toBe("CAD · Canadian Dollar");
		expect(label("fr")).toBe("CAD · dollar canadien");
		expect(label("es")).toBe("CAD · dólar canadiense");
	});
});
