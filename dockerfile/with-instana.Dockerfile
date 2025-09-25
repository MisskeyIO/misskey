FROM ghcr.io/misskeyio/misskey:next

# NOTE: for Instana monitoring
RUN pnpm add -w @instana/collector
