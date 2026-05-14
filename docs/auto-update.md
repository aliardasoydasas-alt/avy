# AVY Auto-update

AVY uses `electron-updater` with Electron Builder. It can publish through a generic URL or GitHub Releases.

## What users need

- Install the NSIS setup build: `AVY-Setup-<version>.exe`
- Keep using the installed AVY app normally
- AVY checks for updates automatically and can also check manually from the profile menu

## What you need to publish

Build with an update URL:

```powershell
$env:AVY_UPDATE_URL='https://updates.example.com/avy/win'
npm run dist
```

You can also place `AVY_UPDATE_URL` inside `.env` before running `npm run dist`.

Then upload the generated artifacts from `release/<version>/` to that update folder.

Recommended files:

- `AVY-Setup-<version>.exe`
- `AVY-Setup-<version>.exe.blockmap`
- `latest.yml` when the build was produced with `AVY_UPDATE_URL`

If you use the same Supabase project as the social backend, you can publish directly to a public storage bucket:

```text
https://<project-ref>.supabase.co/storage/v1/object/public/avy-updates/win
```

After running `npm run dist`, publish the generated installer metadata with:

```powershell
npm run publish:update:supabase
```

The publish script uploads `latest.yml`, the Windows setup `.exe`, and the `.blockmap`.

Required Supabase storage policies:

```sql
create policy "Authenticated users can upload AVY updates"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avy-updates');

create policy "Authenticated users can update AVY updates"
on storage.objects
for update
to authenticated
using (bucket_id = 'avy-updates')
with check (bucket_id = 'avy-updates');
```

## Hosting expectation

The generic provider expects a stable base URL, for example:

```text
https://updates.example.com/avy/win/
```

That folder should contain the latest metadata plus the referenced installer files.

## GitHub Releases flow

For GitHub Releases, place these values in `.env`:

```text
GITHUB_REPOSITORY=owner/repo
GITHUB_TOKEN=github_personal_access_token
```

Then build and publish:

```powershell
npm run dist
npm run publish:update:github
```

Electron Builder's GitHub provider is supported for auto-update, and GitHub's release APIs support creating a release plus uploading assets. Sources:
- [electron-builder publish docs](https://www.electron.build/publish.html)
- [electron-builder auto-update docs](https://www.electron.build/auto-update.html)
- [GitHub releases API](https://docs.github.com/rest/reference/releases)
- [GitHub release asset upload API](https://docs.github.com/en/rest/releases/assets)

## Practical note

If a build was created without `AVY_UPDATE_URL`, auto-update stays disabled for that installer. Rebuild that version with the update URL configured before distributing it.
