import { buttonVariants } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { TagsIcon } from "lucide-react";
import { uncategorizedQueryOptions } from "@/features/categorize/uncategorized-query";
import { m } from "@/paraglide/messages";

interface SortByPayeeLinkProps {
	householdId: string;
}

/**
 * The way to sort by payee the user's transactions without a tag, with
 * how many payees are left; nothing once every one has a tag. Loaded apart:
 * the page doesn't wait for it.
 */
export function SortByPayeeLink({ householdId }: SortByPayeeLinkProps) {
	const { data } = useQuery(uncategorizedQueryOptions(householdId));
	if (!data || data.total === 0) {
		return null;
	}
	return (
		<Link to="/categorize" className={buttonVariants({ variant: "outline" })}>
			<TagsIcon aria-hidden />
			{m.transactions_categorize_link({ count: data.total })}
		</Link>
	);
}
