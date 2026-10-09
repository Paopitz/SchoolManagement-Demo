# School Management - Standalone Client Demo

Standalone Angular UI for client presentations. This public repository contains
only the demo frontend, fictional sample data, documentation, and GitHub Pages
deployment workflow. It does not contain the production API, database migrations,
backend tests, or database credentials.

## Start the demo

Requirements: Node.js compatible with Angular 22 (this copy was validated with
Node.js 24) and npm. No .NET SDK, SQL Server, connection string, or API process is
required.

```powershell
Set-Location C:\Users\paulo\source\repos\SchoolManagement-Demo\SchoolManagement.frontend
npm.cmd ci
npm.cmd start
```

Open **http://localhost:4300**. The separate port prevents conflicts with the
original frontend on port 4200. Internet access may be needed for the initial
dependency installation, but all application data operations run locally.

## Sample accounts

All accounts use the intentionally public demo password **`Demo123!`**.

| Role | Username | Demo purpose |
| --- | --- | --- |
| Super Admin | `demo.superadmin` | All modules and setup |
| Admin | `demo.admin` | All modules and setup |
| Registrar | `demo.registrar` | Student records, enrollment, academic setup, schedules |
| Teacher | `demo.teacher` | Attendance and assigned Mathematics grades |
| Adviser | `demo.adviser` | Attendance and Integrity section grade review |
| Principal | `demo.principal` | Grading review, reports, dashboard |
| Staff | `demo.staff` | Attendance and general read-only screens |

The existing navigation also gives every authenticated role read access to
Dashboard, Students, Enrollment, and Academic setup. Write controls and the local
adapter restrict mutations by role. These are the seven roles defined by the
original application; there are no Student or Parent accounts in its role set.

For the presentation walkthrough, sample scan IDs, reset behavior, and limitations,
see [Client demo guide](docs/client-demo-guide.md).

## GitHub Pages hosting

The demo includes an automatic deployment workflow for a separate
`SchoolManagement-Demo` repository. See
[GitHub Pages implementation and deployment instructions](docs/github-pages-deployment.md)
for exporting only the demo, creating the repository, enabling Pages, and publishing.
No API/database server is needed. The demo is hosted at
[School Management Demo](https://paopitz.github.io/SchoolManagement-Demo/).

## Build and test

From the copied frontend directory:

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

Build output is under `SchoolManagement.frontend\dist\SchoolManagement.frontend\browser`.
The demo uses hash routing (for example `/#/settings`), so static hosting does not
require SPA fallback rules for module refreshes. This demo is Angular-only and does not need a .NET `.sln` file.
It is deliberately not added to the original backend solution.

## Safety and isolation

- Keep this repository demo-only. Never push the full-source project's branches
  or history here, even under a separate branch name.
- All records and passwords are fictional samples, not copied database data.
- `DemoData` owns typed sample arrays in browser memory.
- `DemoBackend` replaces Angular's terminal `HttpBackend`. Service calls keep their
  existing interfaces but are handled entirely in-process: no HTTP request reaches
  `/demo-api`, the original API, or a database.
- Unknown routes and external URLs are rejected rather than forwarded.
- Both production and development builds use the local adapter; there is no
  switch that enables the real API.
- The demo uses `sms_demo_session` in session storage, separate from the original
  application's `sms_session`.
- Never use this client-only login or these public sample credentials in production.
