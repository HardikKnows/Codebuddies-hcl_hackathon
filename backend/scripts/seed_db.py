"""Reset the database and load the demo dataset.

Usage (from backend/):  .venv/bin/python -m scripts.seed_db

This truncates every table, including knowledge documents, so run
`python -m scripts.ingest_knowledge` afterwards to rebuild the policy index.
"""

import csv
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    AuditEvent,
    Brand,
    Category,
    CustomerProfile,
    Inventory,
    Order,
    OrderItem,
    Product,
    Store,
    SupportTicket,
    User,
)
from app.models.enums import (
    AuditOutcome,
    AuditSource,
    FulfillmentType,
    OrderStatus,
    Role,
    StoreType,
    TicketCategory,
    TicketPriority,
    TicketSource,
    TicketStatus,
)
from app.services.catalog_import import parse_spec_pairs
from app.services.orders import DELIVERY_FEE, FREE_DELIVERY_THRESHOLD

SEED_DIR = Path(__file__).resolve().parents[1] / "seed"
DEMO_PASSWORD = "demo123"

CATEGORIES = [
    ("electronics", "Electronics", None),
    ("mobiles", "Mobiles", "electronics"),
    ("laptops", "Laptops", "electronics"),
    ("audio", "Audio", "electronics"),
    ("wearables", "Wearables", "electronics"),
    ("televisions", "Televisions", "electronics"),
    ("home-appliances", "Home Appliances", None),
    ("refrigerators", "Refrigerators", "home-appliances"),
    ("washing-machines", "Washing Machines", "home-appliances"),
    ("kitchen-appliances", "Kitchen Appliances", "home-appliances"),
]

STORES = [
    ("BLR-KOR", "NovaMart Koramangala", StoreType.STORE, "Bengaluru", "80 Feet Road, Koramangala 4th Block"),
    ("BLR-WHF", "NovaMart Whitefield", StoreType.STORE, "Bengaluru", "ITPL Main Road, Whitefield"),
    ("MUM-AND", "NovaMart Andheri", StoreType.STORE, "Mumbai", "Link Road, Andheri West"),
    ("DEL-SAK", "NovaMart Saket", StoreType.STORE, "New Delhi", "Press Enclave Marg, Saket"),
    ("IN-WH1", "NovaMart Central Warehouse", StoreType.WAREHOUSE, "Nagpur", "MIHAN SEZ, Nagpur"),
]

# email, name, role, staff store, (tier, country, city, preferred store, preferences) for customers
USERS = [
    ("aarav@novamart.demo", "Aarav Sharma", Role.CUSTOMER, None,
     ("GOLD", "IN", "Bengaluru", "BLR-KOR", {"favoriteCategories": ["laptops", "audio"], "budgetMax": 80000})),
    ("meera@novamart.demo", "Meera Iyer", Role.CUSTOMER, None,
     ("STANDARD", "IN", "Mumbai", "MUM-AND", {"favoriteCategories": ["kitchen-appliances"]})),
    ("omar@novamart.demo", "Omar Haddad", Role.CUSTOMER, None,
     ("PLATINUM", "AE", "Dubai", None, {})),
    ("priya@novamart.demo", "Priya Nair", Role.STORE_MANAGER, "BLR-KOR", None),
    ("rohan@novamart.demo", "Rohan Das", Role.STORE_STAFF, "MUM-AND", None),
    ("admin@novamart.demo", "Kavya Menon", Role.ADMIN, None, None),
]

# Specific stock levels that make the demo story work (everything else is generated).
STOCK_OVERRIDES = {
    ("P101", "BLR-KOR"): 6,  # one more sale tips it into LOW_STOCK
    ("P107", "BLR-KOR"): 12,
    ("P106", "BLR-KOR"): 0,
    ("P105", "BLR-KOR"): 2,
    ("P102", "BLR-KOR"): 9,
    ("P201", "BLR-KOR"): 3,
    ("P301", "BLR-KOR"): 4,
    ("P501", "BLR-KOR"): 7,
}

