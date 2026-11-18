#!/bin/sh
# Dumps the database, encrypts the dump for the restore key's owner only,
# and sends it to a private S3 bucket (Cloudflare R2). Run by Railway's cron,
# once a night; it stops when done, failing loudly when anything fails.
#
# DATABASE_URL           the database, on Railway's private network
# AGE_RECIPIENT          the public key the dump is encrypted for ("age1…");
#                        its private key stays with the owner, off Railway
# S3_ENDPOINT            https://<account id>.r2.cloudflarestorage.com
# S3_BUCKET              the bucket, one per application
# S3_PREFIX              the folder in the bucket (grandlivre by default)
# AWS_ACCESS_KEY_ID      an R2 token's key, limited to the bucket
# AWS_SECRET_ACCESS_KEY  its secret
set -eu
set -o pipefail

: "${DATABASE_URL:?DATABASE_URL is missing}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT is missing}"
: "${S3_ENDPOINT:?S3_ENDPOINT is missing}"
: "${S3_BUCKET:?S3_BUCKET is missing}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is missing}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is missing}"
prefix="${S3_PREFIX:-grandlivre}"

stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
name="${prefix}-${stamp}.dump.age"
file="$(mktemp -d)/${name}"
trap 'rm -rf "$(dirname "$file")"' EXIT

# The custom format: compressed, restored with pg_restore, table by table.
# Without owners and grants, so it restores into any database.
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" |
	age --encrypt --recipient "$AGE_RECIPIENT" --output "$file"

aws s3 cp "$file" "s3://${S3_BUCKET}/${prefix}/${name}" \
	--endpoint-url "$S3_ENDPOINT" --only-show-errors

echo "Backup sent: ${prefix}/${name} ($(wc -c < "$file" | tr -d ' ') bytes)"
