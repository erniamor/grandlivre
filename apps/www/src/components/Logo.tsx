import { Link } from "@tanstack/react-router";
import { LogoMark } from "@/components/LogoMark";
import { m } from "@/paraglide/messages";

/** The product's mark and name, linking to the home page. */
export function Logo() {
	return (
		<Link
			to="/"
			aria-label={m.logo_home_link()}
			className="flex items-center gap-2 rounded-md font-heading font-semibold text-lg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
		>
			<LogoMark className="size-7 shrink-0" />
			<span>{m.app_name()}</span>
		</Link>
	);
}
