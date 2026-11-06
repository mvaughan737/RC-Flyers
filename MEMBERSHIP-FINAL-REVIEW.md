# Final membership review for Michael — November 6, 2026

**Membership work and final layout accepted by Michael; production deployment and held-only verification authorized.** This release keeps email and public application submission disabled. It exposes membership information/documents and a closed-applications notice, with a separately authenticated operator review path. Saved applications and delivery history are preserved.

## Before / after

Final page layout: main-menu Membership remains. Top actions are Apply / Renew Online (`/membership-production`, primary gold) then Membership Documents (existing anchor/four downloads). The actions use a desktop flex row and a phone column at 600px, native link keyboard order and the existing visible focus style. The requested online/PDF/separate-payment explanation is included. Both destinations and all downloads were checked locally; the public production application intentionally remains disabled until authorized runtime setup. Browser visual interaction was attempted but stopped because the computer-use tool could not confidently verify the browser URL; responsive/focus verification used the served markup and stylesheet, not a claimed browser screenshot sign-off.

Latest public-contact correction: Contact retains the Membership guidance and removes the Secretary email sentence/link. All 72 public build files were scanned, including PDF text, links and metadata, for the Secretary's Outlook and private application-recipient addresses; neither remains exposed. The Membership Information and Dues PDF contained the Outlook address, so its obsolete contact sentence was removed as part of this public-exposure correction. Its exact original is archived outside the public root in `../RC-Flyers-private/original-documents/`. Application, bylaws and field-rules PDF bytes remain unchanged. Private production recipient/Bcc/Reply-To and all policies remain unchanged. All 66 tests, build and local contact/PDF checks passed; sending/publication remain disabled. This narrow contact correction supersedes the earlier all-four-PDF byte-preservation statements below.

Final presentation update: the Membership questions section links to `contact.html#contact-form` without displaying the Secretary's address. Applicant-facing meeting dates use date-specific EST/EDT, while Indianapolis IANA timezone calculations remain internal. HTML/plain-text notifications retain concise print/AMA/signing instructions and applicant details/comments/attachment; the long policy paragraph is removed. Confirmed policies, dues, website notices and delivery routing are unchanged. Latest checks: 39 Node + 27 Python tests (66 total).

| Item | Before this final update | Final prepared behavior |
| --- | --- | --- |
| New Regular, January–June | Unresolved | $100 for current calendar year |
| New Regular, July–September | $75 for current year | Preserved |
| Regular, October–December | $100 for following year; online $25 option already removed | Preserved with no additional fee; membership year explicit |
| Regular renewal | $100 base; $20 late fee April–September | Preserved; October–December $100 buys following calendar year |
| Spouse/Junior renewals | Late-fee scope unresolved | Flat $20 after March 31: Spouse $25 total; Junior $20 total |
| Base/new-member dues | Spouse $5; Junior free; no field improvement fee | Preserved; new members have no renewal late fee |
| AMA/signing | Pending placeholders on signature lines | Officer verifies AMA, then applicant signs printed application at meeting; actual signature lines blank, instruction beneath applicant line |
| Meetings | Unconfirmed-date/arrange-with-club fallback | Next 12 actual first-Tuesday dates, 6:00 PM America/Indiana/Indianapolis; generated at session/review time; required for new members |
| Payment and meeting | Separate fields, provisional instructions | Separate fields retained; new-member cash/check payment at meeting; renewals retain meeting/mailed-check options |
| Approval | Board then membership vote; wording partly scoped to new members | Board vote followed by majority approval of members present at next club meeting; submission establishes no payment, approval or active membership |
| Junior voting | Paid Juniors vote; dues unchanged | Preserved |
| Grievance/ordinary expulsion | Member disputes only; next-meeting confirmation | Preserved |
| Immediate expulsion | Confirmation requirement unresolved | Board may expel immediately for safety violations or threats against another member without a subsequent membership confirmation vote; no incident details |
| Current documents | Replacements among readiness gaps | Four current PDFs authorized for continued use, even for months; visible download/review notice says online Board rules apply and explains obsolete printed $25 provision. Replacements are not a launch prerequisite |
| Review/email/generated values | Total and expiry, no explicit membership-year field | Applicable dues, fee, membership year and expiry shown; corrected category and late-fee checkmarks |

## Final dues matrix

Amounts use expected payment receipt, which is not evidence of payment.

| Application/category | January–March | April–June | July–September | October–December |
| --- | --- | --- | --- | --- |
| New Regular | $100, current year | $100, current year | $75, current year | $100, following year |
| Regular renewal | $100, current year | $120, current year | $120, current year | $100, following year; no added fee |
| New Spouse | $5, current year | $5, current year | $5, current year | $5, current year |
| Spouse renewal | $5, current year | $25, current year | $25, current year | $25, current year |
| New Junior | $0, current year | $0, current year | $0, current year | $0, current year |
| Junior renewal | $0, current year | $20, current year | $20, current year | $20, current year |

The explicit October–December Regular rule buys next year's membership with no additional fee; that payment is not treated as a late renewal for the ending year. Only Regular has the confirmed following-year rule. Spouse and Junior retain their established calendar-year treatment. No percentage calculation or field improvement fee exists.

## Local review links

Run `node scripts/production-local.mjs` if the server stops. Use fictional entries. Start a fresh session after a server restart.

