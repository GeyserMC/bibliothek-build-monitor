const fs = require('fs')
const path = require('path')
const axios = require('axios')
const crypto = require('crypto')
const chokidar = require('chokidar')

require('log-timestamp')
require('dotenv').config()

const cli = require('./bibliothek-cli')

const uploadFolder = process.env.INPUT_DIR || './uploads/'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// Start the watcher ignoring hidden files and the repo folder
const watcher = chokidar.watch(uploadFolder, { ignored: /(^|[\/\\])(\..|repo)/, persistent: true })

watcher.on('error', function (e) {
  console.error(e)
})

if (process.env.NODE_ENV !== 'production') {
  watcher.on('raw', function (event, path, details) {
    console.debug('Raw event info:', event, path, details)
  })
}

console.log(`Watching for file changes on ${uploadFolder}`)

watcher.on('add', async (filepath) => {
  const filename = path.basename(filepath)
  const folder = path.dirname(filepath)

  // Make sure the path is not a directory
  if (fs.lstatSync(filepath).isDirectory()) return

  if (filename.endsWith('.jar')) {
    console.log(`${filename} created`)
  } else if (filename === 'metadata.json') {
    console.log('Metadata file uploaded, processing...')
    while (true) {
      // Keep trying to read the file until it's available
      await sleep(1000)
      try {
        const metadata = JSON.parse(fs.readFileSync(filepath, 'utf8'))
        console.log(metadata)

        handleMetadata(folder, metadata)
        return
        // const files = fs.walkSync('./')
      } catch (e) { }
    }
  }
})

async function handleMetadata (folder, metadata) {
  let projectFriendly = metadata.project.charAt(0).toUpperCase() + metadata.project.slice(1)
  let repoUrl = process.env.ORG + projectFriendly
  const versionGroup = metadata.version.split('.').slice(0, 2).join('.')
  const files = fs.readdirSync(folder).filter(f => f !== 'metadata.json')

  // Use the GitHub API to get the project name if it exists
  const repoData = await axios.get(repoUrl.replace('github.com/', 'api.github.com/repos/')).then((res) => res.data).catch((e) => null)
  if (repoData && 'name' in repoData) {
    projectFriendly = repoData.name
    repoUrl = repoData.html_url
  }

  console.log(`Project: ${projectFriendly} (${metadata.project})`)
  console.log(`Version: ${metadata.version}`)
  console.log(`Version Group: ${versionGroup}`)
  console.log(`Build: ${metadata.id}`)
  console.log(`Commit: ${metadata.commit}`)
  console.log(`Repo: ${repoUrl}`)
  console.log(`Files: ${files}`)

  const repoPath = path.join(folder, 'repo')
  console.log(`Cloning repo to '${repoPath}'`)
  await execShellCommand(`git clone -n "${repoUrl}" "${repoPath}"`)
  await execShellCommand(`git -C "${repoPath}" fetch`)
  console.log(`Checking out commit '${metadata.commit}'`)
  await execShellCommand(`git -C "${repoPath}" checkout "${metadata.commit}"`)

  console.log('Getting SHA256 of files')
  const downloads = []
  for (const file of files) {
    const filePath = path.join(folder, file)
    if (fs.lstatSync(filePath).isDirectory()) {
      // Ignore directories
      continue
    }

    let id = file.split('.')[0].split('-').slice(1).join().toLowerCase()
    if (id === '') {
      // Fallback to the file name if no id is found
      id = file.split('.')[0].toLowerCase()
    }

    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    downloads.push(`${id}:${filePath}:${hash}:${file}`)
  }

  console.log(downloads)

  console.log('Inserting build into database')
  await cli.insert({
    projectName: metadata.project,
    projectFriendlyName: projectFriendly,
    versionGroupName: versionGroup,
    versionName: metadata.version,
    buildNumber: metadata.id,
    repositoryPath: repoPath,
    downloads
  })

  console.log(`Cleaning up ${folder}`)
  fs.rmSync(folder, { recursive: true, force: true })
}

// From: https://ali-dev.medium.com/how-to-use-promise-with-exec-in-node-js-a39c4d7bbf77
function execShellCommand (cmd) {
  const exec = require('child_process').exec
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error)
      }
      resolve(stdout || stderr)
    })
  })
}
