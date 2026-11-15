import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { m } from "@/paraglide/messages";

/** Link from an account's page back to the list of accounts. */
export function AccountsBackLink() {
	return (
		<Link
			to="/accounts"
			className="inline-flex items-center gap-1.5 justify-self-start rounded-sm text-muted-foreground text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
		>
			<ArrowLeftIcon aria-hidden className="size-4" />
			{m.accounts_back_link()}
		</Link>
	);
}
