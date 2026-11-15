import type { SuggestedTag } from "@repo/schemas";

/** A suggestion as written below: its names, then its child tags. */
interface Suggestion {
	names: SuggestedTag["names"];
	children: Suggestion[];
}

/** A suggested tag named in English, French and Spanish, with its child tags. */
function tag(
	en: string,
	fr: string,
	es: string,
	children: Suggestion[] = [],
): Suggestion {
	return { names: { en, fr, es }, children };
}

// A wide starting set of tags for a household, already named in every
// language: the members uncheck what doesn't concern them before adding it.
// Under a same parent, each name must be unique in each language
// (suggested-tags.test.ts checks it).
const suggestions: Suggestion[] = [
	tag("Home", "Maison", "Hogar", [
		tag("Mortgage", "Hypothèque", "Hipoteca"),
		tag("Rent", "Loyer", "Alquiler"),
		tag("Home Insurance", "Assurance habitation", "Seguro de casa"),
		tag("Property Tax", "Taxe foncière", "Impuesto sobre la propiedad"),
		tag("School Tax", "Taxe scolaire", "Impuesto escolar"),
		tag("Condo Fees", "Frais de copropriété", "Gastos de comunidad"),
		tag("Electricity", "Électricité", "Electricidad"),
		tag("Heating", "Chauffage", "Calefacción"),
		tag("Water", "Eau", "Agua"),
		tag("Internet", "Internet", "Internet"),
		tag("Mobile Phone", "Téléphone mobile", "Teléfono móvil"),
		tag("Television", "Télévision", "Televisión"),
		tag("Maintenance", "Entretien", "Mantenimiento"),
		tag("Repairs", "Réparations", "Reparaciones"),
		tag("Renovations", "Rénovations", "Reformas"),
		tag("Furniture", "Meubles", "Muebles"),
		tag("Appliances", "Électroménagers", "Electrodomésticos"),
		tag("Decoration", "Décoration", "Decoración"),
		tag("Garden", "Jardin", "Jardín"),
		tag("Cleaning", "Ménage", "Limpieza"),
		tag("Household Supplies", "Produits ménagers", "Productos del hogar"),
		tag("Snow Removal", "Déneigement", "Retirada de nieve"),
		tag("Security", "Sécurité", "Seguridad"),
	]),
	tag("Transport", "Transport", "Transporte", [
		tag("Car", "Voiture", "Coche", [
			tag("Gas", "Essence", "Gasolina"),
			tag("Charging", "Recharge électrique", "Recarga eléctrica"),
			tag("Garage", "Garage", "Garaje"),
			tag("Car Insurance", "Assurance auto", "Seguro de coche"),
			tag("Car Loan", "Prêt auto", "Préstamo del coche"),
			tag("Car Lease", "Location auto", "Leasing del coche"),
			tag("Maintenance", "Entretien", "Mantenimiento"),
			tag("Tires", "Pneus", "Neumáticos"),
			tag("Car Wash", "Lavage", "Lavado"),
			tag("Parking", "Stationnement", "Estacionamiento"),
			tag("Tolls", "Péages", "Peajes"),
			tag("Registration", "Immatriculation", "Registro"),
			tag("License", "Permis de conduire", "Licencia"),
			tag("Sticker", "Vignette", "Pegatina"),
			tag("Fines", "Amendes", "Multas"),
		]),
		tag("Public Transport", "Transports en commun", "Transporte público"),
		tag("Train", "Train", "Tren"),
		tag("Bicycle", "Vélo", "Bicicleta"),
		tag("Taxi", "Taxi", "Taxi"),
		tag("Ride Sharing", "Covoiturage", "Compartir coche"),
		tag("Car Rental", "Location de voiture", "Alquiler de coche"),
	]),
	tag("Food", "Alimentation", "Alimentación", [
		tag("Groceries", "Épicerie", "Supermercado"),
		tag("Restaurant", "Restaurant", "Restaurante"),
		tag("Takeout", "Plats à emporter", "Comida para llevar"),
		tag("Meal Delivery", "Livraison de repas", "Comida a domicilio"),
		tag("Work Lunch", "Repas au travail", "Comida en el trabajo"),
		tag("Coffee", "Café", "Café"),
		tag("Bakery", "Boulangerie", "Panadería"),
		tag("Alcohol", "Alcool", "Alcohol"),
	]),
	tag("Children", "Enfants", "Niños", [
		tag("Daycare", "Garderie", "Guardería"),
		tag("School", "École", "Escuela"),
		tag("School Supplies", "Fournitures scolaires", "Material escolar"),
		tag("Tuition", "Frais de scolarité", "Matrícula"),
		tag("Babysitting", "Gardiennage", "Niñera"),
		tag("Summer Camp", "Camp d'été", "Campamento de verano"),
		tag("Activities", "Activités", "Actividades"),
		tag("Sports", "Sports", "Deportes"),
		tag("Lessons", "Cours", "Clases"),
		tag("Clothing", "Vêtements", "Ropa"),
		tag("Toys", "Jouets", "Juguetes"),
		tag("Baby Supplies", "Articles pour bébé", "Artículos para bebé"),
		tag("Allowance", "Argent de poche", "Paga"),
	]),
	tag("Health", "Santé", "Salud", [
		tag("Pharmacy", "Pharmacie", "Farmacia"),
		tag("Doctor", "Médecin", "Médico"),
		tag("Dentist", "Dentiste", "Dentista"),
		tag("Eye Care", "Soins de la vue", "Óptica"),
		tag("Physiotherapy", "Physiothérapie", "Fisioterapia"),
		tag("Therapy", "Thérapie", "Terapia"),
		tag("Hospital", "Hôpital", "Hospital"),
		tag("Health Insurance", "Assurance santé", "Seguro de salud"),
	]),
	tag("Personal Care", "Soins personnels", "Cuidado personal", [
		tag("Hairdresser", "Coiffeur", "Peluquería"),
		tag("Cosmetics", "Cosmétiques", "Cosméticos"),
		tag("Hygiene", "Hygiène", "Higiene"),
		tag("Spa", "Spa", "Spa"),
	]),
	tag("Clothing", "Vêtements", "Ropa", [
		tag("Shoes", "Chaussures", "Zapatos"),
		tag("Accessories", "Accessoires", "Accesorios"),
		tag("Dry Cleaning", "Nettoyage à sec", "Tintorería"),
	]),
	tag("Leisure", "Loisirs", "Ocio", [
		tag("Outings", "Sorties", "Salidas"),
		tag("Cinema", "Cinéma", "Cine"),
		tag("Shows", "Spectacles", "Espectáculos"),
		tag("Sports", "Sports", "Deportes"),
		tag("Gym", "Salle de sport", "Gimnasio"),
		tag("Hobbies", "Passe-temps", "Aficiones"),
		tag("Books", "Livres", "Libros"),
		tag("Music", "Musique", "Música"),
		tag("Video Games", "Jeux vidéo", "Videojuegos"),
	]),
	tag("Subscriptions", "Abonnements", "Suscripciones", [
		tag("Streaming", "Streaming", "Streaming"),
		tag("Software", "Logiciels", "Software"),
		tag("Cloud Storage", "Stockage en ligne", "Almacenamiento en la nube"),
		tag(
			"Newspapers and Magazines",
			"Journaux et magazines",
			"Prensa y revistas",
		),
		tag("Memberships", "Adhésions", "Membresías"),
	]),
	tag("Travel", "Voyages", "Viajes", [
		tag("Flights", "Billets d'avion", "Vuelos"),
		tag("Accommodation", "Hébergement", "Alojamiento"),
		tag("Car Rental", "Location de voiture", "Alquiler de coche"),
		tag("Meals", "Repas", "Comidas"),
		tag("Activities", "Activités", "Actividades"),
		tag("Travel Insurance", "Assurance voyage", "Seguro de viaje"),
		tag("Souvenirs", "Souvenirs", "Recuerdos"),
	]),
	tag("Pets", "Animaux", "Mascotas", [
		tag("Food", "Nourriture", "Comida"),
		tag("Veterinarian", "Vétérinaire", "Veterinario"),
		tag("Grooming", "Toilettage", "Peluquería"),
		tag("Pet Insurance", "Assurance animaux", "Seguro de mascotas"),
		tag("Accessories", "Accessoires", "Accesorios"),
	]),
	tag("Gifts and Donations", "Cadeaux et dons", "Regalos y donaciones", [
		tag("Gifts", "Cadeaux", "Regalos"),
		tag("Birthdays", "Anniversaires", "Cumpleaños"),
		tag("Holidays", "Fêtes", "Fiestas"),
		tag("Donations", "Dons", "Donaciones"),
	]),
	tag("Education", "Éducation", "Educación", [
		tag("Tuition", "Frais de scolarité", "Matrícula"),
		tag("Courses", "Cours", "Cursos"),
		tag("Books", "Livres", "Libros"),
		tag("Student Loan", "Prêt étudiant", "Préstamo estudiantil"),
	]),
	tag("Electronics", "Électronique", "Electrónica", [
		tag("Phone", "Téléphone", "Teléfono"),
		tag("Computer", "Ordinateur", "Ordenador"),
		tag("Accessories", "Accessoires", "Accesorios"),
	]),
	tag("Finances", "Finances", "Finanzas", [
		tag("Bank Fees", "Frais bancaires", "Comisiones bancarias"),
		tag("Interest", "Intérêts", "Intereses"),
		tag("Loan Payments", "Remboursements de prêt", "Pagos de préstamos"),
		tag("Life Insurance", "Assurance vie", "Seguro de vida"),
		tag("Savings", "Épargne", "Ahorro"),
		tag("Investments", "Placements", "Inversiones"),
		tag("Retirement", "Retraite", "Jubilación"),
		tag(
			"Professional Fees",
			"Honoraires professionnels",
			"Honorarios profesionales",
		),
	]),
	tag("Taxes", "Impôts", "Impuestos", [
		tag("Income Tax", "Impôt sur le revenu", "Impuesto sobre la renta"),
	]),
	tag("Work", "Travail", "Trabajo", [
		tag(
			"Professional Expenses",
			"Frais professionnels",
			"Gastos profesionales",
		),
		tag("Union Dues", "Cotisations syndicales", "Cuotas sindicales"),
		tag("Training", "Formation", "Formación"),
	]),
	tag("Income", "Revenus", "Ingresos", [
		tag("Salary", "Salaire", "Salario"),
		tag("Bonus", "Prime", "Bonificación"),
		tag("Self-Employment", "Travail autonome", "Trabajo autónomo"),
		tag(
			"Family Allowance",
			"Allocations familiales",
			"Prestaciones familiares",
		),
		tag(
			"Government Benefits",
			"Prestations gouvernementales",
			"Prestaciones del gobierno",
		),
		tag("Employment Insurance", "Assurance-emploi", "Seguro de desempleo"),
		tag("Pension", "Rente de retraite", "Pensión"),
		tag("Tax Refund", "Remboursement d'impôt", "Devolución de impuestos"),
		tag("Interest", "Intérêts", "Intereses"),
		tag("Dividends", "Dividendes", "Dividendos"),
		tag("Rental Income", "Revenus locatifs", "Ingresos por alquiler"),
		tag("Sales", "Ventes", "Ventas"),
		tag("Refunds", "Remboursements", "Reembolsos"),
		tag("Gifts Received", "Cadeaux reçus", "Regalos recibidos"),
	]),
	tag("Miscellaneous", "Divers", "Varios"),
];

/** The part of a key for one tag: its English name, in lowercase with dashes. */
function slug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Gives each suggestion its key: the path of English names leading to it
 * ("transport/car/gas"). The key of a tag starts with its parent's: selecting
 * or unselecting a branch is a matter of prefixes.
 */
function withKeys(level: Suggestion[], parentKey?: string): SuggestedTag[] {
	return level.map(({ names, children }) => {
		const key = parentKey ? `${parentKey}/${slug(names.en)}` : slug(names.en);
		return { key, names, children: withKeys(children, key) };
	});
}

export const suggestedTags: SuggestedTag[] = withKeys(suggestions);
