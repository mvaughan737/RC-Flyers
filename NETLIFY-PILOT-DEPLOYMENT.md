# Hosted membership pilot

## November 5 owner feedback and live-email requirement

Michael reports George's email test **PASS**. This is owner-reported inbox confirmation; earlier no-email statements below describe the original deployment and verification stage.

For the future live form and email rollout, include Michael at **`mvaughan737@gmail.com` as Bcc on each membership notification email** so he can monitor operation. Keep the Bcc address in server-side mail configuration. Before launch, verify the outgoing message includes the intended primary recipient, Michael's Bcc, and the matching PDF, then confirm receipt in both inboxes. A Bcc copy confirms Michael's receipt; it does not by itself confirm the primary recipient received the message.

This records the requested launch requirement; Bcc is not implemented in the current pilot, and this note does not enable sending or publish the live form.

Deployed November 4, 2026 under the owner's explicit draft-deployment authorization. No email, production publish, Git commit/push, DNS change, plan upgrade or recharge change was performed.

**Working pilot:** https://membership-pilot-review--converse-flying-eagles.netlify.app/membership-pilot

**November 5 navigation update:** the current draft deploy is `6aec170e77af41b52da96159`, replacing the earlier deploy recorded below. Hosted credentials are unchanged, sending remains disabled, and production remains `6ae96fee331f16e421aa78b6`. All 51 tests and Node 22 offline function bundling passed. Hosted authentication, real-HTTPS lifecycle integration, independent private Blobs reads, duplicate protection and production asset hashes passed. Interactive browser control remains unavailable. See [MEMBERSHIP-NAVIGATION-FIX.md](MEMBERSHIP-NAVIGATION-FIX.md) for the scope and explicit verification limits. No email, commit/push or DNS change occurred.

Username: **george**. The password is a newly generated 192-bit random value, distinct from the public local example. It is not included in this document, source, deployment ZIP or logs.

## Michael: retrieve and share the password

1. In VS Code, open the ignored local file `C:\Users\Admin\.gemini\antigravity\scratch\RC-Flyers\.env.netlify-pilot.local`.
2. Find `CFE_PILOT_PASSWORD=`. Copy only the value after the equals sign.
3. Share the pilot link, username `george`, and that password with George through your agreed private channel. Do not send the environment file, which also contains server secrets, or paste its contents into chat.
4. George should open the HTTPS link in a private browser window, enter the credentials at the browser prompt, and use fictional applicant information. Close that window when finished. No browser extension or local server is needed.

The private file is Git-ignored and its Windows ACL is restricted to the current Windows user. `.env.membership.local` and its dedicated domain-restricted key remain unchanged. Both local configuration files keep `MEMBERSHIP_EMAIL_ENABLED=false`.

## Deployment and account evidence

- Existing project: `converse-flying-eagles`, ID `2bb3a05b-c2dc-443b-8039-90dddd6b6c8b`.
- Working non-production draft alias deploy: **`6aeadd77cfe861cdb345e924`**. Netlify labels an aliased manual draft with context **`branch-deploy`**, branch `membership-pilot-review`; it is not the production deploy.
- Production stayed on **`6ae96fee331f16e421aa78b6`**, commit `d3945d23fc299431651abf9d33387db446be3a36`. Published deploy ID, project build command/publish settings and eight captured production asset hashes were checked unchanged after testing.
- Before deployment, the billing dashboard and billing API showed approximately **1,320.48 credits available**: 831.59 plan credits plus 488.89 existing additional credits. A subsequent check showed approximately 1,320.47 credits. Usage reporting can lag. Existing Personal plan remains $9/month; **auto recharge remains disabled**. No credits or services were purchased.
- Initial disabled draft `6aeadc713aa3c42183e02d7f` and an unavailable draft `6aeadcd7f9f5d467c99a5b32` remain non-production preparation history. Only the working alias above should be shared.

## Actual hosting configuration

The CLI accepted deploy-specific `--env`/`--secret-env` overrides, but the hosted function did not receive them; it correctly returned unavailable. Runtime configuration was therefore moved to **site-only environment variables restricted to the exact `membership-pilot-review` branch**. No existing environment variable was modified, and the new variables have no production or all-context values.

The Personal plan returned HTTP 403 for granular Functions-only scopes. Its supported server scopes were used without upgrading: sensitive values are marked secret and available to Builds/Functions/Runtime, excluded from post-processing. Ordinary switches use the plan's normal scopes. The trusted build copies an allowlist and does not interpolate environment values into browser assets. A scan of all public files and decompressed function bundles found none of the actual hosted password, hash, Resend key, session secret or operator token. The plaintext hosted password is never uploaded; the function receives its scrypt hash.

