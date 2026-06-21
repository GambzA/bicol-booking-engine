"""
Create the first platform admin.
Run from the backend directory:
    python -m scripts.seed_admin
Or set env vars:
    ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret python -m scripts.seed_admin
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main() -> None:
    email = os.getenv("ADMIN_EMAIL") or input("Admin email: ").strip()
    full_name = os.getenv("ADMIN_FULL_NAME") or input("Full name: ").strip()
    password = os.getenv("ADMIN_PASSWORD") or input("Password: ").strip()

    from app.core.database import AsyncSessionLocal
    from app.core.security import hash_password
    from app.models.platform_admin import PlatformAdmin

    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        existing = (await session.execute(select(PlatformAdmin).where(PlatformAdmin.email == email))).scalar_one_or_none()
        if existing:
            print(f"Admin with email '{email}' already exists.")
            return

        admin = PlatformAdmin(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
        )
        session.add(admin)
        await session.commit()
        print(f"Platform admin created: {email}")


if __name__ == "__main__":
    asyncio.run(main())
