# The nightly backup of the production database (see backup.sh and
# docs/deployment.md, "Backups"). pg_dump must be as recent as the server:
# PostgreSQL 18, as Railway's database.
FROM postgres:18-alpine

# The tools of the system's own packages: aws-cli sends to R2 (S3's API),
# age encrypts
RUN apk add --no-cache aws-cli age

# R2 rejects the checksums newer versions of aws-cli add by default
ENV AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED \
	AWS_RESPONSE_CHECKSUM_VALIDATION=WHEN_REQUIRED \
	AWS_DEFAULT_REGION=auto

COPY backup.sh /usr/local/bin/backup
RUN chmod +x /usr/local/bin/backup

# Not a server: it runs, sends, and stops
USER postgres
ENTRYPOINT ["backup"]
