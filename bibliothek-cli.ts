import fs from 'fs';
import { FindOneAndUpdateOptions, MongoClient } from 'mongodb';
import path from 'path';
import chokidar from 'chokidar';
import util from 'util';
import 'dotenv/config';

interface Metadata {
    project: string,
    repo: string,
    version: string,
    number: number,
    changes: {
        commit: string,
        summary: string,
        message: string
    }[],
    downloads: {
        [key: string]: {
            name: string,
            sha256: string
        }
    }
}

const uploadFolder = process.env.INPUT_DIR || './uploads/';
const watcher = chokidar.watch(uploadFolder, { ignored: /(^|[\/\\])(\..|repo)/, persistent: true });
const client = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017', {});

const storagePath = process.env.STORAGE_DIR || './storage/';
const buildChannel = 'DEFAULT';

const logger = {
    info: (...message: any) => console.log ( '[' + new Date().toISOString().substring(11,23) + ']:', ...message ),
    debug: (...message: any) => console.debug ( '[' + new Date().toISOString().substring(11,23) + ']:', ...message ),
    error: (...message: any) => console.error ( '[' + new Date().toISOString().substring(11,23) + ']:', ...message )
};

const mongoOptions: FindOneAndUpdateOptions = {
    returnDocument: 'after',
    upsert: true
};

watcher.on('error', function (e) {
    logger.error(e);
})

if (process.env.NODE_ENV !== 'production') {
    watcher.on('raw', function (event, path, details) {
        logger.debug('Raw event info:', event, path, details);
    })
}

logger.info(`Watching for file changes on ${uploadFolder}`);

watcher.on('add', async (filepath) => {
    const filename = path.basename(filepath)
    const folder = path.dirname(filepath)

    // Make sure the path is not a directory
    if (fs.lstatSync(filepath).isDirectory()) return;

    if (filename.endsWith('.jar')) {
        logger.info(`${filename} created`);
    } else if (filename === 'metadata.json') {
        logger.info('Metadata file uploaded, processing...');
        while (true) {
            // Keep trying to read the file until it's available
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const metadata: Metadata = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                logger.info(metadata);
                await handleMetadata(folder, metadata);
                return;
            } catch (e) { 
                logger.error(e);
                break;
            }
        }
    }
});

async function handleMetadata(folder: string, metadata: Metadata) {
    logger.info(`Project: ${metadata.repo} (${metadata.project})`);
    logger.info(`Version: ${metadata.version}`);
    logger.info(`Build: ${metadata.number}`);
    logger.info(`Downloads: ${util.inspect(metadata.downloads)}`);
    logger.info(`Changes: ${util.inspect(metadata.changes)}`);

    logger.info('Inserting build into database');
    await insert(metadata, folder);

    logger.info(`Cleaning up ${folder}`);

    if (path.relative(uploadFolder, folder) === '') {
        // Don't delete the uploads folder
        fs.readdirSync(folder, { withFileTypes: true })
            .forEach(f => { if (f.isFile()) fs.rmSync(path.join(folder, f.name)) });
    } else {
        fs.rmSync(folder, { recursive: true, force: true });
    }
}

const insert = async (metadata: Metadata, folder: string) => {
    const downloadsPath = path.join(storagePath, metadata.project, metadata.version, metadata.number.toString());

    if (!fs.existsSync(downloadsPath)) {
        fs.mkdirSync(downloadsPath, {
            recursive: true
        });
    }

    try {
        for (const download in metadata.downloads) {
            const name = metadata.downloads[download].name;
            const srcPath = path.join(folder, name);
            const destPath = path.join(downloadsPath, name);
            fs.copyFileSync(srcPath, destPath);
        }
    } catch (e) {
        logger.error(e);
        return;
    }

    try {
        await client.connect();
        const database = client.db('library'); // "library" instead of "bibliothek" is intentional here
        const project = await database.collection('projects').findOneAndUpdate(
            { name: metadata.project },
            { $setOnInsert: { name: metadata.project, friendlyName: metadata.repo } },
            mongoOptions
        );

        if (!project) {
            throw new Error('Project not found');
        }

        const majorVersion = metadata.version.split('.').slice(0, 2).join('.');
        const versionGroup = await database.collection('version_groups').findOneAndUpdate(
            { project: project._id, name: majorVersion },
            { $setOnInsert: { project: project._id, name: majorVersion } },
            mongoOptions
        );

        if (!versionGroup) {
            throw new Error('Version group not found');
        }

        const version = await database.collection('versions').findOneAndUpdate(
            { project: project._id, name: metadata.version },
            { $setOnInsert: 
                {
                    project: project._id,
                    group: versionGroup._id,
                    name: metadata.version,
                    time: new Date()
                }
            },
            mongoOptions
        );

        if (!version) {
            throw new Error('Version not found');
        };

        const build = await database.collection('builds').insertOne({
            project: project._id,
            version: version._id,
            number: metadata.number,
            time: new Date(),
            changes: metadata.changes,
            downloads: metadata.downloads,
            promoted: false,
            channel: buildChannel
        });

        logger.info(
            'Inserted build ' + metadata.number + 
            ' (channel: ' + buildChannel + ') for project ' +
            project.name + ' (' + project._id + ') version ' +
            version.name + ' (' + version._id + '): ' + build.insertedId
        );
    } catch (e) {
        logger.info(e);
    } finally {
        await client.close()
    }
}