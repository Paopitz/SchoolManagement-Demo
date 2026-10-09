# GitHub Pages Deployment

## What was implemented

This demo is prepared for a separate GitHub repository named
**SchoolManagement-Demo**. GitHub Pages serves the compiled Angular website;
it is not an API or database server.

1. The demo's Angular router uses `withHashLocation()`. Links look like
   `https://YOUR-USERNAME.github.io/SchoolManagement-Demo/#/dashboard`.
   The fragment is handled by Angular rather than GitHub's web server, so
   refreshing a module does not require SPA rewrite rules or a custom 404 page.
   Local development now also uses hash routes, for example
   `http://localhost:4300/#/login`.
2. [deploy-pages.yml](../.github/workflows/deploy-pages.yml) runs on pushes to
   `main` and can also be started manually from GitHub Actions.
3. The workflow installs the locked dependencies with Node.js 24, builds the
   frontend, and reads the correct base path from GitHub Pages configuration.
   Assets work under `/SchoolManagement-Demo/`, and the workflow can also support
   a root site/custom domain without hard-coding the repository name.
4. Only `SchoolManagement.frontend/dist/SchoolManagement.frontend/browser`
   is uploaded as the Pages artifact. Source files, backend configuration,
   node_modules, and documentation are not part of the deployed website.
5. Deployment uses GitHub's built-in token and OIDC permissions. No personal
   access token or repository secret is required by the workflow.
6. No overall test suite runs in this deployment workflow. A failed install or
   build prevents deployment.

The local demo adapter remains enabled in both build configurations. All accounts
and records are fictional. Hosting does not add persistent storage or real login.

## 1. Create a separate repository

On GitHub, create a **public**, empty repository named `SchoolManagement-Demo`.
Do not initialize it with a README, license, or gitignore for the commands below.

Public hosting makes the demo and its sample accounts available to anyone who
knows the URL. Use fictional information only. Private repository Pages support
and private site access depend on your GitHub plan; do not assume a private
repository makes the Pages website private.

## 2. Export only the demo folder

The workflow must be located at `.github/workflows` in the **new repository root**.
Do not upload the parent `SchoolManagement_Master` repository. Its nested demo
workflow is a deployment template until the demo is exported as its own repository.

Run in PowerShell. Choose a new destination that does not already exist:

```powershell
$source = 'C:\Users\paulo\source\repos\SchoolManagement_Master\SchoolManagement.Demo'
$destination = 'C:\Users\paulo\source\repos\SchoolManagement-Demo'
if (Test-Path $destination) { throw 'Destination exists. Choose a new folder or inspect it before copying.' }
robocopy $source $destination /E /XD node_modules dist .angular .git
if ($LASTEXITCODE -ge 8) { throw 'Copy failed.' }
Set-Location $destination
```

Robocopy includes `.github` and the copied frontend's `.gitignore`, while excluding
generated dependencies, build/cache directories, and any Git metadata.

Expected new repository layout:

```text
SchoolManagement-Demo
  .github
    workflows
      deploy-pages.yml
  docs
    github-pages-deployment.md
    client-demo-guide.md
  SchoolManagement.frontend
    src
    public
    angular.json
    package.json
    package-lock.json
    .gitignore
  README.md
```

## 3. Push the exported demo

Git must be installed and available on PATH. Replace `YOUR-USERNAME` below with
your actual GitHub username. Sign in using your normal Git/GitHub authentication;
do not paste tokens into source files or remote URLs.

```powershell
git init -b main
git add .
git status --short
git diff --cached --stat
```

Review the staged files. There should be no API project, SQL scripts, real account
data, tokens, environment secrets, node_modules, or dist directory.

Then push:

```powershell
git commit -m "Set up standalone school management client demo" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git remote add origin https://github.com/YOUR-USERNAME/SchoolManagement-Demo.git
git push -u origin main
```

## 4. Enable Pages and deploy

1. Open the new repository on GitHub.
2. Go to **Settings > Pages > Build and deployment**.
3. Set **Source** to **GitHub Actions**.
4. Go to **Actions > Deploy standalone demo to GitHub Pages**.
5. Select **Run workflow**, choose `main`, then run it. This also retries the
   initial push if its workflow failed before Pages was configured.
6. Wait for both `build` and `deploy` to finish successfully.
7. Open the published URL shown in the deployment environment or Settings > Pages.

Expected URL:

```text
https://YOUR-USERNAME.github.io/SchoolManagement-Demo/
```

Login with `demo.admin` / `Demo123!`. All seven accounts are listed in the
[Demo README](../README.md).

## 5. Quick verification

- Open the published site and sign in.
- Open Students or Settings, then refresh: the module should still open without
  a GitHub 404. The URL should contain `#/students` or `#/settings`.
- Verify the demo-only banner and sample records.
- Confirm no API requests are sent to localhost or a real backend.
- Remember that refreshing resets sample data.

## Local build equivalent

From the exported frontend folder:

```powershell
npm.cmd ci
npm.cmd run build -- --base-href /SchoolManagement-Demo/
```

The output's `index.html` should contain
`<base href="/SchoolManagement-Demo/">`. This output must be hosted at that
path, not opened directly as a filesystem file.

## Updating the hosted demo

Edit the exported repository and push to `main`. GitHub Actions rebuilds and
deploys it automatically. Changes in the original nested demo folder do not
automatically update the exported repository; copy only the intended changed
source/documentation files into the exported repository, review the diff, then
commit and push.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `configure-pages` fails | Set Settings > Pages > Source to GitHub Actions, then rerun the workflow. |
| Blank page or asset 404 | Confirm the Pages base path, build step, and uploaded browser directory. |
| Refresh gives 404 | Use the new hash links (`/#/settings`), not old `/settings` links. |
| Deployment permission error | Confirm Actions are enabled and repository/organization policies permit Pages and the workflow permissions. |
| `npm.ps1` blocked on Windows | Use `npm.cmd`, as shown above. |
| Git command not found | Install Git for Windows or use your Git-enabled terminal. |
| Old website after push | Wait for the latest deployment to succeed, then refresh the browser. |

## Implementation status

The routing and deployment workflow are implemented locally. Actual publication
requires creating the repository, enabling Pages, and pushing the exported demo.
A local build does not prove that GitHub deployment succeeded; the Actions result
and live URL are the final confirmation.
