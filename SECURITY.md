# Security Policy

## Supported versions

AI Radar is released continuously from the `main` branch. Only the latest
version is supported with security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities.

Instead, report it privately via
[GitHub Security Advisories](https://github.com/pascal-giessler/ai-tech-radar/security/advisories/new).

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce
- Any suggested remediation, if you have one

You can expect an acknowledgement within a few days. Once a fix is available,
the advisory will be published with credit to the reporter (unless you prefer
to remain anonymous).

## Scope notes

- The bundled `docker-compose.yml` and the committed default Postgres password
  are for **local development only** — deployments must set their own secrets
  (see `deploy/k8s/base/secret.example.yaml`).
- `GITHUB_TOKEN` is optional and only ever used to read public GitHub data.
