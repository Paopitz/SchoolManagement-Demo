# Standalone demo frontend

This is a client-presentation copy, not the API-connected production frontend.
See [Demo setup and sample accounts](../README.md) and the
[Client demo guide](../docs/client-demo-guide.md).
For publishing, see [GitHub Pages deployment](../docs/github-pages-deployment.md).

```powershell
npm.cmd ci
npm.cmd start
```

Open http://localhost:4300. Both build configurations use in-memory sample arrays.
Module URLs use hash routing, such as `http://localhost:4300/#/settings`, for
refresh-safe static hosting on GitHub Pages.
The existing service classes retain their names, but a terminal local `HttpBackend`
handles all calls without network access.

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

Reload the page to reset sample data. Sign out to change roles.

## Revised enrollment walkthrough

This copy is **DEMO ONLY**: no SMTP, real authentication, API server, SQL Server,
official enrollment, or legal declaration. Enter fictional information only.
The terminal `DemoBackend` handles every request locally in both build modes;
unknown routes and external URLs are rejected, never forwarded.

1. Open `/#/student-portal`. Use one of these fictional emails, request a demo
   code, then enter the public code **12345678** (no email is sent):
   - `new@example.invalid`: New application without an LRN.
   - `returning@example.invalid`: linked fictional student and finalized grades.
   - `conditional@example.invalid`: failed external subject and conditional review.
   - `correction@example.invalid`: pending profile correction.
   - `approved@example.invalid`: previously approved fictional application.
2. Sign in to staff using `demo.admin` / `Demo123!`. Open application review.
   Resolve the missing New LRN with a unique fictional 12-digit number and reason,
   review documents/previous grades, then approve with a matching section/subjects.
   Only approval creates the fictional student and enrollment in browser memory.
3. New submission permits NotAssigned/Unknown LRN; Returning/Transferee require
   12 digits. Final approval is blocked while unresolved, and identity resolution
   invalidates academic review. Existing LRN claims never auto-merge records.
4. Use Role permissions to remove Teacher enrollment access, then sign in as
   `demo.teacher` to demonstrate the changed navigation and denied operations.
   Grants are mutable demo state, not production security.
5. Students is a directory/edit screen; standalone creation is retired. Use
   applications for new registrations. Reload to reset all fictional changes.

Attachments accept bounded synthetic PDF/JPEG/PNG files only, stay in memory,
and are cleared when the portal session ends or the page reloads. Do not upload
real student documents. A printed grade summary is explicitly non-official.
