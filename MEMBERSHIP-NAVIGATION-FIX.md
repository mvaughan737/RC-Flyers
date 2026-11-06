# Membership PDF and navigation recovery

Prepared after George's pilot feedback and deployed to the existing protected draft under the owner's subsequent authorization. **No email, Git commit/push, production change or DNS change.**

## Hosted update — November 5, 2026

Working pilot: https://membership-pilot-review--converse-flying-eagles.netlify.app/membership-pilot

Draft deploy `6aec170e77af41b52da96159` replaces the prior pilot workflow. Existing hosted credentials are unchanged; retrieve the password privately as described in `NETLIFY-PILOT-DEPLOYMENT.md`. Production remains `6ae96fee331f16e421aa78b6`, with all eight captured public asset hashes unchanged. Before deployment, 1,318.95 credits remained and auto recharge was disabled. No plan or recharge changes were made.

The Node 22 offline Netlify build and all 51 local tests passed. Hosted checks confirmed all eight canonical page/API paths require authentication, including the new restart/logout endpoints; direct function aliases offer no unauthenticated bypass. The local example password is rejected, HTTP redirects to HTTPS, and secret/private asset/database/completed-PDF paths remain unavailable. The public Membership page remains public without a pilot form.

The exact deployed JavaScript was exercised against the real HTTPS backend using the lifecycle/DOM harness: fictional entry → Review → separate PDF context → return → Edit; Back/Forward and reload restored fields, application/category choices and review state; blocked popups exposed ordinary links. Navigation created zero submissions. Repeated saving and a fresh session returned the same private reference. An independent native Blobs SDK read confirmed persisted answers, matching PDF bytes, held status, zero delivery attempts and no provider ID. Hosted sending is false and the send reference is empty. Evidence is in ignored `.netlify/pilot-ops/navigation-*.json`.

**Interactive checks remain unverified:** actual browser tab/PDF-viewer behavior, browser Back/Forward/bfcache behavior, and popup-blocker presentation in a real desktop/mobile browser. Browser control is unavailable. The hosted lifecycle results above use a simulated DOM/history/tab model and are not a visual browser test.

## Result

- **Open PDF in a new tab** reserves a separate browser tab during the click, then loads the authenticated PDF response into an opaque temporary Blob URL. It never navigates the form tab. The blank tab's copied pilot session-storage entry is removed before loading its PDF, and its opener is detached.
- The review displays ordinary **Open the current PDF in a new tab** and **download a copy** links after retrieval. Both target a separate context with `noopener noreferrer`. Popup blocking leaves the form/review intact and shows a clear fallback message. An unsuccessful retrieval closes the reserved blank tab, retains answers and reports the error. Blob URLs are revoked when replaced, when navigating between application views, or when the application session ends; there is no premature one-minute revocation while a member is reviewing.
- Form fields, New/Renewal, membership category, date-only values, acknowledgments and review/save state recover through Back/Forward, reload and the back/forward cache. Restoring a different reviewed version reconciles it with the server and requires checking the newly matching PDF before saving. Navigation does **not** submit an application or send email.
- Saving keeps the application and review available. **Start New Application** is the only normal reset. It asks for confirmation when answers/selections or review history would be lost; cancel preserves everything. A reset invalidates the old server session and history cache without deleting any privately saved submissions.
- **End Session** confirms loss when needed, invalidates the server session and clears this tab's temporary application data. Absolute expiry also clears it; a frozen/background page checks expiry when it wakes. A non-sensitive ended marker prevents Back or bfcache from resurrecting old answers. Active tabs in the same pilot session receive a non-sensitive end notification. Because HTTP Basic authentication is cached by the browser, the interface tells members to close the private browser window and PDF tabs after ending the application session.

## Privacy and server changes

Recovery uses only tab-scoped `sessionStorage`: `cfe:membership-pilot:v2` for the pilot and a separate local-prototype key. There is no `localStorage`, no personal information in URLs or `history.state`, and no stored browser password, API key, CSRF token or PDF bytes. History contains opaque entry IDs only. Temporary answers are restored only after the authenticated server confirms the same unexpired session. Unrelated site storage is untouched. If browser storage is blocked/full, the interface warns the member to keep the tab open; the last reviewed answers can still be recovered from the private authenticated server session.

The session endpoint now resumes a valid HttpOnly-cookie session and returns its original expiry and current review/save metadata, excluding PDF bytes. New protected `restart` and `logout` POST actions use the existing password/origin/CSRF checks. Session-rejection responses have an explicit expiry code for client cleanup. The Python local adapter implements the same contract. Session recovery does not extend the original one-hour lifetime.

The PDF renderer/background/font, dues calculations, email templates, George-only hosted recipient, private submission records and conditional duplicate protection are unchanged. Sending remains disabled. Authentication/session cleanup does not claim to erase an already rendered PDF from the browser's PDF viewer; close its tab when finished.

## Verification

Automated tests exercise the actual pilot handler, PDF generation and private conditional store with a browser lifecycle/DOM harness:

1. Enter fictional information → Review → reserve/open PDF → return → Edit; all answers, selections and acknowledgments retained.
2. Block popups; ordinary PDF links appear and the form tab remains intact.
3. Back/Forward, full reload and bfcache return restore the appropriate form/review snapshots, including different historical application versions and matching PDFs.
4. Save once, navigate/reload, edit/review the same information and save again: **one private submission**, held with **zero email attempts**. No submit request occurs merely from navigation.
5. Cancel/confirm Start New; expire/end a session; revisit old history; mismatch a session; block session storage. Old personal data is not resurrected, and unrelated storage survives.
6. Server resume preserves expiry, reviewed/downloaded/saved metadata; restart/logout invalidate old access while retaining private submissions.

`npm test`: **25 Node and 26 Python tests passed** (51 total), including existing weather, validation, formatting, dues boundaries, original-style long-entry PDF, email-disable/recipient and duplicate regressions. The HTTP preview returns the updated controls. Native visual-browser verification was attempted but the browser host was unavailable and Windows Computer Use timed out; the navigation results above are automated lifecycle/integration checks, not claims of an interactive Safari/phone test.

Local hosted-code preview: `http://127.0.0.1:4181/membership-pilot`, username `george`, local-only fixture password `local-fictional-test-only`. This preview never loads a real email key and its mail transport is disabled. A second Python preview is at `http://127.0.0.1:4182/membership.html`; both use the new session contract.

After the power interruption, all 51 tests passed again and both previews were restarted. The offline Netlify build completed, including function bundling. HTTP checks confirmed the pilot page rejects unauthenticated requests (401), serves the updated controls when authenticated (200), and serves the updated recovery script. Both local environment files still have sending disabled. The browser-control host remains unavailable, so interactive browser verification remains outstanding.

For Michael's manual review: enter fictional details, Review, open the PDF, return to the original tab and Edit; use Back/Forward and reload; check the same selections/answers remain. Try denying a popup and use the ordinary link. Verify Start New cancellation preserves the application and confirmation clears it. End Session should clear answers and prevent old history recovery. Any later deployment must include the client, page and server changes together; uploading only JavaScript/HTML is insufficient.
