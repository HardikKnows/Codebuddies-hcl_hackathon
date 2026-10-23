"""Add product photos from seed/products.csv to an existing database.

Only fills products whose image is empty; an image that is already set is never overwritten.
Usage (from backend/):  .venv/bin/python -m scripts.backfill_product_images
"""

import csv

from sqlalchemy import text

from app.db.session import SessionLocal
from scripts.seed_db import SEED_DIR


def main() -> None:
    with open(SEED_DIR / "products.csv", newline="", encoding="utf-8") as f:
        images = [{"sku": row["sku"], "url": row["image_url"]} for row in csv.DictReader(f) if row.get("image_url")]
    with SessionLocal() as db:
        filled = 0
        for image in images:
            filled += db.execute(
                text("UPDATE products SET image_url = :url WHERE sku = :sku AND coalesce(image_url, '') = ''"), image
            ).rowcount
        db.commit()
    print(f"Filled {filled} missing product image(s); {len(images) - filled} already had one or weren't found.")


if __name__ == "__main__":
    main()
