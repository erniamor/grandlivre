import { createFileRoute, Outlet } from "@tanstack/react-router";
import { HouseholdSettingsLayout } from "@/features/households/HouseholdSettingsLayout";

// The household's settings: its sections share the menu
export const Route = createFileRoute("/_authenticated/_household/household")({
	component: HouseholdSettingsRoute,
});

function HouseholdSettingsRoute() {
	return (
		<HouseholdSettingsLayout>
			<Outlet />
		</HouseholdSettingsLayout>
	);
}
