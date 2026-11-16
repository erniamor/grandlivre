import { monthSchema } from "@repo/schemas";
import { z } from "zod";

export const budgetsQuerySchema = z.object({
	/** The month to show; the household's current month when missing. */
	month: monthSchema.optional(),
});

export type BudgetsQuery = z.infer<typeof budgetsQuerySchema>;

export const budgetParamSchema = z.object({ tagId: z.uuid() });

export const stopBudgetQuerySchema = z.object({
	/** The first month without the budget. */
	from: monthSchema,
});
