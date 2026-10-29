# Discovery author lookups - 30 October 2026

`private.discovery_cards()` now collects the distinct (owner, publishing identity)
pairs from eligible published stories and unmigrated file entries. A materialized
CTE calls the existing `private.public_publishing_author` helper once for each
pair. Cards join that query-local result instead of repeating profile, role,
account-active and FAS-publishing checks for every piece.

Both identities remain separate for an owner who publishes personally and as
FAS. Migrated files still use the linked story and do not produce another card.
Unclaimed file entries remain unavailable. Every statement performs fresh
checks; there is no stored permission cache or extra TTL. Existing publication
revision checks in the delivery worker are unchanged.

The private helper remains a security definer with an empty search path and no
direct grants to public/anonymous/authenticated/service roles. Public wrappers,
RLS, column grants, card fields, sorting and page bounds are unchanged.

Validation covers exact before/after output, multiple authors and identities,
file and migrated entries, private drafts, contributor and FAS-access revocation,
account closure, profile edits, withdrawal, rollback and direct-function grants.
A sequence probe in the isolated test counts actual author-helper calls, avoiding
a timing threshold that could pass or fail because of the test machine.

Run `node scripts/benchmark-discovery-authors.mjs` for isolated 1,000-piece/10-author
and 5,000-piece/100-author comparisons. It uses the real PostgreSQL schema and
anonymous query permissions. Only fixture seeding skips write-side audit triggers;
they are enabled before measuring. Results are local database measurements, not
production network latency or real-user Core Web Vitals.

Completed local benchmark (5,000 pieces, 100 authors; median of three warm queries):

| Query | Before | After |
| --- | ---: | ---: |
| Homepage | 1,871 ms | 165 ms |
| Search | 1,887 ms | 212 ms |
| Genre filter | 1,964 ms | 177 ms |
| Related content | 2,007 ms | 310 ms |
| Deep page | 1,888 ms | 169 ms |

Every measured before/after response was deeply equal. The corresponding
1,000-piece/10-author checks also passed. Performance percentages are descriptive
benchmark results, not test thresholds or a promised end-to-end speedup.

Deploy the migration to DEV, verify security and output, then apply it to production.
Keep the old helper definition from `supabase/ops/rollback_discovery_author_lookups.sql`
available for a direct rollback. Do not rerun the earlier discovery migration,
which also adds stored columns. No content or policy changes are part of this release.
