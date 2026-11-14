import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomePage } from "@/features/home/HomePage";

export const Route = createFileRoute("/")({
	// The home page presents the app to visitors; signed-in users go to their dashboard
	beforeLoad: ({ context }) => {
		if (context.me) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: HomePage,
});
