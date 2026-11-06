# Final status

[MEMBERSHIP-FINAL-REVIEW.md](MEMBERSHIP-FINAL-REVIEW.md) is the current review and launch authority. The implementation history below is retained for context; its provisional procedure wording is superseded.

# Membership production launch review


Prepared locally November 6, 2026. **Not launched. Sending is disabled.** No email, commit, push, deployment, DNS change, or incoming-mail forwarding was performed.


## Changes prepared


- `netlify/production/service.mjs` fixes From to **Converse Flying Eagles Membership <membership@converseflyingeagles.org>**, To to **Lori Southwick <jlsouth5963@gmail.com>**, Bcc to **Michael Vaughan <mvaughan737@gmail.com>**, and Reply-To to the validated, quoted applicant name and email. Applicants cannot supply routing fields. Lori's Reply targets the applicant; Michael receives the same body and attachment through Bcc. Applicant email is never From. Controls, malformed mailboxes, additional addresses, and header injection are rejected; HTML values are escaped.

- `netlify/functions/membership-production.mjs` uses the private **cfe-membership-production-v1** Blobs store. Pilot remains **cfe-membership-pilot-v1**, password protected, fictional-only, George-only, with its existing exact-reference send restriction. Production delivery rejects records without a production marker. Cookies, API paths, browser draft keys, secrets, and mail switches are separate.

- The shared service retains required fields, phone/date formatting, same-origin/CSRF checks, honeypot, body limit, minimum completion time, per-IP/session rate limits, one-hour sessions, conditional writes, HMAC duplicate IDs, Review/Edit, and checked-PDF gating. A save durably stores the reviewed data, HTML, plain text, and the exact PDF before optional delivery. Identical normalized submissions deduplicate; edited answers or comments constitute a different submission.

- `scripts/build-netlify.mjs` prepares a private production form with real applicant wording. The normal build still publishes the existing downloads-only membership page. Only the explicit future `CFE_PRODUCTION_PUBLIC_FORM=true` build switch publishes the production form at `membership.html`. The production function separately requires `CFE_PRODUCTION_ENABLED=true`.

- Optional **Comments for the Membership Secretary** is the last form entry, after the acknowledgment. Exact requested help text, multiline input, visible count, and a 2,000-character browser/server limit are included. Comments survive Review/Edit, Back/Forward, reload and reviewed-session recovery. They appear on review, and nonblank comments appear under **Applicant Comments** in both email formats, with safe HTML escaping and preserved line breaks. Private records retain them for delivery reconciliation/retry. Comments are excluded from PDF field lists, font checks, and every supplementary page; emoji in comments does not block PDF generation.

- Production keeps the accepted responsive notification design and original application PDF background, including long-answer review pages. Attachment is `membership-application.pdf`; its bytes match the applicant's reviewed PDF. Production removes fictional/pilot labels and retains pending signature/approval wording. The four original public downloads, Weather assets and navigation are preserved.

- The existing UI now reports held, provider-accepted, or follow-up-needed status accurately. Provider acceptance is not represented as verified inbox delivery.


## Local configuration and delivery safeguards


`.env.production.example` documents production-only settings. Ignored `.env.production.local` contains disabled switches, a fresh production secret, and empty origin/provider key. It is a local configuration reference; the Netlify function reads runtime environment variables, and does not automatically load this file. No pilot configuration was changed.


Current preparation:


```text

CFE_PRODUCTION_PUBLIC_FORM=false

CFE_PRODUCTION_ENABLED=false

CFE_PRODUCTION_EMAIL_ENABLED=false

CFE_PRODUCTION_ORIGIN=                      # exact eventual HTTPS origin, no trailing slash

CFE_PRODUCTION_SECRET=                      # private independent secret, at least 32 characters

CFE_PRODUCTION_RESEND_API_KEY=              # absent until authorized setup

```


`MEMBERSHIP_EMAIL_ENABLED` and `CFE_PILOT_*` belong to existing local/pilot workflows and do not enable production. Do not reuse pilot credentials, secrets, stores, or test records. The private production page is packaged outside `dist`; function assets and completed applications are not public downloads. There is no public listing, record lookup, retry or send API. `/membership-production/api/send` always rejects requests.


