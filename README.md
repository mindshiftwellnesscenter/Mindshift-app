# MindShift Clinical Companion (prototype)

A clickable prototype of the MindShift Psychological Services client app. It's a static site: one `index.html` plus the guide PDFs (`files/`) and cover images (`covers/`). No build step is needed.

## Deploy to Vercel

**Option A: GitHub (recommended)**
1. Create a new private repository on GitHub and upload everything in this folder.
2. In Vercel, click **Add New → Project**, import the repository, and leave Framework Preset as **Other**. No build command or output directory is needed.
3. Click **Deploy**.

**Option B: Vercel CLI**
1. Install Node.js, then run `npm i -g vercel`.
2. In this folder, run `vercel` and follow the prompts, then `vercel --prod`.

## Before real clients use it

This is a demo. Sign-in, two-step codes, the app lock, purchases, and staff accounts are simulated, and all data lives only in the browser tab (it resets on refresh).

- Do not enter real client names or health information.
- The paid Couples Communication Workshop PDF is intentionally **not** included. Sell it through Payhip and paste the product link into `CHECKOUT_URL` in `index.html`.
- The site is set to `noindex` so search engines won't list it. Remove that when you launch publicly.
- A production version needs a developer to add real accounts, encrypted on-device storage, and hosting and vendors under signed business associate agreements (BAAs).
- The Terms of Use and Notice of Privacy Practices are drafts pending attorney review.

## Where to change things

Search `index.html` for:
- `CLIENT`: demo client name and clinician
- `CLINICIANS`: the therapist dropdown
- `PORTAL`: SimplePractice client portal link
- `CHECKOUT_URL`: store checkout link
- `LEGAL`: in-app Terms of Use and Notice of Privacy Practices text
- `CRISIS`: crisis and hotline numbers