Hosted settings: pilot enabled on this branch; **`MEMBERSHIP_EMAIL_ENABLED=false`**; exact send reference empty. The only eventual recipient in server code is **`mg.farris@comcast.net`**, from `membership@converseflyingeagles.org`, with no CC/BCC or applicant confirmation. The dedicated Resend key is secret configuration; no Resend request or email was made.

## Verification completed

- HTTPS loads with the hosted credential; HTTP redirects to HTTPS without sending a credential over HTTP.
- All six canonical paths (page, session, review, download, submit, send) return **401** with an authentication challenge to unauthenticated requests. The public local example password fails. Netlify's custom function routing makes all six direct `/.netlify/functions/membership-pilot...` aliases **404**, including with credentials; they provide no bypass.
- Environment files, private HTML/PDF assets, Python source, database and guessed completed-application URLs return **404**. The public Membership page remains public without the pilot form. Four original PDFs and Weather are available. PDF/Weather JS bytes are preserved; Weather HTML has only Netlify's existing Pretty URLs anchor rewriting.
- Invalid phone numbers, unconfirmed meeting dates, cross-origin requests, missing review and saving without a current PDF download are rejected. Local checks also cover CSRF/token expiry, rate limits, bots and delivery/storage errors.
- Live separate requests performed New/Regular review, download, edit, another review/download and held save. Editing resets the PDF requirement. A fresh session duplicated the same fictional application and received the same stable reference rather than another submission.
- An independent authenticated Netlify Blobs SDK read confirmed the native ETag, persisted normalized answers, dues, stored HTML/plain text and **the exact downloaded PDF bytes**, with status held, zero attempts and no provider message ID. This uses native hosted Blobs, without the local emulator shim.
- The **actual deployed JavaScript** was exercised against the **real HTTPS backend** in a lightweight DOM harness. Review/Edit retained all answers/acknowledgments; displayed capitalization, date-only formatting, leading-zero phone formatting, blank cell, Renewal dues/expiry, edited PDF download and held save passed. This is an automated integration check, not a visual browser/phone test. The browser automation host remains unavailable, so George's manual browser/phone review is still useful.
- Both downloaded hosted New/Regular and Renewal PDFs were rendered and visually inspected across all pages. The original application background remains legible; pending signatures, formatted numbers/dates and review pages are correct. The files remain outside the site at `../RC-Flyers-private/review/netlify-pilot-hosted/`.
- `npm test` passed **16 Node + 25 Python tests** before deployment. Hosted packaging uses Node 22. Runtime dependency audit is clear; the prior documented development-only Netlify CLI advisories remain unchanged.
- George cannot invoke operator delivery. Both saved fictional test applications remain held with **zero delivery attempts**. Saving in the form never sends mail, even after a separate operator test is later authorized.

Private operational evidence is under ignored `.netlify/pilot-ops/`: `baseline.json`, `verification.json`, `ui-verification.json`, `final-account-check.json` and redacted deployment logs. Do not publish that directory.

## George's 15–20 minute test

Use the detailed walkthrough in [NETLIFY-MEMBERSHIP-PILOT.md](NETLIFY-MEMBERSHIP-PILOT.md). In brief: choose New/Regular with fictional details; check validation and phone formatting; Review, Edit and verify retained answers; download/check the original-style PDF; check its review box and save the held test. Reload and compare Renewal date boundaries. Note issues and the saved reference. No email is expected in this stage; email/PDF delivery review requires a separately authorized operator test.

Meeting dates remain unconfirmed and separate from payment receipt; instructions use “the meeting arranged with the club.” Applicant/guardian signatures remain Pending Board confirmation. January–June new Regular dues and spouse/junior renewal late fees remain unresolved. Submission confirms neither payment nor membership approval.

## Close or roll back the pilot

Production is unchanged and needs no rollback. To close the draft under a later authorized maintenance action, set the pilot branch's `CFE_PILOT_ENABLED=false`, keep email false and the send reference empty, then redeploy **only this alias**. An environment edit alone is insufficient for an already deployed snapshot. Retire old pilot deployments/permalinks as needed; never delete or restore the production deploy to close this draft.

Preserve private `cfe-membership-pilot-v1` records and the stable secret for duplicate/delivery reconciliation. Remove fictional data later under an agreed retention decision. Keep the existing `rc-flyers` content store, local accepted records and Alumni configuration untouched. Password rotation requires a new hash/configuration and a fresh draft deployment; never publish the plaintext password.
