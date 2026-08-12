#!/usr/bin/env python3
"""Append keys that .env.example has gained to an existing .env.

setup.sh only copies the template when no .env exists, which is correct:
re-copying would overwrite the generated database password, JWT secret
and OAuth credentials. The side effect is that an existing .env is frozen
at the day it was created, and every key added to the template afterwards
is silently missing, leaving the code to fall back to its default.

This closes that gap from the safe direction. It only ever appends. No
existing line is edited, reordered or removed, so a key you have already
set, or deliberately commented out, is left exactly as it is.

Commented keys in the template are skipped: by convention those are
optional or environment-specific (DOMAIN), and the deployment overlays
them when it needs them.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLACEHOLDER = re.compile(r"change-me|your-[a-z-]+|CHANGEME", re.IGNORECASE)


def parse_example(text: str) -> list[tuple[str, str, list[str]]]:
    """Active keys as (key, line, preceding comment block)."""
    entries = []
    comments: list[str] = []
    for raw in text.splitlines():
        line = raw.rstrip("\n")
        if line.startswith("#"):
            # Carry prose, not a commented-out assignment from the section
            # above: copying `# DOMAIN=...` into .env would read as advice
            # to set it, and would then count as that key being present.
            if not re.match(r"^# *[A-Z_][A-Z0-9_]*=", line):
                comments.append(line)
            continue
        if not line.strip():
            comments = []
            continue
        m = re.match(r"^([A-Z_][A-Z0-9_]*)=", line)
        if m:
            entries.append((m.group(1), line, comments))
        comments = []
    return entries


def keys_in(text: str) -> set[str]:
    """Every key the file mentions, commented or not.

    A key someone has commented out is a deliberate choice, so treat it as
    present and leave it alone rather than appending a second, live copy.
    """
    return set(re.findall(r"^[ \t]*#?[ \t]*([A-Z_][A-Z0-9_]*)=", text, re.MULTILINE))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--env", default=str(ROOT / ".env"))
    ap.add_argument("--example", default=str(ROOT / ".env.example"))
    ap.add_argument("--dry-run", action="store_true", help="report without writing")
    args = ap.parse_args()

    env_path, example_path = Path(args.env), Path(args.example)

    if not example_path.exists():
        print(f"  sync-env: no template at {example_path}", file=sys.stderr)
        return 1
    if not env_path.exists():
        print(f"  sync-env: no {env_path.name} yet, nothing to reconcile")
        return 0

    example_text = example_path.read_text(encoding="utf-8")
    env_text = env_path.read_text(encoding="utf-8")
    present = keys_in(env_text)

    missing = [(k, line, comments) for k, line, comments in parse_example(example_text) if k not in present]
    if not missing:
        print(f"  sync-env: {env_path.name} has every documented key")
        return 0

    block = [""]
    block.append(f"# Added by scripts/sync-env.py on {time.strftime('%Y-%m-%d')}: keys the")
    block.append("# template gained after this file was created. Values are the template")
    block.append("# defaults - review anything marked below before relying on it.")
    for _, line, comments in missing:
        block.append("")
        block.extend(comments)
        block.append(line)

    if args.dry_run:
        print(f"  sync-env: would append {len(missing)} key(s) to {env_path.name}:")
        for k, _, _ in missing:
            print(f"    + {k}")
        return 0

    backup = env_path.with_name(f"{env_path.name}.bak-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(env_path, backup)

    with env_path.open("a", encoding="utf-8") as fh:
        if not env_text.endswith("\n"):
            fh.write("\n")
        fh.write("\n".join(block) + "\n")

    print(f"  sync-env: appended {len(missing)} key(s) to {env_path.name} (backup: {backup.name})")
    for k, line, _ in missing:
        value = line.split("=", 1)[1]
        flag = "  <- placeholder, set this" if PLACEHOLDER.search(value) else ""
        print(f"    + {k}{flag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
