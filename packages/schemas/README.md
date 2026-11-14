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
| Common | `dateTimeSchema`, `emailSchema`, `paginationSchema` / `Pagination`, `paginatedSchema(item)` / `Paginated<T>`, `apiErrorBodySchema` / `ApiErrorBody` (the API's error responses), `validationIssueSchema` / `ValidationIssue` | |
| Sign-in | `sendMagicLinkSchema` / `SendMagicLink`, `sendSignInCodeSchema` / `SendSignInCode`, `signInWithCodeSchema` / `SignInWithCode` | `SIGN_IN_CODE_LENGTH` (6) |
| Profile | `profileSchema` / `Profile`, `updateProfileSchema` / `UpdateProfile`, `profileNameSchema` | `PROFILE_NAME_MAX_LENGTH` (60) |

In responses, dates are ISO 8601 strings.

## Error codes

Validation messages are codes, not sentences: the front ends translate them in every supported locale. The API returns the same codes in the `details` of its 422 errors.

| Code | Meaning |
| --- | --- |
| `email_invalid` | The email isn't a valid address (sign-in) |
| `code_invalid` | The sign-in code isn't `SIGN_IN_CODE_LENGTH` digits |
| `name_required` | The user's name is empty or blank |
| `name_too_long` | The user's name is over `PROFILE_NAME_MAX_LENGTH` characters |

Other failures (wrong type, unknown field) keep Zod's default English message: they come from a bug, not from user input.

## Scripts

`pnpm --filter @repo/schemas test`, `pnpm --filter @repo/schemas typecheck`.