# order number, customer email, fulfillment, store, status, days ago, [(sku, qty)]
ORDERS = [
    ("NM-100031", "meera@novamart.demo", FulfillmentType.DELIVERY, "IN-WH1", OrderStatus.DELIVERED, 12, [("P701", 1)]),
    ("NM-100035", "aarav@novamart.demo", FulfillmentType.PICKUP, "BLR-KOR", OrderStatus.PICKED_UP, 20, [("P301", 1)]),
    ("NM-100038", "meera@novamart.demo", FulfillmentType.PICKUP, "MUM-AND", OrderStatus.READY_FOR_PICKUP, 1, [("P801", 1), ("P803", 1)]),
    ("NM-100040", "aarav@novamart.demo", FulfillmentType.DELIVERY, "IN-WH1", OrderStatus.SHIPPED, 2, [("P501", 1)]),
    ("NM-100042", "aarav@novamart.demo", FulfillmentType.DELIVERY, "IN-WH1", OrderStatus.DELIVERED, 3, [("P201", 1)]),
    ("NM-100044", "meera@novamart.demo", FulfillmentType.DELIVERY, "IN-WH1", OrderStatus.PLACED, 0, [("P107", 1)]),
    ("NM-100045", "aarav@novamart.demo", FulfillmentType.PICKUP, "BLR-KOR", OrderStatus.PACKED, 0, [("P402", 1)]),
    ("NM-100047", "meera@novamart.demo", FulfillmentType.PICKUP, "MUM-AND", OrderStatus.CANCELLED, 6, [("P205", 1)]),
]

ADDRESSES = {
    "aarav@novamart.demo": {"line1": "14, 5th Cross, Koramangala", "city": "Bengaluru", "postal_code": "560034"},
    "meera@novamart.demo": {"line1": "B-702, Lokhandwala Complex", "city": "Mumbai", "postal_code": "400053"},
}

# ticket number, customer, order, category, priority, status, source, created by, assigned to, days ago, subject, description
TICKETS = [
    ("TKT-000901", "meera@novamart.demo", "NM-100031", TicketCategory.DELIVERY, TicketPriority.MEDIUM, TicketStatus.IN_PROGRESS,
     TicketSource.WEB, "meera@novamart.demo", "rohan@novamart.demo", 10, "Washing machine installation pending",
     "The washing machine was delivered but the free installation visit has not been scheduled yet."),
    ("TKT-000902", "aarav@novamart.demo", "NM-100040", TicketCategory.DELIVERY, TicketPriority.LOW, TicketStatus.OPEN,
     TicketSource.WEB, "aarav@novamart.demo", None, 1, "Change TV delivery slot",
     "Please deliver the TV after 6 PM on weekdays."),
    ("TKT-000903", "meera@novamart.demo", "NM-100038", TicketCategory.RETURN, TicketPriority.HIGH, TicketStatus.ESCALATED,
     TicketSource.STAFF, "rohan@novamart.demo", "rohan@novamart.demo", 1, "Mixer grinder box damaged at pickup",
     "Customer noticed a crushed box at the pickup counter and wants a replacement unit before collecting."),
    ("TKT-000904", "aarav@novamart.demo", "NM-100035", TicketCategory.WARRANTY, TicketPriority.MEDIUM, TicketStatus.RESOLVED,
     TicketSource.WEB, "aarav@novamart.demo", "priya@novamart.demo", 15, "Left earbud not charging",
     "The left earbud stopped charging after two weeks of use."),
]


def reset(db: Session) -> None:
    db.execute(
        text(
            "TRUNCATE audit_events, action_requests, document_chunks, knowledge_documents, support_tickets, "
            "order_items, orders, inventory, customer_profiles, users, products, brands, categories, stores "
            "RESTART IDENTITY CASCADE"
        )
    )
    db.execute(text("ALTER SEQUENCE order_number_seq RESTART WITH 100100"))
    db.execute(text("ALTER SEQUENCE ticket_number_seq RESTART WITH 1001"))


