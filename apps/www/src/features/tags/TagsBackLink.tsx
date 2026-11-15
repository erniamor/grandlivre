import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { m } from "@/paraglide/messages";

/** Link from a tag's page back to the tree of tags. */
export function TagsBackLink() {
	return (
		<Link
			to="/tags"
			className="inline-flex items-center gap-1.5 justify-self-start rounded-sm text-muted-foreground text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
		>
			<ArrowLeftIcon aria-hidden className="size-4" />
			{m.tags_back_link()}
		</Link>
	);
}
