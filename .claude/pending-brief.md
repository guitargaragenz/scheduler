doc_status: live

# Pending Brief — One Parking Lot, fed from the Daily Log (Merge A)

The full brief lives at [docs/briefs/one-parking-lot-fed-from-bujo.md](../docs/briefs/one-parking-lot-fed-from-bujo.md).
It is the scope lock. Read it in full — including the **Council amendments** section, which
overrides the body where they disagree.

**Approved by Trevor 2026-08-01. Council complete 2026-08-01, two reviewers, both "ship with
changes". Now at protocol step 3 (builder).**

## This slot covers Merge A only

Items 1 and 2 of the brief:

1. Stop `saveParkingLot()` wiping the table, and stop a failed read seeding over real data.
2. Merge the two parking lots into one, Supabase authoritative, `admin/context/parking-lot.md`
   deleted, and the Sunday meeting's export script reading the table instead.

**Item 3 (the `#PL` tag) is NOT in this merge.** It is Merge B, cut only after Merge A has been
live for a real day. Do not build it here.

Workshop Projects / `#PRJ` is out of scope entirely — it has no brief.

## The build order is fixed — see Council amendment B

`loadParkingLot()` null-on-error first → then the diff-based `saveParkingLot()` → then the
markdown migration, run and eyeballed in the app before the file is deleted → then
`INITIAL_ITEMS` and the seeding branch deleted last.

## The previous occupant of this slot

Suppliers, shared settings, and the Settings modal tidy-up — shipped 2026-08-01 at `d78b02e`,
recorded in [docs/briefs/README.md](../docs/briefs/README.md)'s Closed table. Nothing pending
was lost by replacing it.
