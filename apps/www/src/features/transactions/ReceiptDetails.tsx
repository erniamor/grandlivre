import type { Receipt } from "@repo/schemas";
import { Button } from "@repo/ui";
import { ReceiptTextIcon } from "lucide-react";
import { useId, useState } from "react";
import type { ReceiptPhotos } from "@/features/transactions/note-draft";
import { useObjectUrl } from "@/features/transactions/use-object-url";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ReceiptDetailsProps {
	receipt: Receipt;
	/** Its photo, as sent and as taken, while they are still in memory. */
	photos?: ReceiptPhotos;
	currency: string;
}

/**
 * What the assistant read on a receipt, next to its photo, to check the
 * draft against it: the items, the subtotal, the taxes and the total.
 */
export function ReceiptDetails({
	receipt,
	photos,
	currency,
}: ReceiptDetailsProps) {
	const titleId = useId();
	// The photo sent, which the assistant read; the original on request
	const [showOriginal, setShowOriginal] = useState(false);
	const photoUrl = useObjectUrl(showOriginal ? photos?.original : photos?.sent);
	const locale = getLocale();
	const money = (amount: number) => formatAmount(amount, currency, locale);

	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
		>
			<h2 id={titleId} className="flex items-center gap-2 font-medium">
				<ReceiptTextIcon aria-hidden className="size-4" />
				{receipt.merchant
					? m.receipt_title_from({ merchant: receipt.merchant })
					: m.receipt_title()}
			</h2>
			{photoUrl && (
				<img
					src={photoUrl}
					alt={
						showOriginal
							? m.receipt_photo_original_alt()
							: m.receipt_photo_sent_alt()
					}
					className="max-h-96 justify-self-center rounded-md border border-border object-contain"
				/>
			)}
			{photos && photos.original !== photos.sent && (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="justify-self-center"
					aria-pressed={showOriginal}
					onClick={() => setShowOriginal(!showOriginal)}
				>
					{showOriginal ? m.receipt_show_sent() : m.receipt_show_original()}
				</Button>
			)}
			{receipt.items.length > 0 && (
				<details className="text-sm">
					<summary className="cursor-pointer rounded-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
						{m.receipt_items_summary({ count: receipt.items.length })}
					</summary>
					<table className="mt-2 w-full">
						<caption className="sr-only">{m.receipt_items_caption()}</caption>
						<thead className="sr-only">
							<tr>
								<th scope="col">{m.receipt_item_name()}</th>
								<th scope="col">{m.receipt_item_amount()}</th>
							</tr>
						</thead>
						<tbody>
							{receipt.items.map((item, index) => (
								// Two items can have the same name and amount: their place tells them apart
								<tr key={index}>
									<td className="py-0.5 pr-2">{item.name}</td>
									<td className="py-0.5 text-right tabular-nums">
										{money(item.amount)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</details>
			)}
			<dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-sm">
				{receipt.subtotal !== null && (
					<>
						<dt className="text-muted-foreground">{m.receipt_subtotal()}</dt>
						<dd className="text-right tabular-nums">
							{money(receipt.subtotal)}
						</dd>
					</>
				)}
				{receipt.taxes.map((tax, index) => (
					// A div groups a name and its amount, which a list of descriptions allows
					<div key={index} className="contents">
						<dt className="text-muted-foreground">{tax.name}</dt>
						<dd className="text-right tabular-nums">{money(tax.amount)}</dd>
					</div>
				))}
				<dt className="font-medium">{m.receipt_total()}</dt>
				<dd className="text-right font-medium tabular-nums">
					{money(receipt.total)}
				</dd>
			</dl>
		</section>
	);
}
