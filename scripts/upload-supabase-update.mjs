import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

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

const extractSessionObjects = (filePath) => {
  const content = fs.readFileSync(filePath, 'latin1')
  const marker = '{"access_token":"'
  const sessions = []
  let startIndex = content.indexOf(marker)

  while (startIndex !== -1) {
    let cursor = startIndex
    let depth = 0
    let inString = false
    let escaped = false
    let endIndex = -1

    while (cursor < content.length) {
      const character = content[cursor]

      if (inString) {
        if (escaped) {
          escaped = false
        } else if (character === '\\') {
          escaped = true
        } else if (character === '"') {
          inString = false
        }
      } else if (character === '"') {
        inString = true
      } else if (character === '{') {
        depth += 1
      } else if (character === '}') {
        depth -= 1

        if (depth === 0) {
          endIndex = cursor + 1
          break
        }
      }

      cursor += 1
    }

    if (endIndex === -1) {
      break
    }

    const candidate = content.slice(startIndex, endIndex)

    try {
      const parsed = JSON.parse(candidate)

      if (parsed.access_token && parsed.refresh_token) {
        sessions.push(parsed)
      }
    } catch {
      // Ignore malformed fragments inside Chromium LevelDB files.
    }

    startIndex = content.indexOf(marker, endIndex)
  }

  return sessions
}

const loadLatestSupabaseSession = () => {
  const levelDbDir = path.join(process.env.APPDATA ?? '', 'avy-terminal', 'Local Storage', 'leveldb')

  if (!fs.existsSync(levelDbDir)) {
    throw new Error('AVY oturum verisi bulunamadi. Uygulamaya once giris yapman gerekiyor.')
  }

  const sessions = fs
    .readdirSync(levelDbDir)
    .map((name) => path.join(levelDbDir, name))
    .flatMap(extractSessionObjects)
    .filter((session) => typeof session.expires_at === 'number' || typeof session.expires_in === 'number')

  if (!sessions.length) {
    throw new Error('Supabase oturumu bulunamadi. Uygulamaya giris yapip tekrar dene.')
  }

  sessions.sort((left, right) => {
    const leftExpiry = left.expires_at ?? 0
    const rightExpiry = right.expires_at ?? 0
    return rightExpiry - leftExpiry
  })

  return sessions[0]
}

const parseStorageTarget = (updateUrl) => {
  const parsed = new URL(updateUrl)
  const match = parsed.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/?(.*)$/)

  if (!match) {
    throw new Error('AVY_UPDATE_URL Supabase public storage formatinda degil.')
  }

  const [, bucket, prefix] = match

  return {
    bucket,
    prefix: prefix.replace(/^\/+|\/+$/g, '')
  }
}

const uploadFile = async (client, bucket, destination, sourcePath, contentType) => {
  const payload = fs.readFileSync(sourcePath)
  const result = await client.storage.from(bucket).upload(destination, payload, {
    contentType,
    upsert: true
  })

  if (result.error) {
    throw result.error
  }
}

const main = async () => {
  const env = readDotEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim()
  const supabaseKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim()
  const updateUrl = env.AVY_UPDATE_URL?.trim()

  if (!supabaseUrl || !supabaseKey || !updateUrl) {
    throw new Error('VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY ve AVY_UPDATE_URL .env icinde dolu olmali.')
  }

  const { bucket, prefix } = parseStorageTarget(updateUrl)
  const version = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')).version
  const releaseDir = path.join(workspaceRoot, 'release', version)
  const installerName = `AVY-Setup-${version}.exe`
  const blockmapName = `${installerName}.blockmap`
  const latestName = 'latest.yml'

  for (const fileName of [installerName, blockmapName, latestName]) {
    const fullPath = path.join(releaseDir, fileName)

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Beklenen update dosyasi bulunamadi: ${fullPath}`)
    }
  }

  const session = loadLatestSupabaseSession()
  const client = createClient(supabaseUrl, supabaseKey)
  const { error: sessionError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  })

  if (sessionError) {
    throw sessionError
  }

  const resolveTarget = (name) => (prefix ? `${prefix}/${name}` : name)

  try {
    await uploadFile(
      client,
      bucket,
      resolveTarget(installerName),
      path.join(releaseDir, installerName),
      'application/vnd.microsoft.portable-executable'
    )
    await uploadFile(
      client,
      bucket,
      resolveTarget(blockmapName),
      path.join(releaseDir, blockmapName),
      'application/octet-stream'
    )
    await uploadFile(
      client,
      bucket,
      resolveTarget(latestName),
      path.join(releaseDir, latestName),
      'text/yaml'
    )
  } catch (error) {
    if (error?.statusCode === '403' || String(error?.message).includes('row-level security')) {
      throw new Error(
        [
          'Supabase storage RLS yukleme iznini engelliyor.',
          'SQL Editor icin gereken policy:',
          '',
          "create policy \"Authenticated users can upload AVY updates\"",
          'on storage.objects',
          'for insert',
          'to authenticated',
          `with check (bucket_id = '${bucket}');`,
          '',
          "create policy \"Authenticated users can update AVY updates\"",
          'on storage.objects',
          'for update',
          'to authenticated',
          `using (bucket_id = '${bucket}')`,
          `with check (bucket_id = '${bucket}');`
        ].join('\n')
      )
    }

    throw error
  }

  console.log(`Supabase update yayini tamamlandi: ${updateUrl}`)
  console.log(`Kurulum dosyasi: ${updateUrl}/${installerName}`)
  console.log(`Metadata: ${updateUrl}/${latestName}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
