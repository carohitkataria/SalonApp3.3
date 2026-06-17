#!/usr/bin/env python3
"""Seed / repair the platform owner so Platform Admin OTP + password login works.

Usage (from /app/backend):
    python seed_platform_owner.py +917503070727 "Owner Name" you@email.com

If the mobile is already in `platform_admins`, this re-activates it as the
owner.  If not, it creates a new record.  Safe to run multiple times.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "salon_db")
db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]


def normalize_mobile(raw: str) -> str:
    d = "".join(c for c in (raw or "") if c.isdigit())
    if d.startswith("91") and len(d) == 12:
        d = d[2:]
    if len(d) != 10:
        raise SystemExit(f"Invalid mobile: {raw}")
    return f"+91{d}"


async def main():
    if len(sys.argv) < 2:
        print('Usage: python seed_platform_owner.py <mobile> [name] [email]')
        raise SystemExit(1)
    mobile = normalize_mobile(sys.argv[1])
    name = sys.argv[2] if len(sys.argv) > 2 else "Platform Owner"
    email = sys.argv[3] if len(sys.argv) > 3 else None
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.platform_admins.find_one({"mobile": mobile})
    if existing:
        await db.platform_admins.update_one(
            {"mobile": mobile},
            {"$set": {
                "status": "active",
                "is_owner": True,
                "can_be_deleted": False,
                "updated_at": now,
            }},
        )
        print(f"✓ {mobile} re-activated as owner.")
    else:
        await db.platform_admins.insert_one({
            "id": str(uuid.uuid4()),
            "mobile": mobile,
            "name": name,
            "email": email,
            "is_owner": True,
            "can_be_deleted": False,
            "status": "active",
            "invited_by": None,
            "last_login_at": None,
            "created_at": now,
            "updated_at": now,
        })
        print(f"✓ Seeded platform owner {mobile} ({name}).")


if __name__ == "__main__":
    asyncio.run(main())
