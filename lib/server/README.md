# Server Helpers

`lib/server/**` contains server-only infrastructure used by API routes and App Router layouts.

- `auth/`: session readers and cookie/session helpers.
- `audit/`: audit-log writes for sensitive actions.
- `db/`: pool, transactions, schema and migrations.
- `operation/`: server-only operational infrastructure such as evidence file storage.

Guidelines:

- Keep shared domain rules in `lib/auth/**` when they are not server-specific.
- Keep request/session wiring in `lib/server/auth/**`.
- Prefer small server helpers over repeating low-level request parsing in routes.
