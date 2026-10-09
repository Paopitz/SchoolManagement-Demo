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
