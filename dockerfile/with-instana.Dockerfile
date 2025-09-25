FROM ghcr.io/misskeyio/misskey:next

# NOTE: for Instana monitoring
RUN pnpm add @instana/collector
