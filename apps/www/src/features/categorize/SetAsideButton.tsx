import type { UncategorizedPayee } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useSetAside } from "@/features/categorize/use-set-aside";
import { m } from "@/paraglide/messages";

interface SetAsideButtonProps {
	householdId: string;
	group: UncategorizedPayee;
}

/**
 * Sets a payee's transactions without a tag aside as undetermined: they
 * can't be told for now. Not a tag: the payee's next ones are to
 * categorize as usual.
 */
export function SetAsideButton({ householdId, group }: SetAsideButtonProps) {
	const { setAside, pending } = useSetAside(householdId, (count) =>
		m.toast_set_aside({ count, payee: group.payee }),
	);

	return (
		<Button
			type="button"
			variant="ghost"
			aria-label={m.categorize_set_aside_label({ payee: group.payee })}
			disabled={pending}
			onClick={() =>
				setAside({ by: "payee", key: group.key, type: group.type })
			}
		>
			{m.categorize_set_aside()}
		</Button>
	);
}
