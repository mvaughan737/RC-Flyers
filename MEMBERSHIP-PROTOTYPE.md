# Current status

[MEMBERSHIP-FINAL-REVIEW.md](MEMBERSHIP-FINAL-REVIEW.md) supersedes provisional policy/procedure notes below. Current PDFs remain authorized; replacements are not launch prerequisites. Historical test/delivery records are preserved.

# Local membership prototype - November 3, 2026

This preparation authorizes no email. Sending remains disabled. No commit, push, deployment, DNS changes, or public submission endpoint is part of this work. The 57th Alumni configuration is not used or modified.

## Start and review

From this checkout:

```powershell
python -m pip install -r requirements-membership.txt
python -B scripts/preview.py --port 4174
```

Open http://127.0.0.1:4174/membership.html#online-application . Port 4173 may still serve an older preview; use 4174 for this prototype. The server binds only to 127.0.0.1. The online form is unavailable on ordinary static hosting; existing documents remain available there.

Use fictional details only, for example Fictional Pilot, TEST-123456, 123 Example Lane, Example Town, IN 46919, 202-555-0142, pilot@example.com. Applicant email must use example.com/org/net or a .example domain. Entering a fictional-data acknowledgment is required. No applicant confirmation mail is implemented.

Choose New Membership or Renewal and a category; the payment receipt date controls the estimate. Review the normalized server-validated answers, edit if necessary, download the PDF, and confirm that you checked it before saving. Changing answers requires a new review and download. Save persists privately and returns a reference; it never calls Resend. Reload clears browser form state. Sessions expire after one hour or server restart.

The original application is the unchanged first-page background. Answers use embedded Unicode text; entries that would require text below 8 points refer to a full answer on the attached review page. The attachment lists every answer, estimated dues and expiry, and payment/approval/signature caveats. Original historical wording in the supplied PDFs may conflict with the owner's updated rules; the review page and website use the confirmed rules. Signature lines remain blank; the instruction below directs an officer to verify AMA before the applicant signs the printed form at the meeting. No typed-signature field exists.

## Michael: paste the key locally

Open this exact local file in your editor:

`C:\Users\Admin\.gemini\antigravity\scratch\RC-Flyers\.env.membership.local`

Paste the **new converseflyingeagles.org domain-restricted Sending key** immediately after `RESEND_API_KEY=` on its existing line. Save the file. Leave `MEMBERSHIP_EMAIL_ENABLED=false`. Do not paste the key into chat, HTML, JavaScript, Git, a command argument, or any shared environment. This ignored file was created with a blank key and is blocked by the preview server. `.env.example` contains only placeholders. The delivery command reads only this project's dedicated file; it does not read global environment variables or any Alumni settings.

## Private storage and test mail

Submissions and PDF bytes are stored together in a SQLite transaction at:

`C:\Users\Admin\.gemini\antigravity\scratch\RC-Flyers-private\membership.sqlite3`

This sibling folder is outside the Netlify publish root. There is no public submission/PDF listing or retrieval URL. Download uses a same-origin POST tied to an HTTP-only SameSite session cookie and token. Responses have no-store headers. Hidden files, directory listings, output and temporary folders are blocked in local preview. Do not move the database or completed PDFs into the public checkout. Private means outside web serving and under the local Windows account's filesystem permissions; this prototype does not supply disk encryption, backups, or cloud storage.

The database stores normalized answers, the exact PDF, quote, digest, held/failed/sending/accepted state, attempt count, safe failure description, and provider ID. Identical normalized submissions are deduplicated durably, including across sessions and restarts. Changed applications intentionally create a new reference. Server validation rejects unexpected fields, oversized bodies, controls, invalid dates/categories, malformed phone/state/ZIP/email, missing acknowledgment and ineligible junior dates. Spam controls include local-only host/origin enforcement, cookie/token protection, a honeypot, a two-second minimum session age and per-minute request limits. These are suitable for local testing; public launch requires a separately reviewed production backend and abuse controls.

No automatic worker or send/retry HTTP route exists. Only the explicit delivery CLI can send, and it requires both the dedicated key and enabled flag. Sender is fixed to `membership@converseflyingeagles.org`; **the sole recipient is hardcoded server-side to `mvaughan737@gmail.com` (Michael)**, with no cc, bcc, applicant confirmation, or recipient override. No messages go to George, the Secretary, or applicant-entered addresses.

