// Adapted from https://github.com/GeyserMC/bibliothek/blob/98d79f92f0c0a69c7213f16e6e692aa810e86f49/cli/insertBuild.js

const fs = require('fs')
const gitlog = require('gitlog').default
const { MongoClient } = require('mongodb')
const path = require('path')

const client = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017', {
  useUnifiedTopology: true
})

const storagePath = process.env.STORAGE_DIR
const buildChannel = 'DEFAULT'

module.exports.insert = async (buildInfo) => {
  const downloadsPath = path.join(
    storagePath,
    buildInfo.projectName,
    buildInfo.versionName,
    buildInfo.buildNumber.toString()
  )

  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, {
      recursive: true
    })
  }

  for (const download of buildInfo.downloads) {
    const info = download.split(':')
    if (info.length === 3) {
      const downloadPath = path.join(
        downloadsPath,
        buildInfo.projectName + '-' + buildInfo.versionName + '-' + buildInfo.buildNumber + '.jar'
      )
      fs.copyFileSync(info[1], downloadPath)
    } else if (info.length === 4) {
      const downloadPath = path.join(
        downloadsPath,
        info[3]
      )
      fs.copyFileSync(info[1], downloadPath)
    }
  }

  try {
    await client.connect()
    const database = client.db('library') // "library" instead of "bibliothek" is intentional here
    const project = await database.collection('projects').findOneAndUpdate(
      { name: buildInfo.projectName },
      {
        $setOnInsert: {
          name: buildInfo.projectName,
          friendlyName: buildInfo.projectFriendlyName
        }
      },
      {
        new: true,
        returnDocument: 'after',
        upsert: true
      }
    )
    const versionGroup = await database.collection('version_groups').findOneAndUpdate(
      {
        project: project.value._id,
        name: buildInfo.versionGroupName
      },
      {
        $setOnInsert: {
          project: project.value._id,
          name: buildInfo.versionGroupName
        }
      },
      {
        new: true,
        returnDocument: 'after',
        upsert: true
      }
    )
    const version = await database.collection('versions').findOneAndUpdate(
      {
        project: project.value._id,
        name: buildInfo.versionName
      },
      {
        $setOnInsert: {
          project: project.value._id,
          group: versionGroup.value._id,
          name: buildInfo.versionName,
          time: new Date()
        }
      },
      {
        new: true,
        returnDocument: 'after',
        upsert: true
      }
    )
    const previousBuild = await database.collection('builds').findOne({
      project: project.value._id,
      version: version.value._id
    }, { sort: { _id: -1 } })
    const changes = []
    const lastBuild = previousBuild && previousBuild.changes.length ? previousBuild.changes.slice(0, 1)[0].commit : 'HEAD^1'
    let commits = [];
    try {
      commits = gitlog({
        repo: buildInfo.repositoryPath,
        fields: ['hash', 'subject', 'rawBody'],
        branch: lastBuild + '...HEAD'
      }) 
    } catch(error) {
      // Likely failed due to forced push or incompatible base branches
      // Build will have no history
    }
    commits.forEach(function (commit) {
      changes.push({
        commit: commit.hash,
        summary: commit.subject,
        message: commit.rawBody
      })
    })
    const buildDownloads = {}
    for (const download of buildInfo.downloads) {
      const info = download.split(':')
      if (info.length === 3) {
        buildDownloads[info[0].replace('.', ':')] = {
          name: buildInfo.projectName + '-' + buildInfo.versionName + '-' + buildInfo.buildNumber + '.jar',
          sha256: info[2]
        }
      } else if (info.length === 4) {
        buildDownloads[info[0].replace('.', ':')] = {
          name: info[3],
          sha256: info[2]
        }
      }
    }
    const build = await database.collection('builds').insertOne({
      project: project.value._id,
      version: version.value._id,
      number: buildInfo.buildNumber,
      time: new Date(),
      changes,
      downloads: buildDownloads,
      promoted: false,
      channel: buildChannel
    })
    console.log('Inserted build ' + buildInfo.buildNumber + ' (channel: ' + buildChannel + ') for project ' + project.value.name + ' (' + project.value._id + ') version ' + version.value.name + ' (' + version.value._id + '): ' + build.insertedId)
  } finally {
    await client.close()
  }
}
