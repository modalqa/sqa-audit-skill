# Authorized Staging Testing

#### When to use this file

Use this file only when the user has named a staging or development environment in the current run and wants defects confirmed against it. Without that, this workflow is source-and-local only. These rules add to the execution safety rules in `SKILL.md`; they never relax them.

## Authorization gate (parent, before any request)

Do not send any request until all of these are recorded in `run-metadata.json`:

1. **Allowed origins** — the exact scheme, host, and port the user named (for example `https://staging.example.test`). No wildcards, no subdomains the user did not name, no IP literals unless the user gave one.
2. **Non-production confirmation** — the user's explicit statement that the environment is not production and holds no real customer data, and that they are authorized to test it. If the user has not said this, ask once. If they cannot confirm, do not use staging.
3. **Write permission** — `writes_allowed: false` by default. Set `true` only if the user says state-changing requests are allowed.
4. **Credentials** — the names of environment variables that hold test-account credentials. Never ask the user to paste a secret into the conversation, and never write a value to any file. If no test account is provided, test only unauthenticated behavior.
5. **Limits** — `request_limit` for the whole run (default 300) and a per-agent pace (default at most 1 request per second, no parallel requests to the same origin).

The parent passes only these facts to agents that need staging. Agents without a staging assignment never receive the origins.

## Rules for every staging request

```
- Send requests only to an allowed origin. Do not follow redirects to any other origin; record the redirect instead.
- Do not crawl, enumerate, brute-force, or discover hosts, paths, or parameters beyond the operations
  named in the assigned test conditions and the repository's own route definitions.
- Read-only by default: GET/HEAD/OPTIONS and read-only GraphQL queries. When writes are allowed, change
  only records this run created with an obvious test marker in their data, and list each one for cleanup.
  Never delete or modify pre-existing records.
- No load, stress, soak, or concurrency-flood testing. A performance observation is a single timed request.
- No security exploitation: no injection payloads, authentication bypass attempts, or access to other
  users' resources. If behavior looks security-relevant, stop and hand it to the security workflow as a lead.
- Stay within the request limit and pace. Stop on 429, 503, or any sign of service degradation.
- Stop immediately and report to the parent if responses contain what looks like real personal data,
  production identifiers, or a production banner. The run then continues source-and-local only.
- Read credentials from the named environment variables at request time. Never print, log, or store them,
  and never include them in a recorded command.
```

## Evidence recording

A staging check produces one promoted artifact per check under `agents/<agent-id>/artifacts/`, containing only:

- the operation (method and path template, with identifiers replaced by placeholders);
- request field names and non-sensitive test values the agent chose;
- response status, headers relevant to the condition (content type, cache, version), and the response **shape**: field names, types, and presence, with values redacted unless they are the decisive non-personal value (for example an amount or status enum);
- timestamps and the request count used.

Never store full response bodies, cookies, tokens, or personal data. The finding's `reproduction` uses method `staging`, names the environment as "authorized staging origin" (not the URL, if the user prefers it private), and links the artifact.

## Browser checks on staging

UI checks through a browser automation tool follow the same rules. Use a fresh browser profile, do not save storage state to retained artifacts, and capture screenshots only when they show no personal data. Prefer accessibility-tree snapshots over screenshots.

## When staging is unavailable or the gate fails

Keep the candidate as `needs_validation`. The validation plan names the exact staging observation an owner should make, so the owner can run it themselves.
