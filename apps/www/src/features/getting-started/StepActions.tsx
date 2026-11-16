import type { Household } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { CreateWalletButton } from "@/features/getting-started/CreateWalletButton";
import type { Step } from "@/features/getting-started/getting-started-steps";
import { m } from "@/paraglide/messages";

interface StepActionsProps {
	step: Step;
	household: Household;
}

/** Where the pages a step opens bring the user back once done. */
const BACK = "/getting-started";

/** What a step leads to: the page that does it, which brings the user back. */
export function StepActions({ step, household }: StepActionsProps) {
	const style = buttonVariants({ variant: step.done ? "outline" : "default" });
	const outline = buttonVariants({ variant: "outline" });

	switch (step.key) {
		case "tags":
			return step.done ? (
				<Link to="/tags" className={outline}>
					{m.getting_started_tags_done_action()}
				</Link>
			) : (
				<Link
					to="/tags/suggested"
					search={{ redirect: BACK }}
					className={style}
				>
					{m.getting_started_tags_action()}
				</Link>
			);
		case "accounts":
			return (
				<>
					<Link to="/import" search={{ redirect: BACK }} className={style}>
						{m.getting_started_accounts_import()}
					</Link>
					<Link
						to="/accounts/new"
						search={{ redirect: BACK }}
						className={outline}
					>
						{m.getting_started_accounts_add()}
					</Link>
				</>
			);
		case "wallet":
			return step.done ? null : <CreateWalletButton household={household} />;
		case "members":
			return (
				<Link to="/household" className={style}>
					{m.getting_started_members_action()}
				</Link>
			);
		case "imported":
			return (
				<Link to="/import" search={{ redirect: BACK }} className={style}>
					{m.getting_started_imported_action()}
				</Link>
			);
		case "categorized":
			return (
				<Link to="/categorize" className={style}>
					{m.getting_started_categorized_action()}
				</Link>
			);
		case "recurring":
			return (
				<Link to="/recurring" className={style}>
					{m.getting_started_recurring_action()}
				</Link>
			);
		case "budgets":
			return (
				<Link to="/budgets" className={style}>
					{m.getting_started_budgets_action()}
				</Link>
			);
	}
}
