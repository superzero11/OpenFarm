#!/usr/bin/env python3
"""Check that configuration keys reach the code that reads them.

Three real defects motivated this, all of which a file-to-file diff of
.env against .env.example would have missed:

  * NEXT_PUBLIC_MINIO_URL was set correctly in production and still
    produced broken photo URLs, because compose never passed it to the
    web service and Next.js inlines NEXT_PUBLIC_* at build time.
  * Four soil variables were documented and read by tasks/soil.py, but
    never given to the processor that runs those tasks, so editing them
    did nothing and the code defaults applied silently.
  * MINIO_CONSOLE_PORT existed in .env.example and nowhere else at all.

So the checks below run from the consumer backwards: for every variable,
does it reach the process that reads it?

Exits non-zero on any failure. Drift between .env.example and a local
.env is reported as information, not failure: .env is gitignored and a
developer may legitimately omit optional keys.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPOSE_FILES = ["docker-compose.yml", "docker-compose.dev.yml", "docker-compose.prod.yml"]

failures: list[str] = []
notes: list[str] = []


def read(path: str) -> str:
    p = ROOT / path
    return p.read_text(encoding="utf-8") if p.exists() else ""


def env_keys(text: str, commented: bool = False) -> set[str]:
    pattern = r"^# *([A-Z_][A-Z0-9_]*)=" if commented else r"^([A-Z_][A-Z0-9_]*)="
    return set(re.findall(pattern, text, re.MULTILINE))


def compose_refs() -> set[str]:
    """Every ${VAR} referenced across the compose files."""
    refs: set[str] = set()
    for f in COMPOSE_FILES:
        refs |= set(re.findall(r"\$\{([A-Z_][A-Z0-9_]*)", read(f)))
    return refs


def service_block(text: str, service: str) -> str:
    """The YAML block for one service, by indentation."""
    m = re.search(rf"^  {service}:$", text, re.MULTILINE)
    if not m:
        return ""
    rest = text[m.end():]
    end = re.search(r"^  [a-z_-]+:$", rest, re.MULTILINE)
    return rest[: end.start()] if end else rest


example = read(".env.example")
example_active = env_keys(example)
example_commented = env_keys(example, commented=True)
example_all = example_active | example_commented
compose = read("docker-compose.yml")
refs = compose_refs()

# 1. Anything compose interpolates must be documented, or a fresh clone
#    silently gets an empty value.
undocumented = refs - example_all
if undocumented:
    failures.append(
        "referenced by compose but absent from .env.example: " + ", ".join(sorted(undocumented))
    )

# 2. A key documented in .env.example that nothing reads is a lie in the
#    docs. Look everywhere a variable could legitimately be consumed.
haystack = "".join(
    read(f) for f in COMPOSE_FILES + ["apps/web/Dockerfile", "deploy/setup.sh"]
)
for extra in (ROOT / "deploy" / "terraform" / "templates").glob("*.tftpl"):
    haystack += extra.read_text(encoding="utf-8")
for key in sorted(example_active):
    if key not in haystack:
        failures.append(f"{key} is in .env.example but nothing reads it")

# 3. NEXT_PUBLIC_* is inlined at build time. Reading one in the web app
#    without passing it as a build arg bakes the fallback into the image,
#    which is exactly how the scouting photos broke.
web_src = " ".join(
    p.read_text(encoding="utf-8", errors="replace")
    for p in (ROOT / "apps" / "web" / "src").rglob("*.ts*")
)
used_public = set(re.findall(r"process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)", web_src))
web_block = service_block(compose, "web")
build_args = set(re.findall(r"(NEXT_PUBLIC_[A-Z0-9_]+):", web_block.split("environment:")[0]))
dockerfile = read("apps/web/Dockerfile")
for key in sorted(used_public):
    if key not in build_args:
        failures.append(f"{key} is read by the web app but is not a build arg of the web service")
    elif f"ARG {key}" not in dockerfile:
        failures.append(f"{key} is a compose build arg but has no ARG in apps/web/Dockerfile")

# 4. A documented API setting has to reach the container that runs the
#    code reading it. Celery tasks run on the workers, not on the API.
config = read("services/api/app/core/config.py")
settings = {m.upper() for m in re.findall(r"^    ([a-z0-9_]+):", config, re.MULTILINE)}
api_block = service_block(compose, "api")
proc_block = service_block(compose, "processor")
ml_block = service_block(compose, "ml-processor")
for key in sorted(example_active & settings):
    if not any(key in b for b in (api_block, proc_block, ml_block)):
        failures.append(
            f"{key} is a documented API setting but reaches no api/processor container"
        )

# 5. Informational: how far a local .env has drifted from the template.
local = read(".env")
if local:
    missing = example_active - env_keys(local)
    if missing:
        notes.append(
            "your .env is missing: "
            + ", ".join(sorted(missing))
            + "  (run: python3 scripts/sync-env.py)"
        )

for n in notes:
    print(f"  note: {n}")

if failures:
    print("FAIL: environment configuration is inconsistent")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)

print(f"  env parity OK ({len(example_active)} documented keys, {len(used_public)} public web vars)")
