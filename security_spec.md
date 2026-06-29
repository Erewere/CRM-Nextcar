# Security Spec

## Data Invariants
- A user must have a valid agencyId to access agency-specific data (except for 'master' role which can access everything).
- Clients, tasks, deals, vehicles, vehicleExpenses, files, notes, agency_tags must belong to an agency.
- Users can only read/write data for their own agency.
- 'seller' role can only read/write clients/tasks assigned to them (or public clients in the agency if visibility is 'all'). Actually, let's keep it simple: sellers can only see their own stuff and public stuff. But wait, in Kanban they see `agencyQuery` combined with `sellerId`. Let's assume standard agency isolation: users in the same agency can see agency data, but 'seller' might be restricted. Let's look at how the app queries.

## The "Dirty Dozen" Payloads
1. Spoofing User Role: Updating own user profile to set role = 'master'.
2. Cross-Agency Access: Reading a client document from another agency.
3. Poisoning ID: Creating a task with a 5000 character title.
4. Unauthenticated Access: Read without login.
5. Missing Agency: Creating a client without an agencyId.
6. Spoofing Email: Using a fake email without email_verified.
7. Shadow Update: Updating client with an extraneous field `isAdmin: true`.
8. Updating Terminal State: Changing a closed deal back to open (if not admin).
9. Denial of Wallet: Querying tasks without `agencyId` filter.
10. Orphaned Record: Creating a task for a non-existent client.
11. PII Access: Reading user emails across agencies.
12. Immortal Field Edit: Changing `createdAt` timestamp.

## Test Runner
Implemented in `firestore.rules.test.ts`.
