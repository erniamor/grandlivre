import type { TagNames } from "@repo/schemas";

export interface SuggestedTag {
	names: Required<TagNames>;
	children?: SuggestedTag[];
}

// A starting set of tags for a household, already named in every language
export const suggestedTags: SuggestedTag[] = [
	{
		names: { en: "Home", fr: "Maison", es: "Hogar" },
		children: [
			{ names: { en: "Mortgage", fr: "Hypothèque", es: "Hipoteca" } },
			{ names: { en: "Electricity", fr: "Électricité", es: "Electricidad" } },
			{ names: { en: "Internet", fr: "Internet", es: "Internet" } },
		],
	},
	{
		names: { en: "Car", fr: "Voiture", es: "Coche" },
		children: [{ names: { en: "Gas", fr: "Essence", es: "Gasolina" } }],
	},
	{
		names: { en: "Food", fr: "Alimentation", es: "Alimentación" },
		children: [
			{ names: { en: "Groceries", fr: "Épicerie", es: "Supermercado" } },
			{ names: { en: "Restaurant", fr: "Restaurant", es: "Restaurante" } },
		],
	},
	{
		names: { en: "Children", fr: "Enfants", es: "Niños" },
		children: [{ names: { en: "Daycare", fr: "Garderie", es: "Guardería" } }],
	},
	{ names: { en: "Leisure", fr: "Loisirs", es: "Ocio" } },
	{ names: { en: "Health", fr: "Santé", es: "Salud" } },
	{
		names: { en: "Income", fr: "Revenus", es: "Ingresos" },
		children: [{ names: { en: "Salary", fr: "Salaire", es: "Salario" } }],
	},
];
