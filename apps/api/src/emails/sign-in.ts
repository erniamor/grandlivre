import {
	type EmailContent,
	renderEmailHtml,
	renderEmailText,
} from "@/emails/layout";
import type { Locale } from "@/lib/locale";
import type { EmailMessage } from "@/lib/mailer";

interface SignInMessages {
	greeting: string;
	linkSubject: string;
	linkIntro: string;
	linkButton: string;
	linkValid: (minutes: number) => string;
	codeSubject: (code: string) => string;
	codeIntro: string;
	codeValid: (minutes: number) => string;
	ignore: string;
}

const messages: Record<Locale, SignInMessages> = {
	en: {
		greeting: "Hello,",
		linkSubject: "Your Grand Livre sign-in link",
		linkIntro: "Click this link to sign in to Grand Livre:",
		linkButton: "Sign in",
		linkValid: (minutes) =>
			`This link is valid for ${minutes} minutes and works only once.`,
		codeSubject: (code) => `Your Grand Livre sign-in code: ${code}`,
		codeIntro: "Your Grand Livre sign-in code is:",
		codeValid: (minutes) => `This code is valid for ${minutes} minutes.`,
		ignore: "If you didn't ask to sign in, ignore this email.",
	},
	fr: {
		greeting: "Bonjour,",
		linkSubject: "Votre lien de connexion à Grand Livre",
		linkIntro: "Cliquez sur ce lien pour vous connecter à Grand Livre :",
		linkButton: "Se connecter",
		linkValid: (minutes) =>
			`Ce lien est valable ${minutes} minutes et ne fonctionne qu'une fois.`,
		codeSubject: (code) => `Votre code de connexion à Grand Livre : ${code}`,
		codeIntro: "Votre code de connexion à Grand Livre est :",
		codeValid: (minutes) => `Ce code est valable ${minutes} minutes.`,
		ignore: "Si vous n'avez pas demandé à vous connecter, ignorez cet e-mail.",
	},
	es: {
		greeting: "Hola:",
		linkSubject: "Tu enlace de inicio de sesión en Grand Livre",
		linkIntro: "Haz clic en este enlace para iniciar sesión en Grand Livre:",
		linkButton: "Iniciar sesión",
		linkValid: (minutes) =>
			`Este enlace es válido durante ${minutes} minutos y solo funciona una vez.`,
		codeSubject: (code) =>
			`Tu código de inicio de sesión en Grand Livre: ${code}`,
		codeIntro: "Tu código de inicio de sesión en Grand Livre es:",
		codeValid: (minutes) => `Este código es válido durante ${minutes} minutos.`,
		ignore: "Si no has solicitado iniciar sesión, ignora este correo.",
	},
};

interface SignInEmailInput {
	to: string;
	locale: Locale;
	expiresInMinutes: number;
}

function email(
	to: string,
	subject: string,
	content: EmailContent,
): EmailMessage {
	return {
		to,
		subject,
		text: renderEmailText(content),
		html: renderEmailHtml(content),
	};
}

export function signInLinkEmail({
	to,
	url,
	locale,
	expiresInMinutes,
}: SignInEmailInput & { url: string }): EmailMessage {
	const m = messages[locale];
	return email(to, m.linkSubject, {
		locale,
		preview: m.linkValid(expiresInMinutes),
		greeting: m.greeting,
		intro: [m.linkIntro],
		action: { label: m.linkButton, url },
		notes: [m.linkValid(expiresInMinutes), m.ignore],
	});
}

export function signInCodeEmail({
	to,
	code,
	locale,
	expiresInMinutes,
}: SignInEmailInput & { code: string }): EmailMessage {
	const m = messages[locale];
	return email(to, m.codeSubject(code), {
		locale,
		preview: m.codeValid(expiresInMinutes),
		greeting: m.greeting,
		intro: [m.codeIntro],
		code,
		notes: [m.codeValid(expiresInMinutes), m.ignore],
	});
}
