# Swush CLI (Zero-Trust)

Swush CLI is a secure-by-design command-line client for Swush.

## Highlights

- Zero-trust command gate: every protected command validates auth state before execution.
- Security-first sessions: refresh token in OS keychain (encrypted fallback), short-lived validation cache.
- Device-auth login flow or manual API-key login.
- Command and flag completion with context-aware suggestions.
- Shell support: zsh, bash, fish.
- Aliases: `swush` and `swu`.

## Install

```bash
npm i -g @iconical/swush
```

From repo:

```bash
cd cli
npm link
```

## Quick Start

```bash
swush auth login --url https://your.domain
swush upload file ./photo.png
swush shorten link https://example.com
swush bookmark add https://example.com
```

## Command Model

Pattern:

```bash
swush <action> <resource> [flags]
```

Legacy aliases are preserved:

- `swush login` -> `swush auth login`
- `swush logout` -> `swush auth logout`
- `swush status` -> `swush auth status`
- `swush upload` -> `swush upload file`
- `swush shorten` -> `swush shorten link`
- `swush list` -> `swush list uploads`

## Commands

- `swush auth login [--url <url>] [--api-key <token>]`
- `swush auth logout`
- `swush auth status`
- `swush upload file <path> [--private]`
- `swush shorten link <url> [--private] [--slug <slug>] [--expiry <iso>]`
- `swush bookmark add <url> [--title <text>] [--private]`
- `swush list uploads [--limit <n>] [--offset <n>]`
- `swush completion install [--shell zsh|bash|fish]`
- `swush completion script --shell zsh|bash|fish`

## Completion

Install completion:

```bash
swush completion install
```

Manual script output:

```bash
swush completion script --shell zsh
```

Autocomplete includes:

- command and subcommand suggestions
- flag suggestions
- history-weighted suggestions
- context-aware inputs (recent files, recent URLs, clipboard URL for bookmark add)

## Security Notes

- Tokens are never stored in plaintext config.
- Primary storage uses OS credential store (macOS Keychain / Linux Secret Service).
- If no OS store is available, encrypted local fallback is used.
- Config file integrity is signed and verified.
- Device fingerprint binding is checked on each protected command.

## Config Location

- Default: `~/.swush`
- Override (useful in CI/sandbox): `SWUSH_CONFIG_HOME=/custom/path`

## Global Flags

- `--help`, `-h`
- `--version`, `-v`
- `--no-color`
- `--json`

## License

Apache-2.0
