# FamilyAdmin

## What This Is

FamilyAdmin is a private, self-hosted family management platform for the Baier family (5 members: 2 adults + 3 teens/adults). It consolidates tools currently scattered across many apps — tasks, recipes, travel, documents, and more — into one shared place where every family member has their own account with both shared and private data.

## Core Value

One place where the whole Baier family stays organized — shared data, individual ownership, no more app chaos.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Authentication & Accounts**
- [ ] 5 individual family member accounts (one per person)
- [ ] Shared family data visible to all members
- [ ] Private per-person data (foundation for future Notes module)
- [ ] Admin account (Frank) can manage family accounts

**Tasks Module (Priority 1)**
- [ ] Create tasks with rich text description
- [ ] Checklist items (bullet points) within a task
- [ ] Assign task to a specific family member
- [ ] Due date on each task
- [ ] Push/email reminders when tasks are due
- [ ] View tasks assigned to me vs. all family tasks

**Recipes Module (Priority 2)**
- [ ] Family recipe book — add, edit, view recipes
- [ ] Ingredients list + step-by-step instructions
- [ ] Assign recipes to meal plan

**Travel Module (Priority 3)**
- [ ] Trip planning per family trip
- [ ] Packing lists per trip/person
- [ ] Itinerary / important info

**Documents Module (Priority 4)**
- [ ] Central document storage for the family
- [ ] Organize by category
- [ ] Upload and download files

### Out of Scope

- Real-time chat / messaging — other tools handle this (WhatsApp etc.)
- Calendar sync — complex integration, deferred
- Public sharing / external access — family-private only
- Offline support — always-connected household assumed
- Native mobile app (iOS/Android) — web app first; React Native later if needed

## Context

- **Family:** Baier family, 5 members (2 adults + 3 teens/adults), all tech-savvy
- **Problem:** Family life is currently managed across many disconnected apps with no shared source of truth
- **Developer:** Frank Baier, 30 years Java experience, comfortable with Spring Boot + REST
- **Existing scaffold:** Spring Boot 3.5 backend + Next.js 15 frontend already initialized
- **Philosophy:** Get shit done — pragmatic, no over-engineering, ship value fast

## Constraints

- **Tech Stack**: Spring Boot 3.5 (Java 21), Next.js 15, PostgreSQL, Tailwind CSS — already decided
- **Package namespace**: `de.baier.familyadmin` — family name in all package identifiers
- **Cloud**: Railway — low cost, simple deployment
- **Audience**: Family-private, not a SaaS product — no multi-tenancy beyond the 5 accounts
- **Budget**: Minimal — Railway free/starter tier (~5$/month)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Individual accounts per member | Private data support (notes etc.) + clear task ownership | — Pending |
| Spring Boot + Next.js | Frank's Java expertise + modern React ecosystem | — Pending |
| Web app first, React Native later | Faster to ship; native app is optional extension | — Pending |
| Online only (no offline) | Simplicity; family is always at home when using it | — Pending |
| PostgreSQL on Railway | Simple, reliable, included in Railway | — Pending |
| Tasks as first module | Highest daily frustration, clear requirements, fast to build | — Pending |

---
*Last updated: 2026-03-29 — initial project setup*
