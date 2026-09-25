# Admin bootstrap and review runbook

The app must never allow a visitor to create an administrator account. Admin creation is a controlled Supabase operation.

## Create the first admin

1. Create and email-confirm the staff account through the normal signup flow.
2. In Supabase **Authentication → Users**, copy the user's UUID.
3. Run this in the SQL Editor after the other migrations:

```sql
insert into public.admin_users (user_id)
values ('REPLACE_WITH_AUTH_USER_UUID')
on conflict (user_id) do nothing;
```

4. Test `admin-dashboard.html` while signed in as that user.
5. Keep administrator UUIDs in a private operations runbook; never add an admin signup form or service-role key to the website.

## Review rules

- Reject a company submission when the identity, website, or business explanation cannot be checked.
- Reject evidence that is unreadable, unrelated to the claim, or missing issuer/context.
- Add a useful review note; candidates see it on their evidence page.
- Approve only after the file and metadata support the claim.
- Candidates decide whether approved evidence is public; private evidence remains invisible to employers.

## Required tests

Test with separate accounts:

- candidate: can submit evidence but cannot approve it;
- company: can submit verification but cannot browse until approved;
- verified company: can discover public candidates and send requests;
- admin: can review submissions, evidence, and reports;
- anonymous visitor: cannot read private profiles or evidence.
