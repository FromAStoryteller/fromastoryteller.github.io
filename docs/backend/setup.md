# FAS setup: Windows, local development, hosted development and production

Work through one section at a time. You need not deploy the website to complete
the database setup. Commands below are for PowerShell in the FAS website folder.
Replace any ALL_CAPS placeholder with your own value; never paste secrets into chat.

## 1. Get the prepared files

Review the backend PR and merge it when ready, then open your FAS website folder
in File Explorer. This is the folder containing `package.json`, `stories`,
`systems` and the new `supabase` directory. Right-click in it and choose Open in
Terminal. If you do not have a local copy, install Git for Windows and run:

```powershell
git clone https://github.com/FromAStoryteller/fromastoryteller.github.io.git
Set-Location fromastoryteller.github.io
```

Before the PR is merged, fetch it using the branch instead:

```powershell
git fetch origin
git switch --track origin/fas/community-v1-backend
```

If that branch already exists locally, use `git switch fas/community-v1-backend`.
Do not switch with unresolved local edits. Check `git status` first. These commands
do not publish your website or change PMP.

## 2. Install the local tools

Install a supported Node.js release, version 22.12 or newer (the existing website
needs this), and [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
Follow Docker's Windows requirements and use its WSL 2 Linux-container backend.
If WSL is missing, open PowerShell as administrator and run `wsl --install`, then
restart if prompted. Run `wsl --update` if Docker requests it. Open Docker Desktop,
finish its first-run screens, and wait for the engine to report Running.
Open a new normal PowerShell window in the FAS folder, then check:

```powershell
node --version
docker version
npx --yes supabase@2.120.0 --version
```

Expected: a Node version at least 22.12, both Docker Client and Server sections,
and Supabase CLI version 2.120.0. This guide pins the CLI without changing the
website's package dependencies. The first run downloads the CLI. If `npm.ps1`
or `npx.ps1` is blocked by PowerShell, use `npm.cmd`/`npx.cmd` instead; there is
no need to change your computer's execution policy.

## 3. Start the local FAS backend

The `supabase/config.toml` already exists; do not run `supabase init` over it.

```powershell
npx --yes supabase@2.120.0 start
npx --yes supabase@2.120.0 status
```

Allow Docker image downloads to finish. Open `http://127.0.0.1:55323` in your
browser: this is local Supabase Studio. In Table Editor you should see profiles,
user_roles, invites, stories, story_assets and moderation_log. Storage should show
`fas-story-images` as private with 5 MiB/image MIME restrictions. Tables begin empty.
The Auth identity tables and services come from Supabase itself.

To rebuild **only this disposable local database** from migrations:

```powershell
npx --yes supabase@2.120.0 db reset --local
npx --yes supabase@2.120.0 db lint --local --level warning
```

Reset deletes your local FAS data and replays the migrations. Do it now before
entering anything valuable. Never use `--linked` or a production connection with
reset. Check errors rather than continuing if any command fails.

## 4. Run the access tests on the real local stack

Confirm this FAS database container is running:

```powershell
docker ps --filter "name=supabase_db_fas-community-v1" --format "{{.Names}}"
```

Expected container name: `supabase_db_fas-community-v1`. If the CLI reports another
name, inspect `docker ps` and identify the **FAS** database before substituting it.
Run the test file against that LOCAL container only:

```powershell
Get-Content -Raw supabase/tests/access.sql | docker exec -i supabase_db_fas-community-v1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -
```

Expected final result: `PASS: FAS access and workflow assertions; fixtures rolled back`.
Any `ERROR` is a failure, even if earlier lines succeeded. The test uses temporary
synthetic accounts inside a transaction and rolls them back. It checks anonymous,
owner, other-member, uninvited and admin behavior; invite matching/reuse; moderation
history; and storage-row policies. It does not upload actual image bytes or test
email delivery. Do not run this fixture script on hosted dev or production.

## 5. Set up your local environment file

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Use the API URL from `status` for `VITE_FAS_SUPABASE_URL` (normally
`http://127.0.0.1:55321`) and its publishable key (or legacy anon key) for
`VITE_FAS_SUPABASE_PUBLISHABLE_KEY`. Save the file. Git ignores `.env.local`.
Never copy Secret/service_role, database password or access token into it.
This prepares the configuration; the current website has no community client yet.

To preview the existing website, independently of the backend:

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

Open the printed localhost URL, normally port 5173. Existing static stories should
look unchanged. If Vite chooses a different port, update only local Auth redirect
settings before developing an Auth UI. Use Ctrl+C to stop the website server.
Use `npx --yes supabase@2.120.0 stop` to stop FAS containers while keeping local data.
Do not use `stop --all` or `stop --no-backup` here.

## 6. Create hosted FAS development

1. Sign into [Supabase](https://supabase.com/dashboard) and enable account MFA.
2. Choose your FAS organization, then New project. Name it `fas-community-dev`.
   Choose an appropriate region and save a strong, unique DB password in a password
   manager. Do not select any PMP project. Wait for provisioning to complete.
3. Open Project Settings and record the project reference (also visible in the
   Dashboard URL). In SQL Editor run `show server_version;`. Match the local
   `db.major_version` in config.toml (currently 17); if different, align/test locally
   before pushing. Do not change a database engine version blindly.
4. In your FAS PowerShell window, run these commands one at a time:

```powershell
npx --yes supabase@2.120.0 login
npx --yes supabase@2.120.0 projects list
npx --yes supabase@2.120.0 link --project-ref YOUR_FAS_DEV_PROJECT_REF
npx --yes supabase@2.120.0 migration list --linked
npx --yes supabase@2.120.0 db push --linked --dry-run
```

The login opens a browser; authenticate yourself. Enter the DB password only in
the CLI prompt. Confirm the project reference matches `fas-community-dev`, with
no existing custom tables. The dry run should list exactly the three initial FAS
migrations. If it lists unexpected migrations, or tables already exist, stop and
inspect/baseline that project instead of pushing. Once those checks match:

```powershell
npx --yes supabase@2.120.0 db push --linked
npx --yes supabase@2.120.0 migration list --linked
```

Expected: all three migrations applied locally/remotely. Open dev Table Editor
and Storage and check the same tables/private bucket as in local Studio.

## 7. Hosted Auth and first administrator

Hosted settings are not applied by config.toml. In the dev Dashboard:

1. In Authentication settings, enable email/password and email confirmation.
   Disable anonymous sign-in. Configure a supported SMTP provider before relying
   on invitations/password resets; the built-in email service has restrictions.
2. Keep public signups disabled for an invite-only rollout. An admin uses Auth's
   Invite user action to invite an account. Auth's invitation establishes the
   login account; the custom FAS invite grants community membership separately.
   Alternatively enable signups intentionally later: uninvited accounts still
   cannot create stories because they have no FAS role.
3. Set Site URL and exact redirect allowlist to the actual dev community frontend
   URL when it exists. The existing website has no Auth callback/acceptance page;
   do not pretend email links complete that workflow yet. For early account
   creation, Auth Users -> Add user can create your own confirmed test account
   with a strong password kept private. Never manually insert passwords in SQL.
4. Copy your account's UUID from Auth Users. In this project's SQL Editor run the
   following after replacing the UUID placeholder:

```sql
insert into public.user_roles(user_id, role)
select id, 'admin'::public.community_role
from public.profiles
where id = 'YOUR_AUTH_USER_UUID'::uuid
on conflict (user_id) do update set role = excluded.role;
```

Verify exactly your profile has admin role in Table Editor. This trusted bootstrap
is necessary because the first admin cannot yet invite themselves. Only trusted
operators may grant staff roles; ordinary browsers have no such permission.
Use synthetic accounts/data in dev. UI integration will call the documented RPCs
with a signed-in user's session, not from SQL Editor impersonating a browser.

## 8. Create production separately

1. Complete local tests, dev schema checks and a backup/restore rehearsal first.
2. Create a **new** `fas-community-prod` project with its own password/keys, in the
   chosen region. Verify its PostgreSQL major version and that it is empty.
3. Prefer a separate clean FAS checkout for production so a dev link cannot be
   mistaken for prod. Check out the reviewed commit that contains these files.
4. Run `projects list`, link that checkout to `YOUR_FAS_PROD_PROJECT_REF`, inspect
   `migration list --linked` and `db push --linked --dry-run`, then run
   `db push --linked` after checking its target and three migration filenames.
5. Repeat hosted Auth/SMTP and your own first-admin bootstrap for prod. Use exact
   production frontend redirects when the community frontend is ready; no broad
   wildcards. Never reuse development accounts, invites or admin UUIDs.
6. Set production URL/publishable key in the future frontend's production settings.
   Keep server secret keys in the hosting service's secret store. This PR does not
   deploy or connect that frontend and does not change live site hosting.
7. Enable/check database backups appropriate to the plan, export an initial
   backup, and establish separate image backups following the restore guide.

Before inviting real users, test Auth email/redirects, signed-in role checks,
draft creation, real image upload/download/MIME/size limits, submission,
moderation, published reads and archival through the actual future client.
SQL tests alone do not establish those service/UI flows. Add server image validation
and decide privacy/retention policies before launch. This is a database setup
milestone; the working community application remains a separate task.

Official instructions: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started),
[Docker Windows setup](https://docs.docker.com/desktop/setup/install/windows-install/),
[database migrations](https://supabase.com/docs/guides/deployment/database-migrations).
