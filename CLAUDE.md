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

Bug fixes the user has asked for can go ahead, but say what will change first if
it affects how anything looks or works.
