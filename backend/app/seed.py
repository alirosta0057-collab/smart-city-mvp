"""Seed demo data: categories, businesses near Tehran, and demo users."""
from __future__ import annotations

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.business import Business
from app.models.category import Category
from app.models.user import User, UserRole

CATEGORIES = [
    ("health", "Health & Medical", "🏥", "Clinics, pharmacies, ambulance"),
    ("food", "Food & Groceries", "🍞", "Supermarkets, bakeries, restaurants"),
    ("transport", "Transport", "🚖", "Taxis, ride share, bike rental"),
    ("utilities", "Utilities", "💡", "Water, power, gas, internet"),
    ("municipal", "Municipal Services", "🏛️", "Waste, parks, permits, licensing"),
    ("safety", "Safety & Emergency", "🚨", "Police, fire, emergency response"),
    ("education", "Education", "🎓", "Schools, universities, libraries"),
    ("finance", "Finance", "💳", "Banks, ATMs, insurance"),
    ("home", "Home Services", "🛠️", "Plumbing, electrical, cleaning"),
    ("leisure", "Leisure", "🎭", "Gyms, cinemas, parks"),
]


BUSINESSES = [
    ("Mehr Pharmacy", "health", 35.7006, 51.4000, "+98 21 1234 5678", "Valiasr St., Tehran"),
    ("City Hospital", "health", 35.7100, 51.4100, "+98 21 9000 0000", "Enghelab Ave., Tehran"),
    ("Green Supermarket", "food", 35.6950, 51.3880, "+98 21 2222 1111", "Tajrish Sq., Tehran"),
    ("Ekbatan Bakery", "food", 35.7050, 51.3200, "+98 21 2222 3333", "Ekbatan, Tehran"),
    ("Snapp Taxi Hub", "transport", 35.6980, 51.3920, "+98 21 4000 0000", "Azadi St., Tehran"),
    ("Tehran Power Office", "utilities", 35.6900, 51.3800, "+98 21 5000 0000", "Keshavarz Blvd., Tehran"),
    ("District 3 Municipality", "municipal", 35.7450, 51.4200, "+98 21 6000 0000", "District 3 HQ"),
    ("Fire Station #7", "safety", 35.7020, 51.3800, "+98 21 125", "Vanak Sq., Tehran"),
    ("Sharif University", "education", 35.7030, 51.3510, "+98 21 66164411", "Azadi St., Tehran"),
    ("Bank Melli Branch", "finance", 35.6905, 51.3870, "+98 21 7000 0000", "Mirdamad Blvd., Tehran"),
    ("HomeFix Plumbing", "home", 35.6880, 51.3700, "+98 21 8000 0000", "Sattarkhan St., Tehran"),
    ("Azadi Cinema", "leisure", 35.7010, 51.3790, "+98 21 9000 1111", "Azadi Square, Tehran"),
]


USERS = [
    # Citizen demo has no pre-seeded coords — the dashboard resolves real
    # geolocation on first mount so demo users everywhere see their actual
    # neighbourhood, not whatever the last person who logged in saw.
    ("admin@smartcity.example", "Admin", "admin123", UserRole.ADMIN, None, None),
    ("citizen@smartcity.example", "Citizen Demo", "pass123", UserRole.CITIZEN, None, None),
    ("agent@smartcity.example", "Agent Demo", "pass123", UserRole.AGENT, 35.7000, 51.3900),
    ("agent2@smartcity.example", "Agent North", "pass123", UserRole.AGENT, 35.7700, 51.4100),
]


def seed() -> None:
    db = SessionLocal()
    try:
        slug_to_category: dict[str, Category] = {}
        for slug, name, icon, description in CATEGORIES:
            existing = db.scalar(select(Category).where(Category.slug == slug))
            if existing:
                slug_to_category[slug] = existing
                continue
            c = Category(slug=slug, name=name, icon=icon, description=description)
            db.add(c)
            db.flush()
            slug_to_category[slug] = c

        for name, cat_slug, lat, lng, phone, address in BUSINESSES:
            existing = db.scalar(select(Business).where(Business.name == name))
            if existing:
                continue
            db.add(
                Business(
                    name=name,
                    description=None,
                    phone=phone,
                    address=address,
                    lat=lat,
                    lng=lng,
                    category_id=slug_to_category[cat_slug].id,
                )
            )

        for email, full_name, password, role, lat, lng in USERS:
            existing = db.scalar(select(User).where(User.email == email))
            if existing:
                continue
            u = User(
                email=email,
                full_name=full_name,
                password_hash=hash_password(password),
                role=role,
                lat=lat,
                lng=lng,
                city=None if lat is None else "Tehran",
                country=None if lat is None else "Iran",
                is_online=(role == UserRole.AGENT),
            )
            db.add(u)

        db.commit()
        print("Seed complete")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