- [Website and downloads](http://127.0.0.1:4182/membership.html)
- [Online application and Review/Edit](http://127.0.0.1:4182/membership-production)
- [New-member email HTML](http://127.0.0.1:4182/membership-email-preview.html)
- [Plain-text email](http://127.0.0.1:4182/membership-email-preview.txt)
- [Generated PDF](http://127.0.0.1:4182/membership-pdf-preview.pdf)
- [Late Spouse renewal email](http://127.0.0.1:4182/membership-email-preview.html?type=renewal&category=spouse&period=late)
- [Late Junior renewal PDF](http://127.0.0.1:4182/membership-pdf-preview.pdf?type=renewal&category=junior&period=late)
- [Weather](http://127.0.0.1:4182/weather_final.html)

Email/PDF preview routes use fixed fictional details, never read saved submissions and never send. Sample comments appear in email only. The late sample uses April 6, 2027 as expected payment date, independently of selected meeting.

## Verification and preserved behavior

- Suite: 38 Node + 27 Python tests (65 total), covering all dues periods/categories, JS/Python parity, Indianapolis meeting generation across year changes and winter/summer 6 PM cutoffs, generated totals/late-fee marks/blank signature lines, validation, formatting, Review/Edit, Back/Forward/reload, separate PDF tab/fallbacks, comments/2,000-character limit/escaping/PDF exclusion, storage, duplicates, failure tracking, routing, George protection and Weather.
- Normal production build runs with `CFE_PRODUCTION_PUBLIC_FORM=false`: public Membership remains downloads-only, private review form assets separate. Effective production runtime and email flags remain false.
- All four original PDFs match HEAD and served bytes. No printed provisions are masked or rewritten. Required generated overlays change amounts/category/late-fee marks and replace provisional signature text with confirmed instructions below the blank signature line. Existing font/layout and comments exclusion remain.
- Final loopback checks returned HTTP 200 for website, application/session, both email formats, generated PDF, late Spouse/Junior samples and Weather/METAR JSON. All four source and served PDFs matched HEAD byte-for-byte. Rendered generated first/review pages were visually inspected: readable fields, blank signature lines, instruction beneath, correct total/year, visible historical $25 provision and no comments. `npm run build`, JavaScript syntax and `git diff --check` passed.
- From: `Converse Flying Eagles Membership <membership@converseflyingeagles.org>`; To: Lori Southwick `jlsouth5963@gmail.com`; Bcc: `mvaughan737@gmail.com`; Reply-To: validated applicant email with safely quoted name. Pilot remains password protected and George-only. No live email test.
- Previous computer-use attempts were blocked by browser-host/URL-verification limits. No desktop/mobile browser visual approval is claimed here; automated lifecycle and PDF rendering checks are separate evidence. Michael should include browser review in PASS.

## Genuine unresolved contradictions

None remains in the supplied Board rules. Printed provisions intentionally differ from online policy and are covered by continued-use authorization and the visible notice. Replacement PDFs are not a blocker.

## Exact remaining launch steps

Current authorized release: production runtime may be enabled for operator review, with `CFE_PRODUCTION_PUBLIC_FORM=false`, `CFE_PRODUCTION_PUBLIC_SUBMISSIONS_ENABLED=false` and `CFE_PRODUCTION_EMAIL_ENABLED=false`. `/membership-production` explains that applications are not open; `/membership-production/operator` and all API calls require the independent operator credential. Operator review refuses to run if mail is enabled. George's credential, branch environment, store and recipient are unchanged. Only a password hash, independent session secret and the existing dedicated domain-restricted club Sending key are configured as production secrets; plaintext operator access stays outside Git/public output. A Sending-only Resend key cannot independently reveal its domain binding via the read-only API; existing owner-confirmed binding is retained. No message is used to test it.

The deployment checklist is authorized for execution now without further deployment approval. When this held-only release passes, final activation still requires explicit authorization to set `CFE_PRODUCTION_PUBLIC_SUBMISSIONS_ENABLED=true` and `CFE_PRODUCTION_EMAIL_ENABLED=true` and redeploy. Keep `CFE_PRODUCTION_PUBLIC_FORM=false` to preserve the accepted landing-page/button layout; the online form lives at its production route. Do not release historical held records. The earlier staged rollout instructions below describe the original plan; this operator-only release and separate public-submission switch supersede their runtime-disabled/public-form-enabled wording.

1. **Completed:** Michael accepted the membership work and approved the final page layout. Deployment and sending remain separately unauthorized. Confirm/set the exact production HTTPS origin during runtime setup below.
2. **Authorized production setup:** confirm the exact HTTPS origin; provision the independent 32+ character secret and production-only provider key through hosting secrets. Verify the existing outgoing sender/domain is ready for `membership@converseflyingeagles.org`. Preserve pilot settings. If DNS changes are actually required, obtain separate authorization.
3. **Authorized held-only deployment:** rerun tests; build the approved form with `CFE_PRODUCTION_PUBLIC_FORM=true`; enable `CFE_PRODUCTION_ENABLED=true` in the approved runtime while keeping `CFE_PRODUCTION_EMAIL_ENABLED=false`. Deploy only after explicit authorization. Smoke-test a fictional private save, matching PDF, dues/year/meeting, no email, and separate protected pilot on the exact HTTPS origin. Do not later bulk-send held review records.
4. **Explicit opening/send approval:** after deployment PASS, obtain authorization to enable `CFE_PRODUCTION_EMAIL_ENABLED=true` and open public applications. Obtain specific authorization for any inbox smoke test; verify Lori receipt, applicant Reply-To and Michael Bcc. Distinguish provider acceptance from delivery. No automatic retry or held-record drain.
5. **Monitor/rollback:** reconcile failed/uncertain sends against provider history before retries. To close service, disable sending and runtime, rebuild downloads-only with publication flag false, and deploy rollback only when authorized. Preserve private records, PDFs, provider IDs, attempts and production HMAC secret.

Official PDF replacements may be adopted later through the existing review procedure; they are not launch prerequisites.
