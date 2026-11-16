import type { GettingStarted, Household } from "@repo/schemas";
import { Button, toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { gettingStartedQueryKey } from "@/features/getting-started/getting-started-query";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface ShowOnDashboardButtonProps {
	household: Household;
	hidden: boolean;
}

/** Puts the first steps away from the user's dashboard, or back on it. */
export function ShowOnDashboardButton({
	household,
	hidden,
}: ShowOnDashboardButtonProps) {
	const queryClient = useQueryClient();
	const update = useMutation({
		mutationFn: (next: boolean) =>
			getApi().households.updateGettingStarted(household.id, { hidden: next }),
		onSuccess: (status: GettingStarted) =>
			queryClient.setQueryData(gettingStartedQueryKey(household.id), status),
		onError: (error) => toast.error(actionErrorMessage(error)),
	});

	return (
		<Button
			type="button"
			variant="ghost"
			className="justify-self-start"
			disabled={update.isPending}
			onClick={() => update.mutate(!hidden)}
		>
			{hidden ? <EyeIcon aria-hidden /> : <EyeOffIcon aria-hidden />}
			{hidden
				? m.getting_started_show_on_dashboard()
				: m.getting_started_hide_from_dashboard()}
		</Button>
	);
}
