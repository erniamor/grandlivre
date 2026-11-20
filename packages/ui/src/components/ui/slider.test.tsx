import { Slider } from "@repo/ui/components/ui/slider";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

describe("Slider", () => {
	it("names each thumb and moves the one focused with the keyboard", async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		render(
			<Slider
				min={0}
				max={10}
				defaultValue={[2, 8]}
				thumbLabels={["Minimum", "Maximum"]}
				onValueChange={onValueChange}
			/>,
		);

		const minimum = screen.getByRole("slider", { name: "Minimum" });
		expect(minimum).toHaveAttribute("aria-valuenow", "2");
		expect(screen.getByRole("slider", { name: "Maximum" })).toHaveAttribute(
			"aria-valuenow",
			"8",
		);
		await user.tab();
		expect(minimum).toHaveFocus();
		await user.keyboard("{ArrowRight}");

		expect(onValueChange).toHaveBeenCalledWith([3, 8]);
	});

	it("reads out what each value stands for", () => {
		render(
			<Slider
				min={0}
				max={10}
				defaultValue={[2, 8]}
				thumbLabels={["Minimum", "Maximum"]}
				valueText={(value) => `$${value * 100}`}
			/>,
		);

		expect(screen.getByRole("slider", { name: "Minimum" })).toHaveAttribute(
			"aria-valuetext",
			"$200",
		);
	});
});
