import { renderEmailHtml, renderEmailText } from "@/emails/layout";
import type { Locale } from "@/lib/locale";
import type { EmailMessage } from "@/lib/mailer";

interface InvitationMessages {
	greeting: string;
	subject: (household: string) => string;
	invites: (inviter: string, household: string) => string;
	signIn: (to: string) => string;
	button: string;
	valid: (days: number) => string;
	ignore: (inviter: string) => string;
}

const messages: Record<Locale, InvitationMessages> = {
	en: {
		greeting: "Hello,",
		subject: (household) => `Join ${household} on Grand Livre`,
		invites: (inviter, household) =>
			`${inviter} invites you to join the household "${household}" on Grand Livre, to follow the family's finances together.`,
		signIn: (to) =>
			`Sign in with this email address (${to}) to accept the invitation:`,
		button: "See the invitation",
		valid: (days) => `This invitation is valid for ${days} days.`,
		ignore: (inviter) => `If you don't know ${inviter}, ignore this email.`,
	},
	fr: {
		greeting: "Bonjour,",
		subject: (household) => `Rejoignez ${household} sur Grand Livre`,
		invites: (inviter, household) =>
			`${inviter} vous invite à rejoindre le foyer « ${household} » sur Grand Livre, pour suivre ensemble les finances de la famille.`,
		signIn: (to) =>
			`Connectez-vous avec cette adresse e-mail (${to}) pour accepter l'invitation :`,
		button: "Voir l'invitation",
		valid: (days) => `Cette invitation est valable ${days} jours.`,
		ignore: (inviter) =>
			`Si vous ne connaissez pas ${inviter}, ignorez cet e-mail.`,
	},
	es: {
		greeting: "Hola:",
		subject: (household) => `Únete a ${household} en Grand Livre`,
		invites: (inviter, household) =>
			`${inviter} te invita a unirte al hogar «${household}» en Grand Livre, para seguir juntos las finanzas de la familia.`,
		signIn: (to) =>
			`Inicia sesión con esta dirección de correo (${to}) para aceptar la invitación:`,
		button: "Ver la invitación",
		valid: (days) => `Esta invitación es válida durante ${days} días.`,
		ignore: (inviter) => `Si no conoces a ${inviter}, ignora este correo.`,
	},
};

interface HouseholdInvitationEmailInput {
	to: string;
	locale: Locale;
	/** Name of the person inviting, or their email when they have no name yet. */
	inviter: string;
	household: string;
	/** Page of the front end where the invitation is accepted, once signed in. */
	url: string;
	expiresInDays: number;
}

export function householdInvitationEmail({
	to,
	locale,
	inviter,
	household,
	url,
	expiresInDays,
}: HouseholdInvitationEmailInput): EmailMessage {
	const m = messages[locale];
	const content = {
		locale,
		preview: m.invites(inviter, household),
		greeting: m.greeting,
		intro: [m.invites(inviter, household), m.signIn(to)],
		action: { label: m.button, url },
		notes: [m.valid(expiresInDays), m.ignore(inviter)],
	};
	return {
		to,
		subject: m.subject(household),
		text: renderEmailText(content),
		html: renderEmailHtml(content),
	};
}
