# Security Policy

## Supported Versions

We currently support security fixes on the `main` branch. If you are running a fork, please stay up to date with `main`.

## Reporting a Vulnerability

- Email: hello@openfarm.earth
- Please include a detailed description, steps to reproduce, and the potential impact.
- **Do not** open public GitHub issues for security reports.

We aim to acknowledge reports within 2 business days and provide a resolution or mitigation plan within 10 business days.

## Scope

- OpenFarm backend (`services/api`, `services/tiler`)
- OpenFarm frontend (`apps/web`)
- Infrastructure in this repository (`docker-compose.yml`)

Out of scope: third-party services and forks not maintained by the OpenFarm team.

## Handling

1. Triage and reproduce.
2. Assign CVSS and priority.
3. Develop and validate a fix.
4. Release patch and notify reporter.
5. Publish security advisory if warranted.

## Safe Harbor

We will not pursue legal action against researchers who:
- Engage in good faith to test and report vulnerabilities
- Avoid privacy violations, data destruction, and service disruption
- Provide us a reasonable time to remediate before public disclosure
