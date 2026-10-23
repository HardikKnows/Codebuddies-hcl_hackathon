import uuid

from tests.conftest import audit_rows, scalar

AARAV, MEERA, PRIYA, ROHAN = "aarav@novamart.demo", "meera@novamart.demo", "priya@novamart.demo", "rohan@novamart.demo"


def store_id(code: str) -> int:
    return scalar("SELECT id FROM stores WHERE code = :code", code=code)


def stock(sku: str, code: str) -> int:
    return scalar(
        "SELECT i.quantity FROM inventory i JOIN products p ON p.id = i.product_id "
        "JOIN stores s ON s.id = i.store_id WHERE p.sku = :sku AND s.code = :code",
        sku=sku, code=code,
    )


def order(client, headers, sku, qty=1, request_id=None, store="BLR-KOR"):
    return client.post(
        "/api/orders",
        headers=headers,
        json={"clientRequestId": str(request_id or uuid.uuid4()), "fulfillmentType": "PICKUP",
              "storeId": store_id(store), "items": [{"productId": sku, "quantity": qty}]},
    )


def test_catalog_filters_and_store_availability(client):
    response = client.get("/api/products", params={"category": "laptops", "storeId": store_id("BLR-KOR"), "pageSize": 50})
    assert response.status_code == 200
    items = {p["productId"]: p for p in response.json()["items"]}
    assert len(items) == 10
    assert items["P106"]["availability"] == "OUT_OF_STOCK"
    assert client.get("/api/products", params={"category": "electronics"}).json()["total"] == 40

    detail = client.get("/api/products/P101").json()
    assert {s["storeCode"] for s in detail["stores"]} == {"BLR-KOR", "BLR-WHF", "MUM-AND", "DEL-SAK", "IN-WH1"}


def test_checkout_decrements_stock_once_and_is_idempotent(client, auth):
    before = stock("P107", "BLR-KOR")
    request_id = uuid.uuid4()
    first = order(client, auth(AARAV), "P107", request_id=request_id)
    retry = order(client, auth(AARAV), "P107", request_id=request_id)
    assert first.status_code == 201 and retry.status_code == 201
    assert first.json()["orderNumber"] == retry.json()["orderNumber"]
    assert first.json()["total"] == 68990.0  # price comes from the database
    assert stock("P107", "BLR-KOR") == before - 1


def test_overselling_is_rejected_and_audited(client, auth):
    response = order(client, auth(AARAV), "P106")  # 0 in stock at Koramangala
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INSUFFICIENT_STOCK"
    assert stock("P106", "BLR-KOR") == 0
    assert any(r["details"].get("code") == "INSUFFICIENT_STOCK" for r in audit_rows("order.place", "FAILED"))


def test_customers_only_see_their_own_orders(client, auth):
    assert client.get("/api/orders/NM-100042", headers=auth(AARAV)).status_code == 200
    response = client.get("/api/orders/NM-100031", headers=auth(AARAV))  # Meera's order
    assert response.status_code == 404
    assert any(r["entity_id"] == "NM-100031" for r in audit_rows("order.view", "DENIED"))
    assert client.get("/api/orders/NM-100031", headers=auth(ROHAN)).status_code == 200  # support staff may


def test_role_and_store_permissions(client, auth):
    assert client.get("/api/ops/summary", headers=auth(AARAV)).status_code == 403
    assert client.get("/api/audit-events", headers=auth(ROHAN)).status_code == 403  # staff can't read audit
    spike = {"storeId": store_id("MUM-AND"), "kind": "DEMAND_SPIKE"}
    assert client.post("/api/ops/inventory/simulated-events", headers=auth(ROHAN), json=spike).status_code == 403
    assert client.post("/api/ops/inventory/simulated-events", headers=auth(PRIYA), json=spike).status_code == 403
    own = client.post("/api/ops/inventory/simulated-events", headers=auth(PRIYA),
                      json={"storeId": store_id("BLR-KOR"), "kind": "DEMAND_SPIKE"})
    assert own.status_code == 200
    assert all(c["status"] in ("LOW_STOCK", "OUT_OF_STOCK") for c in own.json()["changes"])


def test_audit_log_is_append_only():
    import pytest
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError

    from app.db.session import engine

    with pytest.raises(DBAPIError, match="append-only"):
        with engine.begin() as conn:
            conn.execute(text("UPDATE audit_events SET outcome = 'SUCCESS'"))
