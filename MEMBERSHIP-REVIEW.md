# Membership implementation review

The public Membership links now open the supplied PDFs in the existing lowercase `/documents/` folder. The three former public Word copies were preserved unchanged in `../RC-Flyers-editable-originals/`, outside the published website; their SHA-256 hashes were verified before removing the public copies. Original Word sources remain in `D:\GoFlex Home Documents\Websites\Eagle Flyers of Converse\Club Updates`. No source document was rewritten. The Website reference PDF supplied in the folder remains unlinked from Membership.

## Decisions needed from Michael

The page includes the clear amounts ($100 regular, $5 spouse, no charge for juniors under 19 as of March 31), AMA membership for member flying, and document instructions. It directs readers to the club for conditions that are ambiguous below. These questions are review notes, not public page text.

| Topic | Specific question and conflicting source wording |
| --- | --- |
| Late-year membership | The application and website reference say $100 regular membership received after September 30 is good through the following year. Both also list $25 membership for October 1–December 31 expiring December 31, for prior-year non-members. Which option applies, and how does eligibility differ? |
| New-member total | The website reference adds a one-time field improvement fee equal to annual dues, says dues are prorated, and mentions family/student discounts. The application lists fixed regular, spouse, junior, and late-summer amounts without a field fee. Is there an additional fee, and what is the authoritative total and proration schedule? |
| Late fee and renewal dates | The application lists a fixed $20 after March 31 for current members. The website reference says 20%, January 1 renewal, and December 31 expiry without a grace period. Is the fee always $20 or a percentage, including for spouse membership, and how do late-year carryover terms affect renewal? |
| Joining and approval | The application requires new members to attend a meeting and bring cash/check; the website reference directs them to mail the application with a check. Bylaws Section 7 says all members must be voted on; the reference suggests a potential vote. What submission, attendance, payment, and approval steps are required? |
| Renewal paperwork | The form is titled Application / Renewal, but the website reference says there is no renewal form. What must renewing members submit? |
| Junior age, consent, voting | The bylaws Membership section allows supervised juniors voting privileges, while Section 7 says juniors have no voting rights. The consent rule includes applicants at age 19, while junior eligibility is under 19 as of March 31. Which voting and guardian-consent rules apply? |
| AMA eligibility | The application signature certifies current AMA membership. Its spouse note and the bylaws describe AMA membership as required to fly, including for lifetime members. Must non-flying members also hold AMA membership, and which AMA membership categories qualify? |
| Membership cards | The application says the club provides cards and requests a self-addressed stamped envelope for mailing. The website reference says the secretary emails a PDF card. Which delivery methods are offered? |
| Discipline and termination | The application allows termination/nonrenewal/denial at the club's discretion. The bylaws Membership section requires confirmation by a membership majority, Section 8 specifies a two-thirds board vote, and Section 10 describes progressive grievances and a membership expulsion vote. Which procedure and decision authority apply in each circumstance? |

## Existing website comparison

- The homepage FAQ's $30 annual dues was outdated compared with the supplied $100 regular dues. It now says $100 regular dues and links to Membership for spouse/junior options and documents.
- Homepage Join the Club links now lead to Membership.
- About no longer presents the Contact Form as a membership application. Its membership callout links to the new page and describes AMA membership as required for member flying, rather than for every non-flying member.
- About's $10 dues is explicitly part of the August 1990 history and was preserved.
- No existing public Word document links or specific renewal instructions were found to replace.
- Existing AMA price figures match the website reference and were left unchanged. FAA/AMA material was not expanded in this phase.

## Local verification

There is no project build command. Use the preview command in README.md; `npm test` now runs the weather and preview regression checks added in the subsequent weather fix. Completed Membership checks:

- All 11 public HTML pages returned HTTP 200, with Membership between About and Events in each header.
- All 28 distinct local file URLs referenced by those pages returned HTTP 200; no missing local references were found.
- In the PDF update, all three links returned HTTP 200 with `Content-Type: application/pdf` and bytes matching the files on disk. URL path capitalization was checked against every actual directory/file name. All three PDFs opened from the Membership links in new Edge tabs with Print and Save controls.
- All eight PDF pages were rendered and visually inspected: application 1 page, bylaws 6 pages, field rules 1 page. Text and print-and-fill areas are readable. No interactive form fields were added.
- Membership has one H1, unique IDs, valid local section anchors, three native PDF links with `target="_blank" rel="noopener"` and no `download` attribute, and no form. Exact PDF instructions, unchanged dues/header markup, archived Word copies, and 404 responses for the former Word URLs were checked.
- New inline JavaScript, JSON-LD, and `js/navigation.js` passed syntax checks. A navigation behavior smoke check passed toggle, ARIA state/control association, link selection, outside dismissal, and Escape with focus return.
- `git diff --check` passed. No build was run because this site is buildless and has no build script.

The PDF update was reviewed visually in Edge at desktop width, a 400px mobile viewport, and 200% browser zoom. Mobile Membership menu selection worked; document buttons wrapped within their cards, and keyboard focus was visible. Keyboard activation of the bylaws and field rules links opened the correct PDF tabs. The preview server was started with the explicit absolute repository directory at `http://127.0.0.1:4173/membership.html` and left running for local review. The previous connection-refused problem occurred when the server was no longer running.

Physical-device testing and printing on a physical printer were not performed. The native browser PDF viewer was verified in Edge; other browsers may honor their own PDF handling preferences. A subsequent weather fix replaced the plain static preview with `scripts/preview.py` (`npm start`), which serves the same repository and additionally forwards the public read-only weather endpoint. It does not execute other Netlify Functions.

Owner acceptance is PASS for Membership and Weather. The owner authorized committing and pushing the accepted changes through the existing automatic deployment workflow. The extra Website reference PDF is preserved locally and excluded from the release.
