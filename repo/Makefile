.PHONY: up down dev test backend-test frontend-test fmt lint

up:
	docker compose -f infra/docker-compose.yml up --build

down:
	docker compose -f infra/docker-compose.yml down -v

dev:
	docker compose -f infra/docker-compose.yml up --build backend frontend

backend-test:
	docker compose -f infra/docker-compose.yml exec backend pytest -q || true

frontend-test:
	docker compose -f infra/docker-compose.yml exec frontend pnpm -C /app run build || true

fmt:
	@echo "Add formatters when dev deps are installed"

lint:
	@echo "Add linters when dev deps are installed"



