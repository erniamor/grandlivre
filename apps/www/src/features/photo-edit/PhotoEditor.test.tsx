import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoEditor } from "@/features/photo-edit/PhotoEditor";
import { WHOLE } from "@/features/photo-edit/photo-geometry";

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
		<PhotoEditor
			photo={new Blob(["photo"])}
			size={{ width: 2000, height: 4000 }}
			sending={false}
			onSend={onSend}
			onCancel={onCancel}
		/>,
	);
	return { user: userEvent.setup(), onSend, onCancel };
}

const sent = (onSend: ReturnType<typeof vi.fn>) => onSend.mock.calls[0]?.[0];

describe("PhotoEditor", () => {
	it("sends the whole photo, untouched, unless told otherwise", async () => {
		const { user, onSend } = setUp();

		expect(
			screen.getByRole("img", { name: "The photo to prepare" }),
		).toHaveAttribute("src", "blob:photo");
		await user.click(screen.getByRole("button", { name: "Send the photo" }));

		expect(sent(onSend)).toEqual({ crop: WHOLE, masks: [] });
	});

	it("adds a mask in the middle, then moves and resizes it from the keyboard", async () => {
		const { user, onSend } = setUp();

		await user.click(screen.getByRole("button", { name: "Add a mask" }));
		screen.getByRole("button", { name: "Mask 1" }).focus();
		await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}");
		await user.keyboard("{Shift>}{ArrowRight}{ArrowDown}{/Shift}");
		await user.click(screen.getByRole("button", { name: "Send the photo" }));

		const [mask] = sent(onSend).masks;
		expect(mask.x).toBeCloseTo(0.22);
		expect(mask.y).toBeCloseTo(0.47);
		expect(mask.width).toBeCloseTo(0.61);
		expect(mask.height).toBeCloseTo(0.09);
	});

	it("drags a mask with a finger or a mouse", async () => {
		const { user, onSend } = setUp();
		await user.click(screen.getByRole("button", { name: "Add a mask" }));
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
		await user.click(screen.getByRole("button", { name: "Send the photo" }));

		const [moved] = sent(onSend).masks;
		// 20 px of 200 and 40 px of 400: a tenth of the photo each way
		expect(moved.x).toBeCloseTo(0.3);
		expect(moved.y).toBeCloseTo(0.56);
	});

	it("removes a mask, with its button or the Delete key", async () => {
		const { user, onSend } = setUp();
		await user.click(screen.getByRole("button", { name: "Add a mask" }));
		await user.click(screen.getByRole("button", { name: "Add a mask" }));

		await user.click(screen.getByRole("button", { name: "Remove mask 2" }));
		screen.getByRole("button", { name: "Mask 1" }).focus();
		await user.keyboard("{Delete}");
		await user.click(screen.getByRole("button", { name: "Send the photo" }));

		expect(sent(onSend).masks).toEqual([]);
	});

	it("narrows the frame, and drops a mask it leaves out", async () => {
		const { user, onSend } = setUp();
		// A mask in the middle of the photo
		await user.click(screen.getByRole("button", { name: "Add a mask" }));

		screen.getByRole("button", { name: "Frame" }).focus();
		// The frame's bottom edge up to 30 % of the photo, above the mask
		for (let step = 0; step < 70; step += 1) {
			await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
		}
		await user.click(screen.getByRole("button", { name: "Send the photo" }));

		const { crop, masks } = sent(onSend);
		expect(crop.height).toBeCloseTo(0.3);
		expect(masks).toEqual([]);
	});

	it("can be cancelled", async () => {
		const { user, onCancel } = setUp();

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("warns not to mask the total nor the items", () => {
		setUp();

		expect(
			screen.getByText(
				"Don't mask the total nor the items: the assistant couldn't read them anymore.",
			),
		).toBeVisible();
	});
});
