#!/usr/bin/env bash
#
# setup-cloudflare.sh
#
# Documents all Cloudflare resources that need to be created for the Flexile platform.
# This script is meant to be run once during initial infrastructure setup.
#
# Prerequisites:
#   - wrangler CLI installed and authenticated (npx wrangler login)
#   - Cloudflare account with Workers Paid plan
#   - PostgreSQL database accessible from Cloudflare network
#
# Usage:
#   chmod +x scripts/setup-cloudflare.sh
#   ./scripts/setup-cloudflare.sh
#

set -euo pipefail

echo "=== Flexile Cloudflare Infrastructure Setup ==="
echo ""
echo "This script creates all required Cloudflare resources."
echo "Make sure you are logged in: npx wrangler login"
echo ""

# -----------------------------------------------
# 1. Hyperdrive (PostgreSQL Connection Pooling)
# -----------------------------------------------
echo "--- Creating Hyperdrive configuration ---"
# Replace DATABASE_CONNECTION_STRING with your actual PostgreSQL connection string
# Format: postgres://user:password@host:port/database
#
# npx wrangler hyperdrive create flexile-db \
#   --connection-string="postgres://user:password@host:5432/flexile_production"
#
# npx wrangler hyperdrive create flexile-db-staging \
#   --connection-string="postgres://user:password@host:5432/flexile_staging"
echo "SKIPPED: Update connection strings and uncomment commands above"

# -----------------------------------------------
# 2. R2 Buckets (Object Storage)
# -----------------------------------------------
echo ""
echo "--- Creating R2 buckets ---"
# Production buckets
# npx wrangler r2 bucket create flexile-private
# npx wrangler r2 bucket create flexile-public

# Staging buckets
# npx wrangler r2 bucket create flexile-private-staging
# npx wrangler r2 bucket create flexile-public-staging

# Development buckets
# npx wrangler r2 bucket create flexile-private-dev
# npx wrangler r2 bucket create flexile-public-dev
echo "SKIPPED: Uncomment commands above to create buckets"

# -----------------------------------------------
# 3. KV Namespaces (Key-Value Store)
# -----------------------------------------------
echo ""
echo "--- Creating KV namespaces ---"
# Production
# npx wrangler kv namespace create KV_CACHE
# npx wrangler kv namespace create KV_SESSIONS

# Staging
# npx wrangler kv namespace create KV_CACHE --env staging
# npx wrangler kv namespace create KV_SESSIONS --env staging

# Development (preview)
# npx wrangler kv namespace create KV_CACHE --preview
# npx wrangler kv namespace create KV_SESSIONS --preview
echo "SKIPPED: Uncomment commands above, then update wrangler.toml with returned IDs"

# -----------------------------------------------
# 4. Queues (Background Job Processing)
# -----------------------------------------------
echo ""
echo "--- Creating Queues ---"
# Production queues
# npx wrangler queues create flexile-jobs
# npx wrangler queues create flexile-emails
# npx wrangler queues create flexile-jobs-dlq
# npx wrangler queues create flexile-emails-dlq

# Staging queues
# npx wrangler queues create flexile-jobs-staging
# npx wrangler queues create flexile-emails-staging
# npx wrangler queues create flexile-jobs-dlq-staging
# npx wrangler queues create flexile-emails-dlq-staging

# Development queues
# npx wrangler queues create flexile-jobs-dev
# npx wrangler queues create flexile-emails-dev
# npx wrangler queues create flexile-jobs-dlq-dev
# npx wrangler queues create flexile-emails-dlq-dev
echo "SKIPPED: Uncomment commands above to create queues"

# -----------------------------------------------
# 5. Custom Domains and DNS
# -----------------------------------------------
echo ""
echo "--- Custom Domain Configuration ---"
# API domain: api.flexile.com
# Add a CNAME record pointing to flexile-api.workers.dev
# Or use Cloudflare custom domain routing (configured in wrangler.toml)
#
# Frontend: app.flexile.com (or flexile.com)
# Cloudflare Pages custom domain - configure in Pages dashboard
#
# DNS Records needed:
#   CNAME  api    -> flexile-api.<account>.workers.dev
#   CNAME  @      -> flexile-web.pages.dev (or configure in Pages)
echo "SKIPPED: Configure DNS records in Cloudflare dashboard"

# -----------------------------------------------
# 6. Secrets
# -----------------------------------------------
echo ""
echo "--- Setting Worker Secrets ---"
echo "Run the following commands to set secrets for production:"
echo ""
echo "  npx wrangler secret put DATABASE_URL --env production"
echo "  npx wrangler secret put CLERK_SECRET_KEY --env production"
echo "  npx wrangler secret put CLERK_PUBLISHABLE_KEY --env production"
echo "  npx wrangler secret put RESEND_API_KEY --env production"
echo "  npx wrangler secret put STRIPE_SECRET_KEY --env production"
echo "  npx wrangler secret put STRIPE_ENDPOINT_SECRET --env production"
echo "  npx wrangler secret put STRIPE_PUBLISHABLE_KEY --env production"
echo "  npx wrangler secret put QUICKBOOKS_CLIENT_ID --env production"
echo "  npx wrangler secret put QUICKBOOKS_CLIENT_SECRET --env production"
echo "  npx wrangler secret put QUICKBOOKS_REDIRECT_URL --env production"
echo "  npx wrangler secret put QUICKBOOKS_WEBHOOK_SECRET --env production"
echo "  npx wrangler secret put GH_CLIENT_ID --env production"
echo "  npx wrangler secret put GH_CLIENT_SECRET --env production"
echo "  npx wrangler secret put GH_WEBHOOK_SECRET --env production"
echo "  npx wrangler secret put ACTIVERECORD_DETERMINISTIC_DERIVED_KEY --env production"
echo "  npx wrangler secret put ACTIVERECORD_DERIVED_KEY --env production"
echo "  npx wrangler secret put DOCUSEAL_TOKEN --env production"
echo "  npx wrangler secret put DOCUSEAL_USER_EMAIL --env production"
echo "  npx wrangler secret put WISE_PROFILE_ID --env production"
echo "  npx wrangler secret put WISE_API_KEY --env production"
echo "  npx wrangler secret put SLACK_WEBHOOK_URL --env production"
echo "  npx wrangler secret put SLACK_WEBHOOK_CHANNEL --env production"
echo "  npx wrangler secret put SLACK_TOKEN --env production"
echo "  npx wrangler secret put SLACK_CHANNEL_ID --env production"
echo "  npx wrangler secret put GOOGLE_CLIENT_ID --env production"
echo "  npx wrangler secret put EQUITY_EXERCISE_DOCUSEAL_ID --env production"
echo ""

# -----------------------------------------------
# 7. Summary
# -----------------------------------------------
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Uncomment and run the resource creation commands above"
echo "  2. Update wrangler.toml with the IDs returned by KV/Hyperdrive creation"
echo "  3. Set all secrets using 'npx wrangler secret put'"
echo "  4. Configure custom domains in the Cloudflare dashboard"
echo "  5. Set up GitHub Actions secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID"
echo "  6. Deploy: cd apps/api && npx wrangler deploy --env production"
echo ""
