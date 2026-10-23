from enum import StrEnum

from app.models.enums import Role


class Permission(StrEnum):
    SHOP = "shop"  # cart, checkout, own orders and tickets
    ORDERS_VIEW_ANY = "orders:view_any"
    TICKETS_MANAGE = "tickets:manage"
    INVENTORY_VIEW = "inventory:view"
    INVENTORY_SIMULATE = "inventory:simulate"
    INVENTORY_ADJUST = "inventory:adjust"  # individual stock changes and stock imports, scoped by can_manage_store
    CATALOG_IMPORT = "catalog:import"  # create or update products from CSV (catalog is global, so admins only)
    AUDIT_VIEW = "audit:view"
    KNOWLEDGE_VIEW = "knowledge:view"


_STAFF = {Permission.ORDERS_VIEW_ANY, Permission.TICKETS_MANAGE, Permission.INVENTORY_VIEW}

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.CUSTOMER: frozenset({Permission.SHOP}),
    Role.STORE_STAFF: frozenset(_STAFF),
    Role.STORE_MANAGER: frozenset(
        _STAFF | {Permission.INVENTORY_SIMULATE, Permission.INVENTORY_ADJUST, Permission.AUDIT_VIEW, Permission.KNOWLEDGE_VIEW}
    ),
    Role.ADMIN: frozenset(
        _STAFF
        | {Permission.INVENTORY_SIMULATE, Permission.INVENTORY_ADJUST, Permission.CATALOG_IMPORT, Permission.AUDIT_VIEW,
           Permission.KNOWLEDGE_VIEW}
    ),
}

STAFF_ROLES = frozenset({Role.STORE_STAFF, Role.STORE_MANAGER, Role.ADMIN})


def has_permission(role: str, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(Role(role), frozenset())


def can_view_order(user, order) -> bool:
    """Customers see only their own orders; support staff can look up any order."""
    return order.customer_id == user.id or has_permission(user.role, Permission.ORDERS_VIEW_ANY)


def can_manage_store(user, store_id: int) -> bool:
    """Store-scoped actions: managers act on their own store, admins on any store."""
    return user.role == Role.ADMIN or (user.role == Role.STORE_MANAGER and user.store_id == store_id)
