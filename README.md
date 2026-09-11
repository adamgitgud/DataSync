# ZeroKey integration service

Acorn / Beacon → canonical `Client` → Cosper request. Local only, no DB/auth. Cosper is simulated (no outbound call).

Stack: TypeScript (strict), Hono, Valibot (Zod-equivalent per brief), Vitest.

## Run

Requires Node 20.19+.

```sh
npm install
npm run dev    # http://127.0.0.1:3000, set PORT to override
npm test
```

`requests.http` has the same calls for IDE clients. Docs: `/docs`, `/openapi.json`.

## API

```sh
curl http://127.0.0.1:3000/v1/providers

curl -X POST http://127.0.0.1:3000/v1/acorn/clients/normalise \
  -H 'content-type: application/json' \
  --data-binary @fixtures/acorn-client.json

curl -X POST http://127.0.0.1:3000/v1/beacon/clients/normalise \
  -H 'content-type: application/json' \
  --data-binary @fixtures/beacon-client.json

curl -s -X POST http://127.0.0.1:3000/v1/acorn/clients/normalise \
  -H 'content-type: application/json' \
  --data-binary @fixtures/acorn-client.json > /tmp/canonical.json

curl -X POST http://127.0.0.1:3000/v1/cosper/clients/build-request \
  -H 'content-type: application/json' \
  --data-binary @/tmp/canonical.json
```

Cosper returns `{ provider, request, response: { simulated: true, status: 'created' }, warnings }`.

Errors share `{ error: { code, message, issues? } }`: `404 PROVIDER_NOT_FOUND`, `400 OPERATION_NOT_SUPPORTED / INVALID_JSON`, `422 VALIDATION_ERROR`, `500 INTERNAL_ERROR`.

## Canonical model

Defined in `src/clients/schemas/canonical-client.schema.ts`, types inferred from the schema.

- `id` is the source record id, not cross-provider identity. Acorn/Beacon equivalence is compared on shared fields, not `id`.
- `full_name` from first/middle/last only, missing parts collapsed.
- Dates `YYYY-MM-DD` (validated), NI upper-case no spaces, empty → `null`, missing lists → `[]`.
- `marital_status` never null (defaults `unknown`); `nationality` free text, `addresses[].country` ISO alpha-2.

## Decisions

- Unknown sex → `null`, unknown marital status → `unknown`, never throws.
- `Living Together` → `cohabiting`; `Engaged` / `Intend to Marry` → `engaged`; `Civil Partnership` → `civil-partner`; `Non-Binary` → `other`.
- Cosper has no `engaged` code: `engaged` → `0` + `MARITAL_STATUS_UNREPRESENTABLE` warning.
- `legal_sex: null` → `Sex: 2` + `LEGAL_SEX_DEFAULTED` warning (`other`/`unspecified` → `2` without warning).
- Selection is primary-wins, source-order tie-break: first primary address else first; first primary email else first email; first primary mobile/telephone else first mobile else first telephone. `other` contacts never used for email/phone.
- Country: `GBR` → `GB`, names/aliases resolved via small lookup; unknown residence → `null`. `British` → `United Kingdom`.
- Phones stored compact (`+447700900123`), Cosper displays spaced (`+44 7700 900123`).

## Add a provider

1. Add `src/integrations/<name>/<name>.schema.ts` + `<name>.adapter.ts` (pure, validate-then-map).
2. Register in `createBuiltInRegistry()` in `src/integrations/provider.registry.ts`:

```ts
{ name: 'new-provider', operations: { normalise: { execute: adapter.normalise.bind(adapter) } } }
```

No route changes — `GET /v1/providers` and `POST /v1/:provider/clients/:operation` derive from the registry.

## Next

Wider country/phone coverage, second resource end-to-end, contract tests against real sandboxes.
