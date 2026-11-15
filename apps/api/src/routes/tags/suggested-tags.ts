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
      { names: { en: "Home Insurance", fr: "Assurance habitation", es: "Seguro de casa" } },
			{ names: { en: "Electricity", fr: "Électricité", es: "Electricidad" } },
			{ names: { en: "Internet", fr: "Internet", es: "Internet" } },
      { names: { en: "Maintenance", fr: "Entretien", es: "Mantenimiento" } },
      { names: { en: "Property Tax", fr: "Taxe foncière", es: "Impuesto sobre la propiedad" } },
		],
	},
	{
		names: { en: "Car", fr: "Voiture", es: "Coche" },
		children: [
      { names: { en: "Gas", fr: "Essence", es: "Gasolina" } },
      { names: { en: "Garage", fr: "Garage", es: "Garaje" } },
      { names: { en: "Car Insurance", fr: "Assurance auto", es: "Seguro de coche" } },
      { names: { en: "Maintenance", fr: "Entretien", es: "Mantenimiento" } },
      { names: { en: "Parking", fr: "Stationnement", es: "Estacionamiento" } },
      { names: { en: "Registration", fr: "Immatriculation", es: "Registro" } },
      { names: { en: "License", fr: "Permis de conduire", es: "Licencia" } },
      { names: { en: "Sticker", fr: "Vignette", es: "Pegatina" } },
      { names: { en: "Fines", fr: "Amendes", es: "Multas" } },
    ],
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
		children: [
      { names: { en: "Daycare", fr: "Garderie", es: "Guardería" } },
      { names: { en: "School", fr: "École", es: "Escuela" } },
      { names: { en: "Activities", fr: "Activités", es: "Actividades" } },
      { names: { en: "Toys", fr: "Jouets", es: "Juguetes" } },
    ],
	},
	{ names: { en: "Leisure", fr: "Loisirs", es: "Ocio" } },
	{ names: { en: "Health", fr: "Santé", es: "Salud" } },
	{
		names: { en: "Income", fr: "Revenus", es: "Ingresos" },
		children: [{ names: { en: "Salary", fr: "Salaire", es: "Salario" } }],
	},
];
