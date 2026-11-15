import { type ChartConfig, ChartContainer } from "@repo/ui/components/ui/chart";
import { render } from "@testing-library/react";
import { Bar, BarChart } from "recharts";
import { describe, expect, it } from "vitest";

const config = {
	amount: { label: "Expenses", color: "var(--primary)" },
} satisfies ChartConfig;

describe("ChartContainer", () => {
	it("gives each series of the config its color, as a CSS variable of the chart", () => {
		const { container } = render(
			<ChartContainer config={config}>
				<BarChart data={[{ month: "Nov", amount: 10 }]}>
					<Bar dataKey="amount" fill="var(--color-amount)" />
				</BarChart>
			</ChartContainer>,
		);

		const chart = container.querySelector("[data-chart]");
		expect(chart).not.toBeNull();
		expect(container.querySelector("style")?.textContent).toContain(
			"--color-amount: var(--primary);",
		);
	});
});
