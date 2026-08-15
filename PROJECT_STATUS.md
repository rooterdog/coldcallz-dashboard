# ColdCallz — Project Status

Last updated: 2026-08-15

---

## What This Is
Cross-platform field sales cold call logger.
- **Mobile app**: React Native + Expo (iOS/Android) — the primary product
- **Web dashboard**: Next.js — manager/team view, hosted at dashboard.coldcallz.net

---

## Repos & Locations
| Piece | Path | URL |
|---|---|---|
| Mobile app | `/Users/jefffurr/Documents/Dev/coldCallz` | Expo Go / TestFlight |
| Web dashboard | `/Users/jefffurr/Documents/Dev/coldcallz-dashboard` | dashboard.coldcallz.net |
| Supabase project | — | Supabase dashboard |

---

## Tech Stack
- React Native + Expo ~54.0.35
- Next.js 14 (App Router, TypeScript, Tailwind)
- Supabase (auth, Postgres DB, RLS, file storage)
- OpenAI Whisper (transcription) + GPT-4o (summaries, follow-up extraction)
- Google Places API (business lookup by GPS)
- Stripe (planned — not yet built)

---

## Database Schema (key tables)
- **user_profiles** — user_id, full_name, role (solo/manager/rep), organization_id
- **organizations** — id, name, created_by
- **invites** — id, email, token (UUID), organization_id, invited_by, accepted_at
- **visits** — id, user_id, business_name, address, status, visit_time, summary, follow_up_date
- **follow_ups** — id, visit_id, note, due_date, completed
- **visit_photos** — id, visit_id, storage_path, photo_type

### RLS Notes
- Infinite recursion bug (42P17) was fixed using SECURITY DEFINER helper functions: `get_my_role()` and `get_my_org_id()`
- invites table has `USING (true)` SELECT policy + `GRANT SELECT ON invites TO anon` so the join page can read tokens without auth

---

## User Roles
| Role | Can Do |
|---|---|
| solo | Everything — no org, sees Team page to create org |
| manager | Everything + Team page (invite reps, see all rep stats) |
| rep | Visits/follow-ups for own data only. No Team page access (redirected away) |

---

## Web Dashboard — Feature Status
| Feature | Status |
|---|---|
| Login / logout | ✅ Working |
| Visit list | ✅ Working |
| Follow-ups | ✅ Working |
| Team page (manager) | ✅ Working |
| Org creation | ✅ Working |
| Rep invite flow (token-based) | ✅ Working |
| Rep join page (/join?token=) | ✅ Working |
| Password reset | ✅ Working |
| Reps blocked from /dashboard/team | ✅ Working |
| Stripe billing | ❌ Not built |
| Reps see only own data (RLS) | ⚠️ Not enforced yet — reps can currently see all org visit data |

---

## Mobile App — Feature Status
| Feature | Status |
|---|---|
| Login / signup | ✅ Working (last tested before org/role changes) |
| Log a visit (GPS + Places) | ✅ Working (last tested before org/role changes) |
| Voice dictation / AI summary | ✅ Working (last tested before org/role changes) |
| Photo capture | ✅ Working (last tested before org/role changes) |
| Follow-ups | ✅ Working (last tested before org/role changes) |
| Role awareness (rep vs manager) | ❌ Not implemented — app has no concept of orgs/roles yet |
| Tested after DB schema changes | ⚠️ NOT YET — needs full smoke test |

---

## Known Issues / To-Do
1. **[URGENT] Mobile app smoke test** — hasn't been tested since org/role DB changes. Should still work for reps (visits are user_id scoped) but needs verification.
2. **Rep data isolation** — RLS currently lets reps query all org visits on the web. Need policies so reps only see their own rows.
3. **Org name** — Jeff's org is called "test". Needs to be renamed to real agency name.
4. **Stripe billing** — not started. Free/premium/premium-plus tiers defined but not enforced.
5. **Mobile: manager view** — no team/rep visibility in the app yet (future feature).

---

## Invite Flow (how it works now)
1. Manager goes to Team page → enters rep email → clicks Send Invite
2. Page generates a UUID token client-side, inserts into `invites` table with that token
3. Displays link: `https://dashboard.coldcallz.net/join?token=<uuid>`
4. Manager copies link and sends to rep manually (email/text)
5. Rep opens link → fill out name + password → account created, linked to org as 'rep'
6. Invite marked accepted_at

---

## Domains
- coldcallz.net → Vercel (web dashboard) ✅
- dashboard.coldcallz.net → Vercel ✅
- www.coldcallz.net → Vercel ✅
