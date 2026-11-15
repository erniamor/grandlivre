# @repo/schemas

Zod schemas shared by the API and the front ends: what the API accepts (inputs) and returns (responses), with their TypeScript types. The API validates its inputs with them; the front ends validate the same inputs in their forms and type the API's responses.

## Usage

```ts
import { type UpdateProfile, updateProfileSchema } from "@repo/schemas";

const result = updateProfileSchema.safeParse({ name: formData.get("name") });
if (!result.success) {
	// result.error.issues[0].message is an error code, e.g. "name_required"
}
```

Add it to a project with `"@repo/schemas": "workspace:*"`. It is consumed as TypeScript source, with no build step.

## Contents

| Domain | Schemas and types | Constants |
| --- | --- | --- |
| Common | `dateTimeSchema`, `emailSchema`, `paginationSchema` / `Pagination`, `amountSchema` (money in minor units), `calendarDateSchema` (a day, `2026-11-14`), `localeSchema` / `Locale`, `paginatedSchema(item)` / `Paginated<T>`, `apiErrorBodySchema` / `ApiErrorBody` (the API's error responses), `validationIssueSchema` / `ValidationIssue` | `MAX_AMOUNT`, `LOCALES` |
| Sign-in | `sendMagicLinkSchema` / `SendMagicLink`, `sendSignInCodeSchema` / `SendSignInCode`, `signInWithCodeSchema` / `SignInWithCode` | `SIGN_IN_CODE_LENGTH` (6) |
| Profile | `profileSchema` / `Profile`, `updateProfileSchema` / `UpdateProfile`, `profileNameSchema` | `PROFILE_NAME_MAX_LENGTH` (60) |
| Accounts | `accountSchema` / `Account`, `createAccountSchema` / `CreateAccount`, `updateAccountSchema` / `UpdateAccount`, `accountHolderSchema` / `AccountHolder`, `accountsSummarySchema` / `AccountsSummary`, `accountNameSchema`, `accountTypeSchema` / `AccountType`, `accountVisibilitySchema` / `AccountVisibility`, `accountHolderIdsSchema` | `ACCOUNT_NAME_MAX_LENGTH` (60), `ACCOUNT_TYPES`, `ACCOUNT_DEBT_TYPES`, `ACCOUNT_VISIBILITIES`, `ACCOUNT_MAX_HOLDERS` (20) |
| Tags | `tagSchema` / `Tag`, `createTagSchema` / `CreateTag`, `updateTagSchema` / `UpdateTag`, `tagNamesSchema` / `TagNames`, `tagNameSchema`, `tagDisplayName(names, locale)` (the name in a language, or else in the first language that has one), `suggestedTagSchema` / `SuggestedTag`, `suggestedTagsSchema` / `SuggestedTags`, `addSuggestedTagsSchema` / `AddSuggestedTags` | `TAG_NAME_MAX_LENGTH` (40), `MAX_TAGS_PER_HOUSEHOLD` (500) |
| Transactions | `transactionSchema` / `Transaction`, `createTransactionSchema` / `CreateTransaction`, `updateTransactionSchema` / `UpdateTransaction` (the whole transaction, which replaces the previous one), `transactionLineSchema` / `TransactionLine`, `transactionLineInputSchema` / `TransactionLineInput`, `transactionAmountSchema`, `transactionTypeSchema` / `TransactionType`, `transactionOriginSchema` / `TransactionOrigin` | `TRANSACTION_TYPES`, `TRANSACTION_ORIGINS`, `TRANSACTION_MAX_LINES` (50), `TRANSACTION_PAYEE_MAX_LENGTH` (80), `TRANSACTION_NOTE_MAX_LENGTH` (500), `TRANSACTION_EXTERNAL_ID_MAX_LENGTH` (200) |
| Events | `householdEventSchema` / `HouseholdEvent` (`{ topic }`), `householdEventTopicSchema` / `HouseholdEventTopic` | `HOUSEHOLD_EVENT_TOPICS` |
| Reports | `tagReportSchema` / `TagReport`, `tagTotalSchema` / `TagTotal`, `monthlyReportSchema` / `MonthlyReport`, `monthTotalSchema` / `MonthTotal` | `REPORT_MAX_MONTHS` (60) |
| Drafts | `createDraftSchema` / `CreateDraft`, `transactionDraftSchema` / `TransactionDraft`, `draftLineSchema` / `DraftLine`, `proposedTagSchema` / `ProposedTag`, `similarTagReasonSchema` / `SimilarTagReason` | `DRAFT_TEXT_MAX_LENGTH` (500), `SIMILAR_TAG_REASONS` |
| Households | `householdSchema` / `Household`, `createHouseholdSchema` / `CreateHousehold`, `updateHouseholdSchema` / `UpdateHousehold`, `householdMemberSchema` / `HouseholdMember`, `updateHouseholdMemberSchema` / `UpdateHouseholdMember`, `inviteHouseholdMemberSchema` / `InviteHouseholdMember`, `householdInvitationSchema` / `HouseholdInvitation`, `receivedInvitationSchema` / `ReceivedInvitation`, `householdNameSchema`, `householdCurrencySchema` / `HouseholdCurrency`, `householdRoleSchema` / `HouseholdRole` | `HOUSEHOLD_NAME_MAX_LENGTH` (60), `HOUSEHOLD_CURRENCIES`, `HOUSEHOLD_ROLES`, `HOUSEHOLD_INVITATION_EXPIRES_IN_DAYS` (7) |

In responses, dates are ISO 8601 strings; the day of a transaction is a calendar day without time (`2026-11-14`). Amounts of money are integers in minor units of the household's currency (cents), never decimals.

## Error codes

Validation messages are codes, not sentences: the front ends translate them in every supported locale. The API returns the same codes in the `details` of its 422 errors.

| Code | Meaning |
| --- | --- |
| `email_invalid` | The email isn't a valid address (sign-in) |
| `code_invalid` | The sign-in code isn't `SIGN_IN_CODE_LENGTH` digits |
| `name_required` | The user's name is empty or blank |
| `name_too_long` | The user's name is over `PROFILE_NAME_MAX_LENGTH` characters |
| `amount_invalid` | The amount isn't an integer number of minor units |
| `amount_too_large` | The amount is beyond `MAX_AMOUNT` |
| `amount_not_positive` | The amount of a transaction or of a line is zero or negative |
| `date_invalid` | The date isn't a calendar day (`YYYY-MM-DD`) |
| `transaction_type_invalid` | The type isn't one of `TRANSACTION_TYPES` |
| `transaction_account_invalid` | An account of the transaction isn't an id |
| `transaction_tag_invalid` | The tag of a line isn't an id |
| `transaction_lines_required` | An expense or an income has no line |
| `transaction_lines_too_many` | More than `TRANSACTION_MAX_LINES` lines |
| `transaction_payee_too_long` | The payee is over `TRANSACTION_PAYEE_MAX_LENGTH` characters |
| `transaction_note_too_long` | The note is over `TRANSACTION_NOTE_MAX_LENGTH` characters |
| `transfer_same_account` | A transfer goes to the account it leaves |
| `report_period_invalid` | Answered by the API: the period ends before it starts |
| `report_period_too_long` | Answered by the API: a monthly report covers more than `REPORT_MAX_MONTHS` months |
| `draft_text_required` | The note to turn into a draft is empty |
| `draft_text_too_long` | The note is over `DRAFT_TEXT_MAX_LENGTH` characters |
| `draft_not_understood` | Answered by the API (422): the note couldn't be turned into a transaction |
| `assistant_unavailable` | Answered by the API (503): the assistant can't be reached; enter by hand |
| `receipt_photo_required` | Answered by the API (422, field `photo`): no photo was sent |
| `receipt_photo_invalid` | Answered by the API (422, field `photo`): the file isn't a JPEG, PNG, WebP or GIF image |

A draft also carries `warnings`, codes the front ends translate as well (`DRAFT_WARNINGS`): `receipt_total_mismatch`, the items and taxes read on a receipt don't add up to its total, so the lines follow the total and the member should check them.
| `account_name_required` | The account's name is empty or blank |
| `account_name_too_long` | The account's name is over `ACCOUNT_NAME_MAX_LENGTH` characters |
| `account_type_invalid` | The type isn't one of `ACCOUNT_TYPES` |
| `account_visibility_invalid` | The visibility isn't one of `ACCOUNT_VISIBILITIES` |
| `account_holders_required` | The account has no holder |
| `account_holders_invalid` | The holders aren't a list of distinct user ids, or are more than `ACCOUNT_MAX_HOLDERS` |
| `tag_name_required` | The tag has no name, or a blank one (on `names` or `names.<locale>`) |
| `tag_name_too_long` | A name of the tag is over `TAG_NAME_MAX_LENGTH` characters |
| `tag_name_taken` | Answered by the API: another tag under the same parent has this name in this language |
| `suggested_tags_required` | No suggested tag is chosen |
| `suggested_tags_invalid` | The suggested tags chosen aren't a list of known keys |
| `tag_in_use` | Answered by the API (409): the tag has transactions |
| `tag_parent_invalid` | The parent isn't a tag of the household, or is the tag itself or one of its descendants |
| `household_name_required` | The household's name is empty or blank |
| `household_name_too_long` | The household's name is over `HOUSEHOLD_NAME_MAX_LENGTH` characters |
| `household_currency_invalid` | The currency isn't one of `HOUSEHOLD_CURRENCIES` |

Other failures (wrong type, unknown field) keep Zod's default English message: they come from a bug, not from user input.

## Scripts

`pnpm --filter @repo/schemas test`, `pnpm --filter @repo/schemas typecheck`.
