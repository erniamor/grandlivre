import { createFileRoute } from "@tanstack/react-router";
import { HouseholdGeneralSettings } from "@/features/households/HouseholdGeneralSettings";

export const Route = createFileRoute("/_authenticated/_household/household/")({
	component: HouseholdGeneralRoute,
});

function HouseholdGeneralRoute() {
	const { household } = Route.useRouteContext();

	return <HouseholdGeneralSettings household={household} />;
}
