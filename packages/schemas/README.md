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
| Common | `dateTimeSchema`, `emailSchema`, `paginationSchema` / `Pagination`, `amountSchema` (money in minor units), `localeSchema` / `Locale`, `paginatedSchema(item)` / `Paginated<T>`, `apiErrorBodySchema` / `ApiErrorBody` (the API's error responses), `validationIssueSchema` / `ValidationIssue` | `MAX_AMOUNT`, `LOCALES` |
| Sign-in | `sendMagicLinkSchema` / `SendMagicLink`, `sendSignInCodeSchema` / `SendSignInCode`, `signInWithCodeSchema` / `SignInWithCode` | `SIGN_IN_CODE_LENGTH` (6) |
| Profile | `profileSchema` / `Profile`, `updateProfileSchema` / `UpdateProfile`, `profileNameSchema` | `PROFILE_NAME_MAX_LENGTH` (60) |
| Accounts | `accountSchema` / `Account`, `createAccountSchema` / `CreateAccount`, `updateAccountSchema` / `UpdateAccount`, `accountHolderSchema` / `AccountHolder`, `accountsSummarySchema` / `AccountsSummary`, `accountNameSchema`, `accountTypeSchema` / `AccountType`, `accountVisibilitySchema` / `AccountVisibility`, `accountHolderIdsSchema` | `ACCOUNT_NAME_MAX_LENGTH` (60), `ACCOUNT_TYPES`, `ACCOUNT_DEBT_TYPES`, `ACCOUNT_VISIBILITIES`, `ACCOUNT_MAX_HOLDERS` (20) |
| Tags | `tagSchema` / `Tag`, `createTagSchema` / `CreateTag`, `updateTagSchema` / `UpdateTag`, `tagNamesSchema` / `TagNames`, `tagNameSchema`, `tagDisplayName(names, locale)` (the name in a language, or else in the first language that has one), `suggestedTagSchema` / `SuggestedTag`, `suggestedTagsSchema` / `SuggestedTags`, `addSuggestedTagsSchema` / `AddSuggestedTags` | `TAG_NAME_MAX_LENGTH` (40), `MAX_TAGS_PER_HOUSEHOLD` (500) |
| Households | `householdSchema` / `Household`, `createHouseholdSchema` / `CreateHousehold`, `updateHouseholdSchema` / `UpdateHousehold`, `householdMemberSchema` / `HouseholdMember`, `updateHouseholdMemberSchema` / `UpdateHouseholdMember`, `inviteHouseholdMemberSchema` / `InviteHouseholdMember`, `householdInvitationSchema` / `HouseholdInvitation`, `receivedInvitationSchema` / `ReceivedInvitation`, `householdNameSchema`, `householdCurrencySchema` / `HouseholdCurrency`, `householdRoleSchema` / `HouseholdRole` | `HOUSEHOLD_NAME_MAX_LENGTH` (60), `HOUSEHOLD_CURRENCIES`, `HOUSEHOLD_ROLES`, `HOUSEHOLD_INVITATION_EXPIRES_IN_DAYS` (7) |

In responses, dates are ISO 8601 strings. Amounts of money are integers in minor units of the household's currency (cents), never decimals.

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
| `tag_parent_invalid` | The parent isn't a tag of the household, or is the tag itself or one of its descendants |
| `household_name_required` | The household's name is empty or blank |
| `household_name_too_long` | The household's name is over `HOUSEHOLD_NAME_MAX_LENGTH` characters |
| `household_currency_invalid` | The currency isn't one of `HOUSEHOLD_CURRENCIES` |

Other failures (wrong type, unknown field) keep Zod's default English message: they come from a bug, not from user input.

## Scripts

`pnpm --filter @repo/schemas test`, `pnpm --filter @repo/schemas typecheck`.