## Initial controlled test to Michael - do not send during preparation

1. Michael pastes the dedicated key locally as above, leaving sending disabled during review.
2. Review a fictional application and its downloaded PDF; save exactly one selected test. Use `python -B scripts/membership.py --list` to see references, statuses and attempt counts without dumping applicant data or credentials.
3. Preparation sends nothing. Michael can initiate the single selected test himself using the command below. Any agent-run send still requires a separate explicit instruction.
4. For that controlled test only, temporarily set `MEMBERSHIP_EMAIL_ENABLED=true` in the dedicated local file and run `python -B scripts/membership.py --send-test SELECTED_REFERENCE`. Return the flag to `false` immediately afterward. The web server never sends, regardless of this flag.
5. Verify Michael receives the expected PDF and check Resend's delivery record. `accepted` records API acceptance, not inbox delivery or membership approval. No bounce webhook is configured locally. The command attempts only the selected reference, never the whole queue. Re-running an accepted reference does not send again; do not create a second reference or retry an uncertain result without reconciling provider status.

Failed attempts retain the application/PDF and are marked `failed`; retry the same reference with the same command and payload. Persistent idempotency uses `membership-test/REFERENCE`, following [Resend's send API](https://resend.com/docs/api-reference/emails/send-email) and [idempotency guidance](https://resend.com/docs/dashboard/emails/idempotency-keys). Resend retains keys for 24 hours. This prototype blocks retry after 23 hours from the first attempt, and blocks a reference left `sending` after a crash, until an operator reconciles provider state. It does not blindly resend ambiguous deliveries. There is no live retry authorization yet.

## Rules and unresolved decisions

- Regular renewal: $100 through March 31; $120 April 1-September 30 including $20 late fee. Existing regular member payment after September 30: $100 covering the following year.
- New regular members: July-September $75, expiring December 31; October-December $100 covering the following year, with no added fee. The former $25 short-term option is eliminated. No new-member late fee. Field improvement fee eliminated.
- Spouse base $5; Junior base free. January-June new Regular dues are $100. All categories have a flat $20 renewal late fee after March 31; October-December Regular payments cover the following year for $100 with no added fee. New members have no renewal late fee.
- One category per application; no combined household total or additional discount inferred.
- Board rules on signing, monthly meetings, votes and immediate expulsion are confirmed in MEMBERSHIP-FINAL-REVIEW.md. Submission establishes no payment, approval or active membership.
- Before any public launch, decide production private storage, authentication/access for club staff, retention/backups, email delivery monitoring, public spam controls and production recipient policy. This local Python service is not a Netlify submission function.

## Verification

Run `npm test` for existing weather/preview checks and the membership tests. Email tests use fake keys and a stub transport, never Resend. Coverage includes dues/date boundaries, unresolved totals, junior-age validation, invalid/oversized values, honeypot/timing/session errors, review/download gating, revised PDFs, duplicate saves, original document bytes, private route blocking, origin/token checks, rate limits, disabled mail, fixed recipients, persisted failures and retry idempotency/window limits. `node --check js/membership.js` and `git diff --check` check syntax and patch whitespace.

The original four public PDFs and accepted weather JavaScript/function are unchanged. Sample and long-entry renders are reviewed outside the web root. Physical phone, screen-reader, and printer verification are not performed. Browser/layout verification results are recorded at final handoff; do not treat semantic markup alone as a full accessibility audit.

Completed checks: `npm test` passed all 3 Node weather tests and 12 Python tests; JavaScript syntax and diff whitespace checks passed. The live 4174 HTTP review/download/save flow returned a held record and deduplicated its repeat; no transport was invoked. The four PDF routes returned their original bytes and the weather route returned HTTP 200 JSON. All form controls have labels, all IDs are unique, and all four original new-tab PDF link contracts remain intact.

Edge visual checks covered desktop layout, a 400 x 505 responsive viewport (stacked category/date and applicant fields with no horizontal clipping), visible keyboard focus, tabbing from the application radio group to category, and Enter on an empty application producing the required-name validation prompt. The browser access host initially failed; native Computer Use recovered sufficiently for these checks. A full browser-driven completion/edit/save cycle and a complete screen-reader audit were not performed; the end-to-end HTTP flow and service tests cover review, edits, PDF download gating, persistence, and error handling. Both normal-long and maximum-length wide-character PDF renders were visually checked; all rendered long-entry text stays within page bounds. The sample PDFs remain outside the published root in `../RC-Flyers-private/review/`.

## Prepared initial test reference

Recipient: Michael only, `mvaughan737@gmail.com`. Sender: `membership@converseflyingeagles.org`.

Selected fictional application: `ce9839e5ca542e592eda29d36e86e3e8` (held, zero delivery attempts at preparation). The matching PDF is stored in the same database record and exported to `../RC-Flyers-private/review/michael-initial-test.pdf`. No applicant confirmation, CC, or BCC exists.

To initiate exactly one test yourself, temporarily change only `MEMBERSHIP_EMAIL_ENABLED=false` to `MEMBERSHIP_EMAIL_ENABLED=true` in `.env.membership.local`, then run from this checkout:

```powershell
python -B scripts/membership.py --send-test ce9839e5ca542e592eda29d36e86e3e8
```

Immediately restore `MEMBERSHIP_EMAIL_ENABLED=false`, whether the attempt succeeds or fails. This command makes at most one Resend request and attaches the stored PDF for that reference. The preparation leaves the flag false. Do not use another reference or retry an ambiguous result until provider state is reconciled.

## Accepted formatting update - November 4, 2026

Application/Category values display as New, Renewal, Regular, Spouse and Junior; internal values remain lowercase. Member-facing full dates use `Nov 14, 2026` (including birth dates and expiry), while stored date-only values remain ISO strings and native date inputs retain their browser appearance. Formatting never converts these dates through a timezone.

Phone and cell values accept spaces and punctuation with exactly 10 ASCII digits, normalize to `(333) 453-5923` on blur, and use that same format in review, PDF and prepared email text. Leading zeroes are retained; optional blanks remain blank. Country-code prefixes producing 11 digits and extensions are rejected rather than truncated. Inline errors and native field validation explain the 10-digit requirement. At least one phone/cell number is still required by the existing application rules. Review/Edit keeps entered answers, selections, dates and acknowledgments.

The held initial Michael test above has been refreshed with its matching formatted PDF; it still has zero delivery attempts. Only held, never-attempted content was refreshed. Sending remains disabled. Existing original document downloads and dues rules are unchanged.

Verification: 6 Node tests and 13 Python tests pass, including representative separators, leading zeroes, invalid/11-digit numbers, blank cell values, all category/application labels, leap-day and year-boundary dates across timezones, Review/Edit preservation, PDF text, prepared email text, and existing dues boundaries. Regular and junior PDF renders were visually checked for readable date/phone placement. Browser-specific native date input rendering remains unchanged.

## Failed test diagnosis - November 4, 2026

The selected reference `ce9839e5ca542e592eda29d36e86e3e8` has one failed attempt at 12:31:39 AM America/Indianapolis on November 4, 2026 (05:31:39 UTC). The original handler discarded its exception and HTTP response, retaining only a generic failure message. The original HTTP status, provider error, and connection/runtime error therefore cannot be recovered locally. A missing message ID does not establish that no email was accepted.

No send or retry was performed during diagnosis. Read-only GET checks to `/emails` using the original Python urllib user-agent reproduced HTTP 403 with Cloudflare error 1010, `Error 1010: Access denied`, and the detail `The site owner has blocked access based on your browser's signature.` An explicit `RC-Flyers-Membership/1.0` user-agent reached Resend's API and received HTTP 401, `restricted_api_key`, `This API key is restricted to only send emails`. This confirms that the dedicated key is loaded and Sending-only; it cannot list email logs. The reproduced user-agent block is the likely original cause, not recovered evidence of that original POST's response.

The sender is `membership@converseflyingeagles.org`, matching the owner-confirmed domain. Its verification and the key's exact domain binding cannot be reverified through this Sending-only key. No other key or configuration was accessed. The browser access host was unavailable, so dashboard reconciliation could not be completed.

Prepared local fixes: add the explicit application user-agent and JSON Accept header; persist redacted HTTP status, provider error fields, or connection/runtime details on any future authorized failure. Request headers and credentials are excluded. HTTP and runtime paths are tested with stub transports; no automatic retry is added. The historical failure record remains unchanged rather than being overwritten with results from diagnostic GET requests. Sending stays disabled.

Michael should open https://resend.com/emails in the correct Resend account/team and search for recipient `mvaughan737@gmail.com` around November 4, 2026 at 12:31 AM Indianapolis / 05:31 UTC. The subject is `FICTIONAL TEST - membership application ce9839e5ca542e592eda29d36e86e3e8`, sender `membership@converseflyingeagles.org`, attachment `membership-test.pdf`, and idempotency key `membership-test/ce9839e5ca542e592eda29d36e86e3e8`. If present, record its message ID and latest delivery event (sent/delivered/delayed/bounced). Also inspect API Logs for the original POST `/emails` and its response; an edge-blocked request may not appear in application logs. In Domains/API Keys, confirm the domain is verified and the existing membership Sending key is bound to `converseflyingeagles.org`, without exposing its value or granting broader access. Do not resend from the dashboard. Keep the test unresolved until provider-side reconciliation is complete.

## Accepted test and HTML notification preparation

The separately authorized single retry was accepted with HTTP 200, provider ID `01a1a510-7d41-7350-a7fd-806cd153b155`. The owner subsequently confirmed receipt and accepted its attached PDF. The accepted record and PDF bytes are preserved; no further send is authorized by the HTML preparation request. Sending remains disabled, with Michael's address still the sole server-side test recipient.

Local previews (fixed fictional details only; no stored submissions are exposed or modified):

- New application HTML: http://127.0.0.1:4174/membership-email-preview.html
- Renewal HTML: http://127.0.0.1:4174/membership-email-preview.html?type=renewal
- Plain-text alternative: http://127.0.0.1:4174/membership-email-preview.txt (append `?type=renewal` for renewal)

The HTML uses the website's navy `#000080`, a restrained gold accent, inline email styles, readable applicant details, and a mobile stacking table. Both alternatives use the accepted capitalization, date-only format and normalized phone numbers, identify fictional tests, and explain that submission does not confirm payment or approval. Applicant values are escaped with Python `html.escape(..., quote=True)` before HTML insertion. No external images, scripts, or applicant-derived links are included. Both alternatives are included in the same Resend payload; PDF attachment bytes remain unchanged.

Meeting selection was absent from the accepted form. A new `meetingDate` selector and review row are separate from expected payment receipt, persist through Review/Edit, and validate against the server's `data/membership-meetings.json` allowlist. Existing submissions without the field remain compatible. The original PDF format is unchanged.

The repository confirms only the first-Tuesday, 6 PM recurrence, with field/winter-hangar guidance; it supplies no individually confirmed club meeting dates or exceptions. Existing dated events are competitions/social events, not confirmed membership meetings. Therefore `confirmedDates` is intentionally empty and the selector says `Date not yet confirmed - arrange with club`. No recurring dates are extrapolated, and the payment receipt date is never used as a meeting date. The notification instead asks the club to arrange the meeting date/location. Once the owner provides confirmed ISO date-only entries, add them to `confirmedDates`; session setup populates their formatted labels, and server validation permits only those dates. Confirm any changed time or winter location separately.

Checks: 6 Node and 18 Python tests pass, including HTML escaping, both email alternatives/application types, optional birth date omission, separate meeting/payment dates, confirmed-date validation, preserved attachment bytes, disabled sending and Michael-only addressing. Live preview routes return HTTP 200. Edge desktop and 400-pixel responsive previews were visually checked for readable headings, stacked table details, phones, dates, and footer. Browser previews do not constitute testing in actual Outlook/Gmail/mobile email clients.

## George remote test preparation

Owner acceptance now includes Gmail HTML and its attached PDF. The next protected remote test is prepared in [preview-hosting/README.md](preview-hosting/README.md). It uses a separate container host with a private persistent disk and password-protected site/API, preserving the accepted Python implementation rather than assuming it runs unchanged on Netlify. The deployment packager hardcodes George as the sole recipient in its isolated server copy; existing local Michael records/configuration are preserved. Sending stays disabled, and no service, source upload, email or deployment has been performed. The hosting guide includes approval boundaries, blockers/costs, exact creation steps and George's short test script.
