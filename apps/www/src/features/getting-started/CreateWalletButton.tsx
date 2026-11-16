import type { Household } from "@repo/schemas";
import { Button, toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WalletIcon } from "lucide-react";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface CreateWalletButtonProps {
	household: Household;
}

/** Makes the user's wallet in one go: a cash account they hold, empty. */
export function CreateWalletButton({ household }: CreateWalletButtonProps) {
	const queryClient = useQueryClient();
	const create = useMutation({
		mutationFn: () =>
			getApi().accounts.create(household.id, {
				name: m.getting_started_wallet_name(),
				type: "cash",
				visibility: "details",
				openingBalance: 0,
			}),
		onSuccess: () => {
			toast.success(m.toast_wallet_created());
			queryClient.invalidateQueries({ queryKey: ["households", household.id] });
		},
		onError: (error) => toast.error(actionErrorMessage(error)),
	});

	return (
		<Button
			type="button"
			variant="outline"
			disabled={create.isPending}
			onClick={() => create.mutate()}
		>
			<WalletIcon aria-hidden />
			{m.getting_started_wallet_action()}
		</Button>
	);
}
