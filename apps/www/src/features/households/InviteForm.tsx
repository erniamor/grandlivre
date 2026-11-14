import type { HouseholdInvitation } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { FormAlert } from "@/components/FormAlert";
import { TextField } from "@/components/TextField";
import { getApi } from "@/lib/api";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface InviteFormProps {
	householdId: string;
	onInvited: (invitation: HouseholdInvitation) => void | Promise<void>;
}

/** Invites someone to the household by email. */
export function InviteForm({ householdId, onInvited }: InviteFormProps) {
	const invite = useMutation({
		mutationFn: (email: string) =>
			getApi().households.invitations.create(householdId, { email }),
		onSuccess: onInvited,
	});
	const errors = invite.error ? formErrors(invite.error) : { fields: {} };

	return (
		<form
			noValidate
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				const form = event.currentTarget;
				invite.mutate(String(new FormData(form).get("email") ?? ""), {
					onSuccess: () => form.reset(),
				});
			}}
		>
			<p className="text-muted-foreground text-sm">{m.invite_intro()}</p>
			<TextField
				label={m.email_label()}
				name="email"
				type="email"
				autoComplete="off"
				required
				error={errors.fields.email}
			/>
			<FormAlert message={errors.form} />
			<Button type="submit" disabled={invite.isPending}>
				{m.invite_button()}
			</Button>
		</form>
	);
}
