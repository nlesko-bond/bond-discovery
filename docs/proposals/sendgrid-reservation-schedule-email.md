# SendGrid: reservation schedule “Email” (outline)

This doc outlines how to **send** the rental schedule email from Bond (SendGrid) while optionally keeping **mailto** as a fallback or secondary action.

## Goals

- Deliver HTML (and/or plain text) schedule emails from the server without relying on the visitor’s mail client or URL length limits on `mailto:` bodies.
- Use a verified sender domain (e.g. `no-reply@bondsports.co` or org-specific from-address policy).
- Preserve auditability: log reservation IDs, org, recipient, SendGrid message ID.

## Components

1. **Environment (Vercel / CI)**  
   - `SENDGRID_API_KEY` — restricted key with Mail Send only.  
   - `SENDGRID_FROM_EMAIL` — verified sender.  
   - Optional `SENDGRID_FROM_NAME` — display name.

2. **API route** (e.g. `app/api/reservation-pages/[slug]/email-schedule/route.ts`)  
   - **Method:** POST.  
   - **Auth:** Staff/session or shared secret / existing admin auth pattern used elsewhere in this app—must not be callable anonymously with arbitrary payloads.  
   - **Body:** `{ organizationId, reservationIds: number[], htmlBody?: never }` — prefer server builds body from the same row-building logic as CSV/mailto (`buildMailtoScheduleBody` parallel or shared HTML builder) so content cannot be spoofed from the client.  
   - **Flow:** Load reservation payload(s) the same way `fetchReservationScheduleSource` does → build rows → render HTML template → `sendgrid.send(...)`.

3. **SendGrid client**  
   - Package: `@sendgrid/mail`.  
   - Single helper `sendReservationScheduleEmail({ to, subject, html, text })`.

4. **UI (`ReservationSchedulePage`)**  
   - Replace or complement `<a href={mailtoHref}>`:  
     - Primary: **Send via Bond** button → POST route → toast success/error.  
     - Optional secondary: **Open in mail app** → existing mailto (current behavior).  
   - Loading/disabled state while sending.

## Security

- Never expose raw API key to the browser.  
- Validate org membership / permission server-side before sending.  
- Rate-limit the route (per IP / per user if applicable).

## Operational

- Bounces/suppressions: configure SendGrid unsubscribe/suppression if marketing-like; for transactional schedules, keep transactional classification per policy.  
- **Size limits:** large schedules may exceed SendGrid payload limits—paginate or attach CSV link if needed.

## Rollout

1. Add env vars in Vercel (preview + production).  
2. Verify domain in SendGrid.  
3. Ship API + UI behind a feature flag if desired (`config` or env `NEXT_PUBLIC_ENABLE_SENDGRID_EMAIL`).  
4. Monitor first sends in SendGrid Activity.

## Out of scope (this outline)

- Exact auth middleware choice for bond-discovery (reuse whatever protects `/admin` or reservation APIs).
