# bibliothek-build-monitor
A helper script for automatically importing build files for bibliothek

It monitors /app/uploads for new builds (relying on metadata.json files) and then processes the given metadata and files and inserts them into the database.

## Docker
Example docker command to run the tool
`docker run --name bibliothek-build-monitor -e ORG=https://github.com/GeyserMC/ -e MONGODB_URL=mongodb://localhost:27017/library -v /srv/download/storage/:/app/storage -v /srv/download/handler/files/:/app/uploads -d ghcr.io/geysermc/bibliothek-build-monitor:latest`

## Environment variables
Environment variables required for use
| Environment Variable | Example value |
| --- | --- |
| `INPUT_DIR` | `/app/uploads` |
| `STORAGE_DIR` | `/app/storage` |
| `ORG` | `https://github.com/GeyserMC/` |
| `MONGODB_URL` | `mongodb://bibliothek:password@localhost:27017/library` |

## Example `metadata.json`
```json
{
    "project": "geyser",
    "repo": "Geyser",
    "version": "2.2.3",
    "number": 3,
    "changes": [
        {
            "commit": "88a2ca61fa8d2bad709bd5eef44bd197b4a4743a",
            "summary": "Include repo",
            "message": "Include repo"
        }
    ],
    "downloads": {
        "bungeecord": {
            "name": "Geyser-BungeeCord.jar",
            "sha256": "ecbb23039ee4f2930c794083fc29952289befd1080bd9f8198641f0d380ed15c"
        },
        "fabric": {
            "name": "Geyser-Fabric.jar",
            "sha256": "0c2c4acda8da587f4d5b48a1df514e0a9afeedb6b4e389d27e6d16a26d53b18e"
        },
        "neoforge": {
            "name": "Geyser-NeoForge.jar",
            "sha256": "401dda344a11252145c0744990e825ea2cdb8ea303fa116517505363ace465c2"
        },
        "spigot": {
            "name": "Geyser-Spigot.jar",
            "sha256": "04c25e372503dde5c0dfcfa715798a746bed33670af8aa727c5e0b2b9f8c46bb"
        },
        "standalone": {
            "name": "Geyser-Standalone.jar",
            "sha256": "5cc6d8a992ee17d99a9186615ea31566f4afe102f8adf719726a778c133e9519"
        },
        "velocity": {
            "name": "Geyser-Velocity.jar",
            "sha256": "49e6186c5f0a093d5b038f515e05e45ac73f6262373dbf76e77a96c0e179aff3"
        },
        "viaproxy": {
            "name": "Geyser-ViaProxy.jar",
            "sha256": "3a9b6985e10d806a70f4d0892672c073ac31c6a74b15be3e4cbb0121c6e58087"
        }
    }
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
