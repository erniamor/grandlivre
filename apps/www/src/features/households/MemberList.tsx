import type { Household, HouseholdMember } from "@repo/schemas";
import { useId } from "react";
import { MemberItem } from "@/features/households/MemberItem";
import { m } from "@/paraglide/messages";

interface MemberListProps {
	household: Household;
	members: HouseholdMember[];
	/** Identifier of the signed-in user. */
	meId: string;
	onChanged: (change: { self: boolean; left: boolean }) => void | Promise<void>;
}

/** The members of the household. */
export function MemberList({
	household,
	members,
	meId,
	onChanged,
}: MemberListProps) {
	const titleId = useId();

	return (
		<section aria-labelledby={titleId} className="grid gap-3">
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.members_title()}
			</h2>
			<ul className="grid gap-3">
				{members.map((member) => (
					<MemberItem
						key={member.userId}
						household={household}
						member={member}
						isMe={member.userId === meId}
						onChanged={onChanged}
					/>
				))}
			</ul>
		</section>
	);
}
