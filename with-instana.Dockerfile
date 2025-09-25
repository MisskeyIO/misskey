ARG BASE_IMAGE=ghcr.io/misskeyio/misskey:main
FROM ${BASE_IMAGE}

# NOTE: for Instana monitoring
RUN pnpm add -w @instana/collector
