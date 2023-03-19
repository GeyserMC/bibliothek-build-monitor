const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')

require('log-timestamp')
require('dotenv').config()

const cli = require('./bibliothek-cli')

const uploadFolder = process.env.INPUT_DIR || './uploads/'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

console.log(`Watching for file changes on ${uploadFolder}`)

fs.watch(uploadFolder, { recursive: true }, async (event, filepath) => {
  // Ignore invalid filepaths and most events
  // From the docs: On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory.
  if (event !== 'rename' || filepath.length === 0) return

  const fullPath = path.join(uploadFolder, filepath)
  const filename = path.basename(fullPath)
  const folder = path.dirname(fullPath)

  // Make sure the file exists and is not a directory
  if (!fs.existsSync(fullPath)) return
  if (fs.lstatSync(fullPath).isDirectory()) return

  // console.log(`${event} - ${filepath}`)

  if (filename.endsWith('.jar')) {
    console.log(`${filename} created`)
  } else if (filename === 'metadata.json') {
    console.log('Metadata file uploaded, processing...')
    while (true) {
      // Keep trying to read the file until it's available
      await sleep(1000)
      try {
        const metadata = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
        console.log(metadata)

        handleMetadata(folder, metadata)
        return
        // const files = fs.walkSync('./')
      } catch (e) { }
    }
  }
})

async function handleMetadata (folder, metadata) {
  const projectFriendly = metadata.project.charAt(0).toUpperCase() + metadata.project.slice(1)
  const repoUrl = process.env.ORG + projectFriendly
  const versionGroup = metadata.version.split('.').slice(0, 2).join('.')
  const files = fs.readdirSync(folder).filter(f => f !== 'metadata.json')

  console.log(`Project: ${metadata.project}`)
  console.log(`Version: ${metadata.version}`)
  console.log(`Version Group: ${versionGroup}`)
  console.log(`Build: ${metadata.id}`)
  console.log(`Commit: ${metadata.commit}`)
  console.log(`Repo: ${repoUrl}`)
  console.log(`Files: ${files}`)

  const repoPath = path.join(folder, 'repo')
  console.log(`Cloning repo to ${repoPath}`)
  execSync(`git clone -n ${repoUrl} ${repoPath}`)
  execSync(`git -C ${repoPath} checkout ${metadata.commit}`)

  console.log('Getting SHA256 of files')
  const downloads = []
  for (const file of files) {
    const filePath = path.join(folder, file)
    const id = file.split('.')[0].split('-').slice(1).join().toLowerCase()
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    // "$ID:/app/files/$(basename $F):$SHA256:$(basename $F)"
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
