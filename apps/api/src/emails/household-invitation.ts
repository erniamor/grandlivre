import type { Locale } from "@/lib/locale";
import type { EmailMessage } from "@/lib/mailer";

interface InvitationMessages {
	subject: (household: string) => string;
	text: (input: {
		inviter: string;
		household: string;
		to: string;
		url: string;
		days: number;
	}) => string;
}

const messages: Record<Locale, InvitationMessages> = {
	en: {
		subject: (household) => `Join ${household} on Grand Livre`,
		text: ({ inviter, household, to, url, days }) =>
			`Hello,\n\n${inviter} invites you to join the household "${household}" on Grand Livre, to follow the family's finances together.\n\nSign in with this email address (${to}) to accept the invitation:\n${url}\n\nThis invitation is valid for ${days} days.\nIf you don't know ${inviter}, ignore this email.`,
	},
	fr: {
		subject: (household) => `Rejoignez ${household} sur Grand Livre`,
		text: ({ inviter, household, to, url, days }) =>
			`Bonjour,\n\n${inviter} vous invite à rejoindre le foyer « ${household} » sur Grand Livre, pour suivre ensemble les finances de la famille.\n\nConnectez-vous avec cette adresse e-mail (${to}) pour accepter l'invitation :\n${url}\n\nCette invitation est valable ${days} jours.\nSi vous ne connaissez pas ${inviter}, ignorez cet e-mail.`,
	},
	es: {
		subject: (household) => `Únete a ${household} en Grand Livre`,
		text: ({ inviter, household, to, url, days }) =>
			`Hola:\n\n${inviter} te invita a unirte al hogar «${household}» en Grand Livre, para seguir juntos las finanzas de la familia.\n\nInicia sesión con esta dirección de correo (${to}) para aceptar la invitación:\n${url}\n\nEsta invitación es válida durante ${days} días.\nSi no conoces a ${inviter}, ignora este correo.`,
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
	return {
		to,
		subject: m.subject(household),
		text: m.text({ inviter, household, to, url, days: expiresInDays }),
	};
}
