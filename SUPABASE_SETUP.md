# Production marketplace setup

This branch adds trust, privacy, moderation, discovery, and engagement primitives.

## Database

1. Create a Supabase project and run `supabase-schema.sql` in a staging project first.
2. Copy `supabase-config.example.js` to `supabase-config.js` and add only the project URL and browser `anon` key. Never commit a service-role key.
3. Enable email confirmation, configure SMTP, and add only your real HTTPS site to Authentication URL Configuration.
4. Create an administrator profile through a controlled SQL migration; never expose an admin signup option. The current starter function identifies the first admin using `company_name = 'Aganze Admin'`; replace this with a private admin role before launch.
5. Review Storage limits and allowed MIME types for your use case.

## Trust workflow

- Candidate profiles are private by default (`is_public = false`).
- Companies must be verified before they can discover candidates or send contact requests.
- Candidates publish evidence as `pending`; only an administrator can approve it.
- Employers can discover only public candidate profiles and approved public evidence.
- Uploaded files remain private. Do not create public Storage URLs; add a server-side signed-download flow after candidate consent.
- Users can report profiles/evidence and block companies.

## Frontend flows

`supabase-app.js` enforces the UX side of these rules, but the database RLS policies are the actual security boundary. Test policies with separate candidate, unverified company, verified company, and admin accounts.

## Launch checklist

- Test signup, email confirmation, password reset, account deletion, and session expiry.
- Test that a candidate cannot read another candidate's private profile or pending file.
- Test that an unverified company cannot query discovery or create a contact request.
- Add CAPTCHA/rate limiting to public contact forms and moderation notifications for reports.
- Add a privacy policy, retention/deletion process, terms for employers, and a process for evidence disputes.
- Use a custom domain with HTTPS and remove demo statistics from the landing page.
