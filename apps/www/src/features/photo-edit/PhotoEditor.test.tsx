import { TooltipProvider } from "@repo/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoEditor } from "@/features/photo-edit/PhotoEditor";
import {
	newMask,
	rotateRect,
	WHOLE,
} from "@/features/photo-edit/photo-geometry";

beforeEach(() => {
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo");
	vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
});

function setUp() {
	const onSend = vi.fn();
	const onCancel = vi.fn();
	render(
		<TooltipProvider>
			<PhotoEditor
				photo={new Blob(["photo"])}
				size={{ width: 2000, height: 4000 }}
				sending={false}
				onSend={onSend}
				onCancel={onCancel}
			/>
		</TooltipProvider>,
	);
	const user = userEvent.setup();
	const click = (name: string) =>
		user.click(screen.getByRole("button", { name }));
	return { user, click, onSend, onCancel };
}

const sent = (onSend: ReturnType<typeof vi.fn>) => onSend.mock.calls[0]?.[0];

/** Shift and an arrow, `times` times: the rectangle focused resized. */
async function resize(
	user: ReturnType<typeof userEvent.setup>,
	arrow: string,
	times: number,
) {
	for (let step = 0; step < times; step += 1) {
		await user.keyboard(`{Shift>}{${arrow}}{/Shift}`);
	}
}

describe("PhotoEditor", () => {
	it("frames the photo first, then sends it whole, untouched, unless told otherwise", async () => {
		const { click, onSend } = setUp();

		expect(screen.getByText("Step 1 of 2: frame the receipt")).toBeVisible();
		expect(
			screen.getByRole("img", { name: "The photo to prepare" }),
		).toHaveAttribute("src", "blob:photo");
		expect(
			screen.queryByRole("button", { name: "Send the photo" }),
		).not.toBeInTheDocument();
		await click("Apply the frame");
		expect(
			screen.getByText("Step 2 of 2: mask what stays private"),
		).toHaveFocus();
		await click("Send the photo");

		expect(sent(onSend)).toEqual({ turns: 0, crop: WHOLE, masks: [] });
	});

	it("adds a mask in the middle, then moves and resizes it from the keyboard", async () => {
		const { user, click, onSend } = setUp();
		await click("Apply the frame");

		await click("Add a mask");
		screen.getByRole("button", { name: "Mask 1" }).focus();
		await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}");
		await user.keyboard("{Shift>}{ArrowRight}{ArrowDown}{/Shift}");
		await click("Send the photo");

		const [mask] = sent(onSend).masks;
		expect(mask.x).toBeCloseTo(0.22);
		expect(mask.y).toBeCloseTo(0.47);
		expect(mask.width).toBeCloseTo(0.61);
		expect(mask.height).toBeCloseTo(0.09);
	});

	it("drags a mask with a finger or a mouse", async () => {
		const { click, onSend } = setUp();
		await click("Apply the frame");
		await click("Add a mask");
		// The photo is drawn 200 × 400 pixels on screen
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 200,
			height: 400,
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 200,
			bottom: 400,
			toJSON: () => ({}),
		});
		const mask = screen.getByRole("button", { name: "Mask 1" });

		fireEvent.pointerDown(mask, { clientX: 100, clientY: 200, pointerId: 1 });
		fireEvent.pointerMove(mask, { clientX: 120, clientY: 240, pointerId: 1 });
		fireEvent.pointerUp(mask, { pointerId: 1 });
		await click("Send the photo");

		const [moved] = sent(onSend).masks;
		// 20 px of 200 and 40 px of 400: a tenth of the photo each way
		expect(moved.x).toBeCloseTo(0.3);
		expect(moved.y).toBeCloseTo(0.56);
	});

	it("removes a mask, with its button or the Delete key", async () => {
		const { user, click, onSend } = setUp();
		await click("Apply the frame");
		await click("Add a mask");
		await click("Add a mask");

		await click("Remove mask 2");
		screen.getByRole("button", { name: "Mask 1" }).focus();
		await user.keyboard("{Delete}");
		await click("Send the photo");

		expect(sent(onSend).masks).toEqual([]);
	});

	it("places the masks on the frame alone, enlarged", async () => {
		const { user, click, onSend } = setUp();
		screen.getByRole("button", { name: "Frame" }).focus();
		// The frame's bottom edge up to 30 % of the photo
		await resize(user, "ArrowUp", 70);
		await click("Apply the frame");

		await click("Add a mask");
		screen.getByRole("button", { name: "Mask 1" }).focus();
		// A step down on the frame shown: a smaller one on the photo
		await user.keyboard("{ArrowDown}");
		await click("Send the photo");

		const { crop, masks } = sent(onSend);
		expect(crop.height).toBeCloseTo(0.3);
		// In the middle of the frame, a hundredth of it lower
		expect(masks[0].y).toBeCloseTo(0.13 + 0.003);
	});

	it("goes back to the frame, and drops a mask it leaves out", async () => {
		const { user, click, onSend } = setUp();
		await click("Apply the frame");
		// A mask in the middle of the photo
		await click("Add a mask");

		await click("Change the frame");
		screen.getByRole("button", { name: "Frame" }).focus();
		// The frame's bottom edge up to 30 % of the photo, above the mask
		await resize(user, "ArrowUp", 70);
		await click("Apply the frame");
		await click("Send the photo");

		const { crop, masks } = sent(onSend);
		expect(crop.height).toBeCloseTo(0.3);
		expect(masks).toEqual([]);
	});

	it("turns the photo, its frame and its masks with it", async () => {
		const { click, onSend } = setUp();
		await click("Apply the frame");
		await click("Add a mask");
		await click("Change the frame");

		await click("Turn right");
		await click("Turn right");
		await click("Turn left");
		await click("Apply the frame");
		await click("Send the photo");

		const turned = rotateRect(newMask(WHOLE), 1);
		expect(sent(onSend)).toEqual({
			turns: 1,
			crop: WHOLE,
			masks: [
				{
					x: expect.closeTo(turned.x),
					y: expect.closeTo(turned.y),
					width: expect.closeTo(turned.width),
					height: expect.closeTo(turned.height),
				},
			],
		});
	});

	it("turns anticlockwise from the photo as it is", async () => {
		const { click, onSend } = setUp();

		await click("Turn left");
		await click("Apply the frame");
		await click("Send the photo");

		expect(sent(onSend).turns).toBe(3);
	});

	it("zooms in and out, and back to the whole photo", async () => {
		const { click } = setUp();
		const level = () => screen.getByRole("status");

		expect(level()).toHaveTextContent("100%");
		expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Fit" })).toBeDisabled();
		await click("Zoom in");
		await click("Zoom in");
		expect(level()).toHaveTextContent("200%");
		await click("Zoom out");
		expect(level()).toHaveTextContent("150%");
		await click("Fit");
		expect(level()).toHaveTextContent("100%");
		for (let step = 0; step < 4; step += 1) {
			await click("Zoom in");
		}
		expect(level()).toHaveTextContent("400%");
		expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
		// Each step starts from the photo whole
		await click("Apply the frame");
		expect(level()).toHaveTextContent("100%");
	});

	it("can be cancelled, at either step", async () => {
		const { click, onCancel } = setUp();

		await click("Cancel");
		await click("Apply the frame");
		await click("Cancel");

		expect(onCancel).toHaveBeenCalledTimes(2);
	});

	it("warns not to mask the total nor the items", async () => {
		const { click } = setUp();
		await click("Apply the frame");

		expect(
			screen.getByText(
				"Don't mask the total nor the items: the assistant couldn't read them anymore.",
			),
		).toBeVisible();
	});
});
