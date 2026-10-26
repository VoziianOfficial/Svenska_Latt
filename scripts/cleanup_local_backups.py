#!/usr/bin/env python3
"""Clean Svenska Lätt local backups older than 30 days."""

from pathlib import Path
from datetime import datetime, timezone
import sys

BACKUP_DIR = Path.home() / "Documents" / "Svenska_Latt_Backups"
RETENTION_DAYS = 30
VALID_SUFFIXES = (".dump", ".sql", ".backup", ".sql.gz", ".dump.gz")

def main():
    apply = sys.argv[1:] == ["--apply"]

    if sys.argv[1:] not in ([], ["--apply"]):
        raise SystemExit("Usage: cleanup_local_backups.py [--apply]")

    if not BACKUP_DIR.is_dir():
        raise SystemExit("Backup directory not found")

    now = datetime.now(timezone.utc).timestamp()
    expired = []

    for path in BACKUP_DIR.iterdir():
        if path.is_symlink() or not path.is_file():
            continue

        if not path.name.endswith(VALID_SUFFIXES):
            continue

        age_days = (now - path.stat().st_mtime) / 86400

        if age_days >= RETENTION_DAYS:
            expired.append(path)

    for path in sorted(expired):
        if apply:
            path.unlink()
            print(f"REMOVED: {path.name}")
        else:
            print(f"WOULD REMOVE: {path.name}")

    print(f"Retention: {RETENTION_DAYS} days")
    print(f"Expired backups: {len(expired)}")
    print("Mode:", "CLEANUP" if apply else "DRY RUN")

if __name__ == "__main__":
    main()
