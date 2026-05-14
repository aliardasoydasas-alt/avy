import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const workspaceRoot = process.cwd()

const readDotEnv = () => {
  const envPath = path.join(workspaceRoot, '.env')

  if (!fs.existsSync(envPath)) {
    return {}
  }

  return fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim()

      if (!trimmed || trimmed.startsWith('#')) {
        return accumulator
      }

      const separatorIndex = trimmed.indexOf('=')

      if (separatorIndex === -1) {
        return accumulator
      }

      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1')

      if (key) {
        accumulator[key] = value
      }

      return accumulator
    }, {})
}

const env = readDotEnv()
const repositorySlug = (process.env.GITHUB_REPOSITORY || env.GITHUB_REPOSITORY || '').trim()
const githubToken = (process.env.GITHUB_TOKEN || env.GITHUB_TOKEN || '').trim()
const [owner, repo] = repositorySlug.split('/')

if (!owner || !repo) {
  console.error('GITHUB_REPOSITORY .env icinde owner/repo formatinda dolu olmali.')
  process.exit(1)
}

if (!githubToken) {
  console.error('GITHUB_TOKEN .env icinde dolu olmali.')
  process.exit(1)
}

const packageJson = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'))
const version = packageJson.version
const tagName = `v${version}`
const releaseDir = path.join(workspaceRoot, 'release', version)
const assetNames = [
  `AVY-Setup-${version}.exe`,
  `AVY-Setup-${version}.exe.blockmap`,
  'latest.yml',
  `AVY-${version}-Portable.exe`
]

for (const assetName of assetNames) {
  const assetPath = path.join(releaseDir, assetName)

  if (!fs.existsSync(assetPath)) {
    console.error(`Eksik release dosyasi: ${assetPath}`)
    process.exit(1)
  }
}

const defaultHeaders = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${githubToken}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'AVY-Release-Publisher'
}

const githubApi = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...defaultHeaders,
      ...(init.headers ?? {})
    }
  })

  if (response.status === 204) {
    return null
  }

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payload?.message || `GitHub API hatasi: ${response.status}`)
  }

  return payload
}

const findRelease = async () => {
  try {
    return await githubApi(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tagName}`)
  } catch (error) {
    if (String(error.message).includes('Not Found')) {
      return null
    }

    throw error
  }
}

const createRelease = async () =>
  githubApi(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tag_name: tagName,
      name: `AVY ${version}`,
      draft: false,
      prerelease: false,
      generate_release_notes: true
    })
  })

const deleteAssetIfExists = async (release, assetName) => {
  const existingAsset = release.assets?.find((asset) => asset.name === assetName)

  if (!existingAsset) {
    return
  }

  await githubApi(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
    method: 'DELETE'
  })
}

const inferContentType = (assetName) => {
  if (assetName.endsWith('.yml')) {
    return 'text/yaml'
  }

  if (assetName.endsWith('.blockmap')) {
    return 'application/octet-stream'
  }

  return 'application/vnd.microsoft.portable-executable'
}

const uploadAsset = async (uploadUrl, assetName) => {
  const uploadEndpoint = uploadUrl.replace('{?name,label}', `?name=${encodeURIComponent(assetName)}`)
  const assetBuffer = fs.readFileSync(path.join(releaseDir, assetName))
  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      'Content-Type': inferContentType(assetName),
      'Content-Length': String(assetBuffer.length)
    },
    body: assetBuffer
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payload?.message || `Asset upload hatasi: ${response.status}`)
  }

  return payload
}

const release = (await findRelease()) ?? (await createRelease())

for (const assetName of assetNames) {
  await deleteAssetIfExists(release, assetName)
  await uploadAsset(release.upload_url, assetName)
}

console.log(`GitHub release yayini tamamlandi: https://github.com/${owner}/${repo}/releases/tag/${tagName}`)
