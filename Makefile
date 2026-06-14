.PHONY: .setup

COMPOSE_PROJECT_NAME ?= flexile
DOCKER_COMPOSE_CMD ?= docker compose
LOCAL_DETACHED ?= true
LOCAL_DOCKER_COMPOSE_CONFIG = $(if $(and $(filter Linux,$(shell uname -s)),$(shell test ! -e /proc/sys/fs/binfmt_misc/WSLInterop && echo true)),docker-compose-local-linux.yml,docker-compose-local.yml)

local: .setup
	node docker/createCertificate.js
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) up $(if $(filter true,$(LOCAL_DETACHED)),-d)

stop_local:
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) down

.setup:
	mkdir -p docker/tmp/postgres
	mkdir -p docker/tmp/redis

.PHONY: ghpr
ghpr:
	@./scripts/create_pr.sh || true

# -----------------------------------------------
# Cloudflare Workers / Pages Development Targets
# -----------------------------------------------

.PHONY: dev-api dev-web deploy-api deploy-web dev-services stop-dev-services

# Start the API worker in local development mode
dev-api:
	cd apps/api && npx wrangler dev

# Start the web frontend in local development mode
dev-web:
	cd apps/web && pnpm dev

# Deploy the API worker to production
deploy-api:
	cd apps/api && npx wrangler deploy --env production

# Deploy the web frontend to Cloudflare Pages
deploy-web:
	cd apps/web && pnpm build && npx wrangler pages deploy .vercel/output/static --project-name=flexile-web

# Start local development services (PostgreSQL + MinIO)
dev-services:
	$(DOCKER_COMPOSE_CMD) -f docker-compose.yml up $(if $(filter true,$(LOCAL_DETACHED)),-d)

# Stop local development services
stop-dev-services:
	$(DOCKER_COMPOSE_CMD) -f docker-compose.yml down
