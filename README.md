# bibliothek-build-monitor
A helper script for automatically importing build files for bibliothek

It monitors /app/uploads for new builds (relying on metadata.json files) and then processes the given metadata and files and inserts them into the database.

## Environment variables
Environment variables required for use
`INPUT_DIR` `/app/uploads`
`STORAGE_DIR` `/app/storage`
`ORG` `https://github.com/GeyserMC/`
`MONGODB_URL` `mongodb://bibliothek:password@localhost:27017/library`

## Docker
Example docker command to run the tool
`docker run --name bibliothek-build-monitor -e ORG=https://github.com/GeyserMC/ -e MONGODB_URL=mongodb://localhost:27017/library -v /srv/download/storage/:/app/storage -v /srv/download/handler/files/:/app/uploads -d quay.io/geysermc/bibliothek-build-monitor`

## Example `metadata.json`
```json
{
	"project": "floodgate",
	"version": "2.2.2",
	"id": 22,
	"commit": "089b9a7e90c0771e5fddb0fddcb794455b20e1bb"
}
```
