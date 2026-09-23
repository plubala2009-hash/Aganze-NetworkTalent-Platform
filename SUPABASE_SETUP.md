# Supabase MVP setup

The website is now Supabase-ready, but it cannot create real accounts until it is connected to your Supabase project.

## Setup

1. Create a project at https://supabase.com.
2. In **SQL Editor**, run `supabase-schema.sql`.
3. In **Project Settings → API**, copy the project URL and the `anon` public key.
4. Copy `supabase-config.example.js` to `supabase-config.js` and replace the two placeholders.
5. Commit `supabase-config.js` to the repository. The anon key is intended for browser use; never add a service-role key.
6. In **Authentication → URL Configuration**, add your GitHub Pages URL to Site URL and Redirect URLs.
7. Enable email authentication and configure an SMTP provider before launch.

## Included flows

- Candidate/company email signup and login
- Authenticated profile persistence
- Authenticated simulation file uploads to private Storage
- Simulation metadata in Postgres
- Contact form messages in Postgres
- Safe fallback to the local demo behavior when Supabase is not configured

## Production checklist

- Configure custom SMTP and email confirmation.
- Add a real custom domain and HTTPS.
- Review the RLS policies and privacy requirements before launch.
- Replace demo dashboard content with queries to `profiles` and `simulations`.
- Test password reset, email confirmation, upload limits, and account deletion.
