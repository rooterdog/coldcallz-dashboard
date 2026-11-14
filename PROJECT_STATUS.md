# ColdCallz — Project Status

Last updated: 2026-11-14

---

## What This Is
Cross-platform field sales cold call logger.
- **Mobile app**: React Native + Expo SDK 57 (iOS) — the primary product
- **Web dashboard**: Next.js 14 — manager/team view + billing

---

## Repos & Locations
| Piece | Path | URL |
|---|---|---|
| Mobile app | `/Users/jefffurr/Documents/Dev/coldCallz` | TestFlight / App Store |
| Web dashboard | `/Users/jefffurr/Documents/Dev/coldcallz-dashboard` | www.coldcallz.net (Vercel) |
| Supabase project | — | fshifikelywyqnlfcsva |

---

## Tech Stack
- React Native + Expo SDK 57
- Next.js 14 (App Router, TypeScript, Tailwind)
- Supabase (auth, Postgres DB, RLS, Edge Functions, file storage)
- OpenAI Whisper (transcription) + GPT-4o (summaries, follow-up extraction)
- Google Places API (business lookup by GPS)
- RevenueCat (mobile IAP — iOS subscriptions)
- Stripe (web billing — test mode, not yet live)

---

## Mobile App IDs
- Bundle ID: `com.rooterdog.coldcallz`
- EAS Project ID: `5c761ac5-073e-4ee6-b134-8560c643b039`
- Apple Team: Jeff Furr - Individual (PTFUB9U96L)
- RevenueCat API Key (production iOS): `appl_SVFVsDUHpiTnhYRoWrnZYUeAuxz`
- RevenueCat Entitlement ID: `coldcallz_pro`

---

## Database — Key Tables
| Table | Purpose |
|---|---|
| `users` | Mobile source of truth. Has `tier` (free/pro/team), `subscription_status`, `role`, `organization_id` |
| `user_profiles` | Web dashboard source. Has `subscription_tier`, `subscription_status`, `role`, `organization_id` |
| `organizations` | id, name, created_by |
| `invites` | token-based rep invites (email, token UUID, organization_id, accepted_at) |
| `visits` | id, user_id, business_name, address, status, visit_time, notes_summary, follow_up_date |
| `follow_ups` | id, visit_id, note, due_date, completed |
| `visit_photos` | id, visit_id, storage_path, photo_type |

### Two-Table Sync (IMPORTANT)
The app uses TWO user tables that are kept in sync via Postgres triggers:
- Mobile signups → write to `users` → trigger syncs to `user_profiles`
- Web/Stripe updates → write to `user_profiles` → trigger syncs to `users`
- RevenueCat webhook → writes to BOTH tables directly

**Triggers:**
- `on_auth_user_created` → `handle_new_user()` — creates `users` row on auth signup
- `sync_users_to_profile` (INSERT on `users`) → `sync_users_to_user_profile()` — creates `user_profiles` row
- `sync_profile_to_users` (UPDATE only on `user_profiles`) → `sync_user_profile_to_users()` — syncs tier/status back to `users`

Note: `sync_profile_to_users` is UPDATE only (not INSERT) to prevent circular trigger loop.
Note: trigger functions must use `public.user_profiles` (schema-qualified) or they fail with "relation does not exist".

---

## Supabase Edge Functions
| Function | Purpose | JWT |
|---|---|---|
| `process-visit` | Whisper transcription + GPT-4o summary for new visits | no-verify-jwt |
| `append-notes` | Whisper + GPT-4o for appended voice notes on existing visits | no-verify-jwt |
| `revenuecat-webhook` | Handles RevenueCat subscription events, updates both tables | no-verify-jwt |

RevenueCat webhook URL: `https://fshifikelywyqnlfcsva.supabase.co/functions/v1/revenuecat-webhook`

---

## Pricing
| Plan | Price | Channel |
|---|---|---|
| Free | $0 | — |
| Pro Monthly | $12.00/mo | RevenueCat (mobile) / Stripe (web) |
| Pro Annual | $99.99/yr | RevenueCat (mobile) / Stripe (web) |
| Team | Manager-assigned | Web dashboard only |

Free limit: 5 visits/day. Checked in `VoiceScreen.js` against `users.tier`.

---

## User Roles
| Role | Access |
|---|---|
| solo | Individual user, no org |
| manager | Team page, see all rep stats, invite reps |
| rep | Own visits/follow-ups only. No Team page. Gets `team` tier (bypasses free limit) |

---

## Web Dashboard — Feature Status
| Feature | Status |
|---|---|
| Login / logout | ✅ Working |
| Visit list | ✅ Working |
| Follow-ups | ✅ Working |
| Team page (manager) | ✅ Working |
| Rep invite → sets team tier | ✅ Fixed Nov 2026 |
| Upgrade banner flash fix | ✅ Fixed Nov 2026 |
| Stripe billing (web) | ⚠️ Test mode only — not yet live |

---

## Mobile App — Feature Status
| Feature | Status |
|---|---|
| Login / signup | ✅ Working |
| Log a visit (GPS + Places) | ✅ Working |
| Voice dictation / AI summary | ✅ Working |
| Photo capture | ✅ Working |
| Follow-ups | ✅ Working |
| Append notes to existing visit | ✅ Working (mic button in VisitDetailScreen header) |
| 5-visit free limit | ✅ Fixed Nov 2026 (was querying wrong table) |
| RevenueCat IAP | ✅ Production key active |
| Upgrade flow (post-purchase unlock) | ✅ Fixed Nov 2026 (entitlement ID + immediate Supabase update) |
| TestFlight | ✅ Active |
| App Store submission | ⏳ Pending |

---

## Known Issues / To-Do
1. **Stripe live mode** — web billing is test mode only. Need to swap keys and recreate webhook before public launch.
2. **App Store submission** — screenshots, privacy policy URL still needed.
3. **Org name** — Jeff's org is called "test". Should be renamed.
4. **Rep data isolation (web)** — RLS lets reps query all org visits on web. Low priority.

---

## Invite Flow
1. Manager → Team page → enters rep email → Send Invite
2. UUID token generated, stored in `invites` table
3. Link shown: `https://www.coldcallz.net/join?token=<uuid>`
4. Manager sends link to rep manually
5. Rep opens link → enters name + password → account created with `role: rep`, `subscription_tier: team`
6. Trigger syncs `team` tier to `users` table automatically

---

## Domains
- www.coldcallz.net → Vercel ✅
- coldcallz.net → Vercel ✅