When later explicitly enabled, production submits invoke `sendProductionOnce` only after a successful new private save. Delivery claims the record atomically (`held` -> `sending`) before contacting the provider, with a production-specific idempotency key. Concurrent or duplicate submissions cannot send twice. Results persist as `accepted` or `failed`, including attempt count, timestamps, provider ID, HTTP status, redacted errors, and reconciliation-required state. A crash after claiming leaves `sending`; uncertain records are never automatically resent. Saving failure prevents delivery. A successful save is still available if notification fails.


For a failed or uncertain delivery, an authorized operator must inspect the private record and provider history first. Do not clear a `sending` claim or retry an ambiguous delivery. For a confirmed rejection/non-delivery, preserve the prior attempt and reconciliation evidence, retain the original data/comments/message/PDF, and authorize a controlled retry using a conditional storage update and `sendProductionOnce`. Review the provider's current idempotency window before any retry; this preparation intentionally supplies no public retry endpoint or automatic retry loop. Never reset an accepted record merely because inbox receipt is unverified.


## Latest Board-update verification

November 6: 35 Node and 27 Python tests pass (62 total). Four original PDFs match HEAD and served bytes. Normal public build remains downloads-only; loopback production rehearsal is held-only. See MEMBERSHIP-BOARD-UPDATE.md for the complete change table, remaining launch gaps, PDF visual inspection and browser-verification limitation. The earlier preparation checks below remain historical evidence.

## Checks


Run `npm test` for the full mocked/offline regression suite, including `tests/membership-production.test.mjs`.


Production tests cover fixed From/To/Bcc, quoted applicant Reply-To, injection and client routing rejection, nonblank/blank/multiline comments, HTML escaping, exact attachment, private storage, production/pilot separation, simultaneous-send protection, held-by-default behavior, mock successful delivery, provider/network errors and redaction, uncertain final writes, no resend, save-before-send, spam/CSRF validation, and comments excluded from all PDF pages. Browser lifecycle tests use the actual handler/PDF/store with a DOM contract harness; they are not a live browser or inbox test. Production PDF pages were rendered and visually inspected. Existing tests verify the four public PDF files byte-for-byte, Weather and navigation, and George-only pilot routing.


**Final verification:** all 34 Node tests and 26 Python tests passed (60 total); `git diff --check` passed. The normal `npm run build` was run locally with `CFE_PRODUCTION_PUBLIC_FORM=false`. No deployment occurred. Enabling flags inside isolated tests uses only mocked transports; no provider call was made.


## Current final review and launch steps

All earlier policy gaps are resolved by the final Board decisions. See [MEMBERSHIP-FINAL-REVIEW.md](MEMBERSHIP-FINAL-REVIEW.md) for the current dues matrix, signing/meeting/discipline rules, before/after table, review links and exact remaining launch steps. Current official PDFs are authorized for continued use; replacement PDFs are not a launch prerequisite. Earlier provisional signature and meeting wording in the preparation notes above is historical, not current policy.

## Rollback


1. Set `CFE_PRODUCTION_EMAIL_ENABLED=false` in the effective production runtime; apply the environment change/redeploy as required. This prevents new sends but cannot recall provider-accepted mail.

2. Set `CFE_PRODUCTION_ENABLED=false`. Set build-time `CFE_PRODUCTION_PUBLIC_FORM=false`, run `npm run build`, and deploy the reviewed downloads-only artifact, or restore the prior approved deployment with production runtime disabled.

3. Preserve production private records, comments, PDFs, provider IDs, errors, delivery claims and the production HMAC secret. Do not erase records, rotate the secret, or release held/uncertain claims as part of rollback. Reconcile in-flight attempts against provider history.

4. Verify the form/API is unavailable, all four documents remain downloadable, Weather/navigation still work, and the protected pilot still requires its existing password and routes only to George. Keep production sending disabled until a fresh launch approval.
