# George protected preview deployment

**Superseded:** The owner requires the existing Netlify hosting and no Render service. Use [NETLIFY-MEMBERSHIP-PILOT.md](../NETLIFY-MEMBERSHIP-PILOT.md). The files below remain an archived local alternative and must not be deployed or purchased for this pilot.

Status: implementation and deployment package prepared locally. The owner accepted the local form, PDF and Gmail HTML email. No remote service, email, commit, push, deployment or DNS change is authorized by this preparation. Production Netlify and Alumni configuration remain unchanged.

## Hosting decision

Use a **separate Render Docker web service**, serving both the sanitized static site and the Python membership API behind HTTPS and HTTP Basic authentication. This is a protected remote prototype, not a Netlify Deploy Preview or a public membership launch. No Netlify changes are needed for this test.

The current `netlify.toml` publishes `.` with no build and runs existing Node functions. The local `scripts/preview.py` is a long-running loopback server with memory sessions and sibling SQLite storage; it is not a Netlify function. Uploading it to Netlify will not provide a running Python service or durable disk. An all-Netlify implementation would require a separately validated function/PDF port and private durable storage. Netlify functions use ephemeral runtimes: [Functions overview](https://docs.netlify.com/build/functions/overview/), [function setup](https://docs.netlify.com/build/functions/get-started/).

The prepared adapter uses Flask with Gunicorn (one worker, four threads), the accepted validation/dues/PDF/HTML code, and one private persistent disk. PDF answers use the existing DejaVu Sans fallback on Linux; the original application remains the first-page background. Linux rendering must be visually checked before George's test. Original document downloads and accepted weather JavaScript are copied unchanged; weather reads the same fixed public Netlify METAR endpoint without forwarding login credentials.

## What is protected

Every page, asset, original PDF, email preview and membership endpoint requires the preview username/password over HTTPS. The only anonymous endpoint is `/healthz`, returning `{"ok":true}` for hosting health checks. Responses are no-store/noindex; authentication, fixed-origin checks, secure HttpOnly SameSite cookies, CSRF tokens, a honeypot, timing limits and rate limits are enforced. Browser storage is not used for applicant answers. Usernames/passwords never appear in browser code.

The only files served are under the allowlisted `public/` directory. Server code, templates, secrets, databases, completed PDFs and directory listings are not served. Submissions/PDF bytes are stored transactionally in `/var/data/membership/membership.sqlite3`, outside `/app/public`. Identical applications deduplicate durably. The accepted local database and sent Michael applications are **not copied**. The packaged core recipient constant is changed to George only; the local accepted Michael configuration stays separate. Render disks are encrypted at rest and have snapshots; only files under the mount persist. [Render disks](https://render.com/docs/disks)

This is intentionally one instance/one worker for a short protected test, not a production membership system. Review sessions and rate counters are in memory; a restart requires re-review/download, while submitted records survive. Do not restart during George's test. Persistent disks prevent multi-instance scaling and cause brief redeploy downtime. Choose a retention/deletion date for these fictional test records and remove the preview service/disk when finished; snapshots also have a provider retention lifecycle. No real applicant data is authorized.

## Prepared files and checks

- `app.py`: password-protected remote web adapter; no send endpoint.
- `mail.py`: operator-only single-attempt sender, hardcoded to **mg.farris@comcast.net**; no CC/BCC, applicant confirmations or recipient environment override.
- `Dockerfile`, `entrypoint.sh`, `gunicorn.conf.py`: Linux server, font and private disk ownership setup.
- `render.yaml`: separate service template, persistent 1 GB disk, automatic deploys off, sending false; not applied.
- `prepare.py`: copies only approved source/public files and creates a SHA-256 package manifest; refuses nonempty output directories.
- `make_access.py`: Michael privately chooses a unique password; writes only its scrypt hash and blank key setting to an ignored local file.
- `smoke.py`: offline image/API/PDF check using fictional data; never sends.

Install local test dependencies with `python -m pip install -r requirements-membership.txt`; run `npm test`. The remote tests cover protected pages/documents/API, HTTPS/origin/cookie checks, validation/review/download/save, durable deduplication, private path blocking, oversized requests, failures, weather proxy, allowlisted packaging, and stubbed George-only mail/duplicate-attempt prevention. All mail tests use fake keys and transports. Actual Render TLS, forwarded headers, mounted disk permissions, Linux/Gunicorn behavior and inbox delivery need the deployment checks below.

## Exact creation steps after approval

1. **Approve the proposed hosting cost, separate source destination and preview scope.** Email approval remains separate. Do not connect Render to the production repository/branch, change the existing Netlify site, or attach a custom domain. Use a new private source repository containing only the generated package, never this checkout. Creating/uploading that source will require later commit/push authorization; none has occurred.
2. Complete the Linux check first. The current sanitized package is already prepared at `output/george-preview-final`. Earlier package directories are superseded; share only this final package. Start Docker Desktop's Linux engine and build that package:

   ```powershell
   docker build -t rc-flyers-george-preview output/george-preview-final
   docker run --name rc-flyers-george-smoke --entrypoint python rc-flyers-george-preview smoke.py
   docker cp rc-flyers-george-smoke:/tmp/preview-smoke.pdf ../RC-Flyers-private/review/george-linux-smoke.pdf
   ```

   Inspect both pages for date/phone placement and long-entry legibility. If source changes, first regenerate into a **new empty** directory, for example `python preview-hosting/prepare.py --output output/george-preview-next`, and use that new directory for all build/upload steps. The packager preserves existing output and refuses overwrites. The Docker engine was stopped during preparation, so image build, Gunicorn and Linux PDF rendering have not been verified. Do not treat passing Windows WSGI tests as this check.
3. Michael runs `python preview-hosting/make_access.py` in his own terminal. It prompts privately for a unique 20+ character password and creates ignored `.env.george-preview.local`. Do not put passwords, hashes or keys in chat, Git, Docker build arguments or the source package. Privately share only the sign-in credentials with George once the preview is approved.
4. After separate source-upload approval, place the generated package at the root of the new private repository and connect **that repository only** to a new Render Docker web service named `rc-flyers-george-preview`. In the creation form select the lowest paid service tier (approximately $7/month), one instance, Dockerfile `./Dockerfile`, health path `/healthz`, auto-deploy **Off**, and a **1 GB disk mounted at `/var/data`**. The included Blueprint describes these settings but applying it also creates a paid service; it is not an authorization to do so. The actual account must approve any charge. [Render deployment settings](https://render.com/docs/deploys)
5. Reserve/confirm its assigned `https://…onrender.com` URL. Set these service environment values **before allowing George access**, copying the hash privately from the ignored local file. Do not load any Alumni or production environment group:

   | Setting | Value |
   | --- | --- |
   | `RC_MEMBERSHIP_PREVIEW_ORIGIN` | Exact assigned HTTPS origin, no trailing slash |
   | `RC_MEMBERSHIP_PREVIEW_USER` | `george` |
   | `RC_MEMBERSHIP_PREVIEW_PASSWORD_HASH` | The locally generated scrypt hash |
   | `RC_MEMBERSHIP_DATA_DIR` | `/var/data/membership` |
   | `MEMBERSHIP_EMAIL_ENABLED` | `false` |
   | `RC_MEMBERSHIP_RESEND_API_KEY` | Leave unset during initial preview verification |

   Missing credentials/origin fail closed. If the URL is assigned only after initial creation, the first application start may fail closed until the exact origin is saved; `/healthz` must not be used to infer form readiness. Confirm the final environment then manually deploy. The domain remains Render's supplied hostname; no DNS change is required.
6. **Approve the now-concrete deployment, then deploy manually.** In a signed-out/private browser verify that the form, original PDFs, assets and API all challenge for a password; a wrong password is rejected. Authenticate and verify New/Renewal, native validation, Review/Edit, PDF download, private save, disabled email, original downloads and weather. Probe `/.env.membership.local`, `/scripts/membership.py`, `/membership.sqlite3` and guessed completed-PDF URLs: none may return private data. Confirm HTTPS, no-store, secure cookie and no-index headers. If any check fails, stop and fix before sharing.
7. Save one fictional application. Use the Render service's **live Shell** (not a one-off job, which cannot mount this disk) to run `python remote_mail.py --list`; it prints references/statuses, not applicant details. Restart the preview once before George's scheduled session and confirm that the saved record remains; then start a fresh browser session. This validates the actual mounted disk and isolates test restarts from George's session.
8. Share the exact URL and credentials privately with George, together with the 15–20 minute script below. Initially he can test and save without sending. Do not claim a remote URL exists until creation/deployment returns it; none exists yet.

## Email phase only after preview and scope approval

The web server never sends on submission, even if a send flag is accidentally set. All saves are held; there is no HTTP send/retry endpoint, webhook or background sender. The operator chooses a specific held, never-attempted test reference. The sender process hardcodes `mg.farris@comcast.net` only, from `membership@converseflyingeagles.org`, using the accepted HTML, plain text and exactly the stored PDF. Michael's prior local recipient/configuration remains separate.

Once one specific George email is separately authorized, Michael privately adds the **same domain-restricted Flying Eagles Sending key** as `RC_MEMBERSHIP_RESEND_API_KEY` to this dedicated Render service. It is never supplied to the frontend or package. Keep the service's `MEMBERSHIP_EMAIL_ENABLED=false`. In the live Render Shell, run exactly once:

```sh
MEMBERSHIP_EMAIL_ENABLED=true python remote_mail.py --send-once SELECTED_REFERENCE
```

This enables only that operator child process; the hosted web service remains disabled. The CLI resets its process flag in `finally`, sends at most one request, and refuses any previously attempted reference. Its stable idempotency key is `membership-test/REFERENCE` on this new, empty preview database. Acceptance/delivery failures and safe diagnostics remain private in SQLite; no automatic retry occurs. Record the provider message ID and reconcile delivery in Resend/George's inbox. Provider acceptance alone is not inbox delivery. Do not grant a broader key for log access. Do not run this command during preparation.

## George's 15–20 minute test

Michael supplies the preview URL and password privately. Use **fictional details only**: `Fictional George Pilot`, AMA `TEST123456`, `123 Example Lane`, `Example Town`, `IN`, `46919`, phone `333.453.5923`, email `pilot@example.com`. Never enter a real address, birthday or AMA identifier. Expected receipt and birth dates are test data; no payment is collected.

1. **0–3 minutes:** Sign in. Check the phone layout or narrow the browser. Choose **New Membership / Regular**. Leave the meeting as **Date not yet confirmed - arrange with club**. It is separate from expected payment receipt.
2. **3–7 minutes:** Try an empty required field, a 9-digit phone, and then `(333) 453-5923`. Check the clear error and automatic formatting when leaving the field. Enter a fictional email at `example.com`. Try an invalid email domain and confirm it is rejected. Restore valid fictional entries and check both review acknowledgments.
3. **7–11 minutes:** Review. Confirm New/Regular capitalization, `Nov 14, 2026` date style, normalized phones, unconfirmed meeting and appropriate dues. Choose Edit, change a detail, and verify the rest of the entries remain. Review again and download the new PDF.
4. **11–14 minutes:** Open the PDF, check long-name/address fit and the original application appearance. Confirm signatures await Board confirmation and payment/approval are separate. Confirm the PDF before saving. Note the private submission reference; saving initially sends nothing.
5. **14–17 minutes:** Reload for a separate **Renewal / Regular** test. Set expected payment receipt to March 31 ($100), April 1 ($120), then October 1 ($100 for the following year), reviewing as needed. Try Spouse/Junior only if time permits; unresolved late-fee totals must require Secretary confirmation rather than an invented amount.
6. **17–20 minutes:** If Michael has separately authorized/sent one selected held reference, check `mg.farris@comcast.net` (and Spam) for the fictional HTML email and matching PDF. Compare details, dates, phones, meeting wording, attachment, payment/approval footer and plain-text alternative where the email client supports viewing it. If no send has been approved, inspect the protected HTML/plain-text preview instead and mark actual inbox review **pending**. Send Michael a short PASS/FAIL list and the submission reference; do not send personal data or passwords.

## Decisions and blockers

- Owner approval of Render hosting cost, separate source/upload and deployment scope; a Render account/payment method and private source connection are not inspected or provisioned.
- Docker Linux engine must run; image build, startup, font rendering, actual disk persistence, HTTPS/proxy behavior and authentication require the checks above. No remote preview address exists yet.
- Confirm individual meeting dates/time/location exceptions; the selector deliberately has no invented dates. Signature/guardian consent/Board approval procedures remain unresolved; typed names are not approved signatures.
- January–June new regular-member dues and spouse/junior renewal late fees remain unresolved. Existing approved calculations are retained.
- Approve the exact number/reference(s) of emails separately. Sending remains disabled and no George email has been sent.
- Agree on preview shutdown and fictional-data retention. This single-server prototype does not constitute production storage/access/retention approval.

## Hosting cost estimate

As checked November 4, 2026, a small paid Render web service is approximately **$7/month**, plus **$0.25/month for 1 GB persistent disk**, approximately **$7.25/month** before tax, usage/egress, or account-plan charges. Render has usage-based/prorated billing, but a 20-minute test is not a promise of a particular invoice; verify the exact tier in the creation screen and remove the service/disk afterward. A free service's ephemeral disk is unsuitable for stored submissions. [Render pricing](https://render.com/pricing), [Render hosting costs](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses)

No extra Netlify hosting or password-protection plan is required by this separate-service approach. A few authorized test emails should fit existing Resend allowances if the account has available quota; current Free daily limit is 100. No plan change is needed or performed here. [Resend pricing](https://resend.com/pricing)
