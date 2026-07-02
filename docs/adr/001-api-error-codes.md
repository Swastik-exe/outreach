# ADR 001: Machine-readable API error codes

## Status

Accepted (2026-07)

## Context

Clients relied on free-text `error` strings, which break when copy changes or i18n is added.

## Decision

- Add `errorCode` (string enum name) to every error response via `ApiResponse.error(message, ApiErrorCode)`.
- Clients should branch on `errorCode`, not `error` text.
- HTTP status codes remain the primary REST contract (401, 403, 404, 422, 429, 500).

## Consequences

- Frontend `ApiResponse` type includes optional `errorCode`.
- New domain errors must add an `ApiErrorCode` constant before use.
- OpenAPI/Swagger documents should list codes per endpoint (future work).
