# bibliothek-build-monitor
A helper script for automatically importing build files for bibliothek

It monitors /app/uploads for new builds (relying on metadata.json files) and then processes the given metadata and files and inserts them into the database.

## Docker
Example docker command to run the tool
`docker run --name bibliothek-build-monitor -e ORG=https://github.com/GeyserMC/ -e MONGODB_URL=mongodb://localhost:27017/library -v /srv/download/storage/:/app/storage -v /srv/download/handler/files/:/app/uploads -d quay.io/geysermc/bibliothek-build-monitor:latest`

## Environment variables
Environment variables required for use
`INPUT_DIR` `/app/uploads`
`STORAGE_DIR` `/app/storage`
`ORG` `https://github.com/GeyserMC/`
`MONGODB_URL` `mongodb://bibliothek:password@localhost:27017/library`

## Example `metadata.json`
```json
{
	"project": "floodgate",
	"version": "2.2.2",
	"id": 22,
	"commit": "089b9a7e90c0771e5fddb0fddcb794455b20e1bb"
}
```

## Example file structure
The project name and build number folders dont matter aslong as the metadata.json file is in the correct place. The metadata.json file is used to determine the project name and build number. The files are then moved to the storage directory and the metadata is inserted into the database.
```bash
/app/uploads
├── floodgate # Project name
│   ├── 22 # Build number
│   │   ├── floodgate-bungee.jar # Build files to publish
│   │   ├── floodgate-spigot.jar
│   │   ├── floodgate-velocity.jar
│   │   └── metadata.json # Metadata file
│   └── 23 # Build number
│       ├── floodgate-bungee.jar # Build files to publish
│       ├── floodgate-spigot.jar
│       ├── floodgate-velocity.jar
│       └── metadata.json # Metadata file
└── geyser # Project name
	├── 46 # Build number
	│   ├── Geyser-BungeeCord.jar # Build files to publish
	│   ├── Geyser-Fabric.jar
	│   ├── Geyser-Spigot.jar
	│   ├── Geyser-Sponge.jar
	│   ├── Geyser-Standalone.jar
	│   ├── Geyser-Velocity.jar
	│   └── metadata.json # Metadata file
	└── 47 # Build number
	    ├── Geyser-BungeeCord.jar # Build files to publish
	    ├── Geyser-Fabric.jar
	    ├── Geyser-Spigot.jar
	    ├── Geyser-Sponge.jar
	    ├── Geyser-Standalone.jar
	    ├── Geyser-Velocity.jar
	    └── metadata.json # Metadata file
```
