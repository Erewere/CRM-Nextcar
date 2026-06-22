# Phase 0: Payload-First Security TDD

## 1. Data Invariants
- A user must have an explicit role defined in `users/{userId}` to access any resources via RBAC.
- Admin role can only read and write data (`clients`, `tasks`, `files`) that matches their `agencyId`.
- Seller role can only read and write data where both `agencyId` matches theirs, and `sellerId` matches their `userId`.
- Master role can read all `agencies` and `users`, but is restricted from reading/writing `clients`, `tasks`, and `files` specifically to ensure data privacy.
- WhatsApp WebHook inputs (`clients`) might not be authenticated by a frontend user but will be handled securely by the backend via Firebase Admin SDK, bypassing these frontend client rules. Thus, these rules secure ONLY the client web app inputs.

## 2. The "Dirty Dozen" Payloads
Payloads to test logic leaks:
1. `Ghost Field`: A seller tries to update `client` and adds `isVerified Admin: true`. Should fail schema constraints.
2. `Spoof Agent ID`: Seller tries creating a client for a different `agencyId`.
3. `Spoof Seller ID`: Seller tries creating a client where `sellerId` points to another seller.
4. `Privilege Escalation`: User tries to update their own `role` to `master` in `users/{userId}`.
5. `Cross-tenant Admin`: Administrator of Agency A trying to read `clients` of Agency B.
6. `Master Data Breach`: Master tries to read a `client` doc. Should fail because Masters explicitly have no client read access.
7. `Task Relational Mismatch`: Creating a task for a `clientId` that belongs to another agency.
8. `File Relational Mismatch`: Uploading a file record for a `clientId` that does not belong to the user's agency.
9. `Invalid Status Status`: Changing a client status to `super-won`.
10. `Orphaned Task`: Creating a task pointing to a non-existent `clientId`.
11. `Time Travel`: Updating `createdAt` or providing a bad timestamp.
12. `ID Poisoning`: Pushing 1.5Kb ID data.

## 3. Security boundaries summary
All rules correctly enforce: Auth, Schema, and Identity.
