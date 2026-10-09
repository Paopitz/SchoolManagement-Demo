# Client Demo Guide

## Account quick reference

Use password **`Demo123!`** with any of these usernames:

| Username | Role | Linked fictional teacher |
| --- | --- | --- |
| `demo.superadmin` | Super Admin | None |
| `demo.admin` | Admin | None |
| `demo.registrar` | Registrar | None |
| `demo.teacher` | Teacher | Maria Santos / `EMP-DEMO-001` |
| `demo.adviser` | Adviser | Jose Reyes / `EMP-DEMO-002` |
| `demo.principal` | Principal | None |
| `demo.staff` | Staff | None |

These credentials are public sample fixtures. They are not production accounts.

## Suggested presentation

1. Sign in as `demo.admin`. The demo-only notice is always visible.
2. Show Dashboard: enrollment totals and attendance summaries are computed from
   the same sample arrays used by the other screens.
3. Open Students: search `DEMO-001`, add a fictional student, then edit it.
4. Open Academic setup: show school years, departments, grade levels, strands,
   subjects, rooms, sections, and subject assignments.
5. Open Enrollment: student `DEMO-010` has a pending enrollment ready to confirm.
   Student `DEMO-011` is active and has no enrollment, so it can be used to show
   creating a new enrollment. Select its section and subjects, then confirm.
6. Open Schedules: show sample Monday classes. Create a class in an unused time
   slot; overlapping room, teacher, or section schedules show a conflict error.
7. Open Attendance: seeded records are dated **today** using the browser's local
   date. Scan `DEMO-001` (or fictional LRN `990000000001`) for a student, and
   `EMP-DEMO-001` for a teacher. Existing morning/teacher records already have
   time-ins, so a subsequent scan records time-out; a new afternoon student session
   creates its own time-in. Invalid IDs display errors.
8. Open Grading: select Grade 7 - Quarter 1 and section Integrity. Sample records
   include Draft, Submitted, UnderReview, Approved, and Finalized states. For a
   draft, enter all component scores, save, submit, review, approve, and finalize.
   To demonstrate creating a new draft, create Quarter 2 in Templates & periods,
   then select that period, a section, student, and subject.
9. Open Reports: use today's date range for attendance, and export CSV or HTML.
   Downloads are generated locally from current sample arrays.
10. Show Teachers, User Management, and Settings. New demo users, role changes,
    password changes, teacher links, and settings work for the current page lifetime.
11. Sign out, then use Teacher, Adviser, Principal, Registrar, and Staff accounts
    to demonstrate role-dependent navigation and controls.

## Role behavior

- Admin and Super Admin can use all screens.
- Registrar can edit students, enrollment, academic setup, and schedules.
- Teacher grades are limited to Maria Santos's assigned Mathematics subjects.
- Adviser grades are limited to the Integrity section, advised by Jose Reyes.
- Principal can review grades and view/export reports.
- Teacher, Adviser, Staff, and administrators can record attendance.
- Attendance rule configuration, grading configuration, accounts, teachers, and
  settings require Admin or Super Admin.
- Direct navigation to a hidden module redirects to Dashboard. Disallowed local
  data operations return explicit demo errors.
- Unlike the original four-role dashboard selector, this demo shows its fictional
  dashboard summaries for all seven sample roles.

## Reset and persistence

- Data is stored only in in-memory arrays. Reloading the page resets all records,
  account/password changes, settings, and workflow changes to the sample fixtures.
- Signing out does not reset the arrays, so you can change roles to demonstrate
  the same workflow in the same tab without losing changes.
- A fictional session is kept in session storage to preserve the selected sample
  login on reload; it is separate from the production application's session.
- A newly created user is lost on reload and must be recreated.
- Each tab has its own data state. Nothing is written to SQL Server or shared
  between browsers.

## Important limitations

This is a UI/workflow simulation, not a replacement for production business logic
or security. It does not provide genuine authentication, encrypted passwords,
audit logs, durable storage, multi-user synchronization, notifications, backups,
or backend integrations.

The grading demonstration uses a simple weighted percentage:
`sum(rawScore / maximumScore * componentWeight)`, rounded to two decimal places.
It does not certify the production grading/transmutation rules. Scores cannot be
saved after leaving Draft; only administrators can reopen Finalized grades, and a
reason is required. The copied grade-entry UI does not preload saved raw scores.

The copied frontend intentionally retains its screen layout and service method
names. Some original explanatory text mentions an API; in this demo that refers
only to the local adapter. The banner, login notice, and documentation identify
this as a simulation.

For setup, build instructions, and architecture, see [Demo README](../README.md).
