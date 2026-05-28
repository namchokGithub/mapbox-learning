.PHONY: dev api web install build tidy

dev:
	$(MAKE) -j2 api web

api:
	cd backend && go run ./cmd/server

web:
	cd frontend && pnpm dev

install:
	cd frontend && pnpm install

build:
	cd backend && go build -o bin/server ./cmd/server
	cd frontend && pnpm build

tidy:
	cd backend && go mod tidy
