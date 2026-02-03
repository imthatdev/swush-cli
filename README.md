# Swush CLI

A minimal CLI for Swush (Node 18+).

## Install

```bash
npm i -g @iconical/swush
```

Or from the repo:

```bash
cd cli
npm link
```

## Usage

```bash
swush login -u https://your.domain -a API_TOKEN
swush status
swush logout
swush upload -p /path/to/file
swush shorten -t https://example.com
swush list
swush help
```

## Commands

- `login` save API token + URL locally
- `status` show saved config status
- `logout` clear saved config
- `upload` upload a file
- `shorten` create a short link
- `list` list uploads
- `help` show command list

### Flags

- `-a`, `--api-key` (required for login, optional if already logged in)
- `-u`, `--url` (optional, defaults to `SWUSH_URL`, `APP_URL`, or `http://localhost:3000`)
- `-p`, `--path` (upload)
- `-t`, `--target` (shorten)

## Config

Saved config is stored at:

- macOS/Linux: `~/.swush/config.json`

Environment fallback:

- `SWUSH_URL` or `APP_URL` for the base URL

## License

Apache-2.0
