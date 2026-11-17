import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon, HouseIcon, MailIcon, PlusIcon } from "lucide-react";
import { headerButtonClass } from "@/components/header-styles";
import {
	currentHousehold,
	householdsQueryOptions,
} from "@/features/households/households-query";
import { receivedInvitationsQueryOptions } from "@/features/households/received-invitations-query";
import { roleLabels } from "@/features/households/role-options";
import { useSwitchHousehold } from "@/features/households/use-switch-household";
import { m } from "@/paraglide/messages";

interface HouseholdMenuProps {
	/** The household chosen on this device, if any (see currentHousehold). */
	preferredHousehold?: string;
}

/**
 * The household the app works on, in the header: the user's households to
 * switch to, the invitations they received, and the way to create or join
 * another one. Nothing for a user without a household yet.
 */
export function HouseholdMenu({ preferredHousehold }: HouseholdMenuProps) {
	const { data: households } = useQuery(householdsQueryOptions());
	const { data: invitations } = useQuery(receivedInvitationsQueryOptions());
	const switchHousehold = useSwitchHousehold();
	const household = households
		? currentHousehold(households, preferredHousehold)
		: null;
	if (!households || !household) {
		return null;
	}
	const invited = invitations?.items.length ?? 0;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={
						invited > 0
							? m.household_menu_label_invited({
									name: household.name,
									count: invited,
								})
							: m.household_menu_label({ name: household.name })
					}
					className={headerButtonClass}
				>
					<HouseIcon aria-hidden className="size-5" />
					<span className="max-w-40 truncate">{household.name}</span>
					{invited > 0 && (
						<span
							aria-hidden
							className="rounded-full bg-primary px-1.5 font-medium text-primary-foreground text-xs tabular-nums"
						>
							{invited}
						</span>
					)}
					<ChevronDownIcon aria-hidden className="size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-60">
				<DropdownMenuLabel>{m.household_menu_title()}</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={household.id}
					onValueChange={(householdId) => {
						if (householdId !== household.id) {
							void switchHousehold(householdId);
						}
					}}
				>
					{households.items.map((item) => (
						<DropdownMenuRadioItem key={item.id} value={item.id}>
							<span className="grid min-w-0">
								<span className="truncate">{item.name}</span>
								<span className="text-muted-foreground text-xs">
									{roleLabels[item.role]()}
								</span>
							</span>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				{invited > 0 && (
					<DropdownMenuItem asChild>
						<Link to="/setup">
							<MailIcon aria-hidden className="size-4" />
							{m.household_menu_invitations({ count: invited })}
						</Link>
					</DropdownMenuItem>
				)}
				<DropdownMenuItem asChild>
					<Link to="/setup">
						<PlusIcon aria-hidden className="size-4" />
						{m.household_menu_new()}
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
