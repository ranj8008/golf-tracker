# Golf tracker: working agreement

## Discuss changes before making them

Before changing anything the user will see (layout, styling, colours, wording,
new or removed fields, behaviour), describe what it will look like and how it
will work, and wait for the user to agree. Don't build, commit or push a visual or
behaviour change on your own initiative, even a small "improvement" or a guess at
what was meant. When a request is open-ended ("make it nicer", "something cool"),
propose options first.

Pushing to the live branch deploys straight to the live site (Vercel) and, when
`supabase/setup.sql` changes, updates the database (the Set up Supabase Action),
so nothing should be pushed that the user hasn't agreed to.

## Confirm before pushing

Build and test here, then show the user what's been done (screenshots and a short
summary) and push only when they say so. No preview deployments or pull requests:
the user reviews from screenshots, then the branch is pushed and goes live.

Bug fixes the user has asked for can go ahead, but say what will change first if
it affects how anything looks or works.
