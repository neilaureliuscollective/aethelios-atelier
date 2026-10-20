# Non-destructive reconciliation for duplicate initial workspaces

Concurrent first visits could previously create more than one `businesses` row for the same owner. The code now claims exactly one initial workspace per user in `user_initial_business` (`user_id` primary key) inside `runInTransaction`.

This plan is **read-only until Neil approves a hosted migration**. Do not delete customer rows.

## Detect

```sql
SELECT owner_id, COUNT(*) AS businesses
FROM businesses
GROUP BY owner_id
HAVING COUNT(*) > 1;
```

```sql
SELECT user_id
FROM user_initial_business
WHERE business_id NOT IN (SELECT id FROM businesses);
```

## Choose the survivor

For each owner with more than one owned business, keep the **oldest** `created_at` (then lowest `id`) as the canonical initial workspace. That matches `canonicalOwnedBusiness()`.

Do **not** merge or rewrite Talk, Studio, work items, or exports. Additional owned businesses stay available for intentional multi-business use; they are simply not the auto-provisioned initial row.

## Claim without rewriting

```sql
INSERT INTO user_initial_business (user_id, business_id, created_at)
SELECT owner_id, id, created_at
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM user_initial_business u WHERE u.user_id = b.owner_id
)
AND created_at = (
  SELECT MIN(created_at) FROM businesses b2 WHERE b2.owner_id = b.owner_id
)
ON CONFLICT (user_id) DO NOTHING;
```

Review membership and `projects.business_id` orphans after the claim. Attach orphan projects only by setting `business_id` when it is currently null.

## Guest drafts

```sql
SELECT adopted_from_guest_id, COUNT(*)
FROM projects
WHERE adopted_from_guest_id IS NOT NULL
GROUP BY adopted_from_guest_id
HAVING COUNT(*) > 1;
```

Keep the earliest project per guest draft. Do not delete the extra row until Neil reviews it. The unique index `projects_guest_draft_idx` must be created only after duplicates are resolved.

## Rollback

Dropping `user_initial_business` / `guest_work_claims` / `business_confirmations` returns the uniqueness gate to application logic only. Existing businesses and projects remain.