def seed(db: Session) -> dict[str, int]:
    now = datetime.now(timezone.utc)

    categories: dict[str, Category] = {}
    for slug, name, parent in CATEGORIES:
        categories[slug] = Category(slug=slug, name=name, parent=categories.get(parent) if parent else None)
        db.add(categories[slug])

    stores = {code: Store(code=code, name=name, type=kind, country_code="IN", city=city, address=address)
              for code, name, kind, city, address in STORES}
    db.add_all(stores.values())

    brands: dict[str, Brand] = {}
    products: dict[str, Product] = {}
    with open(SEED_DIR / "products.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            brand = brands.setdefault(row["brand"], Brand(name=row["brand"]))
            products[row["sku"]] = Product(
                sku=row["sku"],
                name=row["name"],
                description=row["description"],
                category=categories[row["category"]],
                brand=brand,
                price=Decimal(row["price"]),
                specifications=parse_spec_pairs(row["specs"]),
                image_url=row.get("image_url") or None,
                rating_avg=Decimal(row["rating"]),
                rating_count=int(row["rating_count"]),
            )
    db.add_all(brands.values())
    db.add_all(products.values())

    rng = random.Random(7)
    for sku, product in products.items():
        for code, store in stores.items():
            if store.type == StoreType.WAREHOUSE:
                quantity, reorder_level = rng.randint(25, 90), 15
            else:
                roll = rng.random()
                quantity = 0 if roll < 0.03 else rng.randint(1, 4) if roll < 0.08 else rng.randint(6, 28)
                reorder_level = 5
            quantity = STOCK_OVERRIDES.get((sku, code), quantity)
            db.add(Inventory(store=store, product=product, quantity=quantity, reorder_level=reorder_level))

    password_hash = hash_password(DEMO_PASSWORD)
    users: dict[str, User] = {}
    for email, name, role, store_code, profile in USERS:
        user = User(email=email, full_name=name, role=role, password_hash=password_hash,
                    store=stores[store_code] if store_code else None)
        if profile:
            tier, country, city, preferred, preferences = profile
            user.profile = CustomerProfile(membership_tier=tier, country_code=country, city=city,
                                           preferred_store=stores[preferred] if preferred else None,
                                           preferences=preferences)
        users[email] = user
    db.add_all(users.values())

    orders: dict[str, Order] = {}
    for number, email, fulfillment, store_code, status, days_ago, lines in ORDERS:
        subtotal = sum((products[sku].price * qty for sku, qty in lines), Decimal("0"))
        fee = Decimal("0") if fulfillment == FulfillmentType.PICKUP or subtotal >= FREE_DELIVERY_THRESHOLD else DELIVERY_FEE
        placed_at = now - timedelta(days=days_ago, hours=rng.randint(1, 8))
        order = Order(
            order_number=number, customer=users[email], fulfillment_type=fulfillment,
            fulfillment_store=stores[store_code], status=status,
            delivery_address=ADDRESSES[email] if fulfillment == FulfillmentType.DELIVERY else None,
            subtotal=subtotal, shipping_fee=fee, total=subtotal + fee, placed_at=placed_at, updated_at=placed_at,
            items=[OrderItem(product=products[sku], quantity=qty, unit_price=products[sku].price) for sku, qty in lines],
        )
        orders[number] = order
        db.add(order)

    for (number, customer, order_number, category, priority, status, source, created_by, assigned_to,
         days_ago, subject, description) in TICKETS:
        created_at = now - timedelta(days=days_ago)
        db.add(SupportTicket(
            ticket_number=number, customer=users[customer], order=orders[order_number], category=category,
            priority=priority, status=status, source=source, created_by=users[created_by],
            assigned_to=users[assigned_to] if assigned_to else None, subject=subject, description=description,
            created_at=created_at, updated_at=created_at,
        ))

    db.add(AuditEvent(
        occurred_at=now - timedelta(hours=6), action="inventory.sync", source=AuditSource.SYSTEM,
        outcome=AuditOutcome.SUCCESS, entity_type="inventory", entity_id="ALL",
        details={"feed": "Nightly stock feed", "locations": len(stores), "products": len(products)},
    ))

    db.flush()
    return {"categories": len(categories), "stores": len(stores), "brands": len(brands), "products": len(products),
            "inventory_rows": len(products) * len(stores), "users": len(users), "orders": len(orders),
            "tickets": len(TICKETS)}


def main() -> None:
    with SessionLocal() as db:
        reset(db)
        counts = seed(db)
        db.commit()
    print("Seeded:", ", ".join(f"{k}={v}" for k, v in counts.items()))
    print(f"Demo password for every account: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
