const fs = require('fs')
const path = require('path')

const readDotEnv = () => {
  const envPath = path.join(__dirname, '.env')

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

const localEnv = readDotEnv()
const updateUrl = (process.env.AVY_UPDATE_URL || localEnv.AVY_UPDATE_URL || '').trim()
const githubRepository = (process.env.GITHUB_REPOSITORY || localEnv.GITHUB_REPOSITORY || '').trim()
const githubOwner = (process.env.GITHUB_OWNER || localEnv.GITHUB_OWNER || '').trim()
const githubRepo = (process.env.GITHUB_REPO || localEnv.GITHUB_REPO || '').trim()

const resolveGithubPublish = () => {
  if (githubOwner && githubRepo) {
    return {
      provider: 'github',
      owner: githubOwner,
      repo: githubRepo,
      releaseType: 'release'
    }
  }

  if (!githubRepository || !githubRepository.includes('/')) {
    return null
  }

  const [owner, repo] = githubRepository.split('/')

  if (!owner || !repo) {
    return null
  }

  return {
    provider: 'github',
    owner,
    repo,
    releaseType: 'release'
  }
}

const config = {
  appId: 'com.avy.marketterminal',
  productName: 'AVY',
  asar: true,
  directories: {
    output: 'release/${version}',
    buildResources: 'build'
  },
  files: ['out/**/*', 'package.json'],
  artifactName: '${productName}-Setup-${version}.${ext}',
  win: {
    icon: 'build/avy-logo.ico',
    signAndEditExecutable: false,
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      },
      {
        target: 'portable',
        arch: ['x64']
      }
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    shortcutName: 'AVY',
    installerIcon: 'build/avy-logo.ico',
    uninstallerIcon: 'build/avy-logo.ico',
    installerHeaderIcon: 'build/avy-logo.ico'
  },
  portable: {
    artifactName: '${productName}-${version}-Portable.${ext}'
  }
}

const githubPublish = resolveGithubPublish()

if (githubPublish) {
  config.publish = [githubPublish]
} else if (updateUrl) {
  config.publish = [
    {
      provider: 'generic',
      url: updateUrl
    }
  ]
}

module.exports = config
