.PHONY: install dev test lint typecheck build start

install:
	npm ci

dev:
	npm run dev

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck

build:
	npm run build

start:
	npm start
