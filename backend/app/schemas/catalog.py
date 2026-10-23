from app.models.enums import Availability
from app.schemas.common import CamelModel


class CategoryOut(CamelModel):
    id: int
    slug: str
    name: str
    parent_slug: str | None = None


class BrandOut(CamelModel):
    id: int
    name: str


class StoreOut(CamelModel):
    id: int
    code: str
    name: str
    type: str
    city: str
    country_code: str
    address: str


class StoreAvailability(CamelModel):
    store_id: int
    store_code: str
    store_name: str
    city: str
    type: str
    quantity: int
    status: Availability


class ProductSummary(CamelModel):
    product_id: str  # public SKU, e.g. "P101"
    name: str
    brand: str
    category: str
    category_slug: str
    price: float
    rating: float
    rating_count: int
    image_url: str | None
    short_description: str
    availability: Availability  # at the selected store, or across all locations
    available_quantity: int


class ProductDetail(ProductSummary):
    description: str
    specifications: dict
    stores: list[StoreAvailability]
