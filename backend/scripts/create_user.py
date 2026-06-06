#!/usr/bin/env python3
"""Create a user in the database.

CLI usage:
    python scripts/create_user.py --username alice --email alice@example.com --password secret

Env-var usage (e.g. on container startup via DEFAULT_USER_* vars):
    DEFAULT_USER_USERNAME=alice DEFAULT_USER_EMAIL=alice@example.com DEFAULT_USER_PASSWORD=secret \\
        python scripts/create_user.py
"""
import argparse
import asyncio
import os
import sys
from datetime import UTC, datetime

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.domain.models import User
from app.repositories.user_repository import UserRepository


async def create_user(username: str, email: str, password: str) -> None:
    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)

        if await repo.get_by_username(username):
            print(f"User '{username}' already exists — skipping.")
            return
        if await repo.get_by_email(email):
            print(f"Email '{email}' already exists — skipping.")
            return

        now = datetime.now(UTC)
        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.add(user)
        await session.commit()
        print(f"Created user '{username}' ({email}) id={user.id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a user in the database.")
    parser.add_argument("--username", default=os.environ.get("DEFAULT_USER_USERNAME", ""))
    parser.add_argument("--email", default=os.environ.get("DEFAULT_USER_EMAIL", ""))
    parser.add_argument("--password", default=os.environ.get("DEFAULT_USER_PASSWORD", ""))
    args = parser.parse_args()

    if not args.username or not args.email or not args.password:
        print("Skipping user seed: DEFAULT_USER_USERNAME / EMAIL / PASSWORD not set.")
        return

    asyncio.run(create_user(args.username, args.email, args.password))


if __name__ == "__main__":
    main()
