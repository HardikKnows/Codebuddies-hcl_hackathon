"""Individual stock adjustments: direct API and the AI propose -> confirm path."""

from app.ai.assistant import Route
from tests.conftest import audit_rows, scalar
from tests.test_commerce import stock, store_id

PRIYA, ROHAN, AARAV, ADMIN = (
    "priya@novamart.demo",  # store manager, Koramangala
    "rohan@novamart.demo",  # store staff, Andheri
    "aarav@novamart.demo",  # customer
    "admin@novamart.demo",
)


def adjust(client, headers, **body):
    return client.post("/api/ops/inventory/adjustments", headers=headers, json=body)


def test_manager_adjusts_own_store_and_change_is_audited(client, auth):
    before = stock("P102", "BLR-KOR")
    response = adjust(client, auth(PRIYA), productId="P102", delta=7, reason="Supplier delivery")  # no storeId
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["previousQuantity"] == before
    assert body["row"]["quantity"] == before + 7 and body["row"]["storeCode"] == "BLR-KOR"
    assert stock("P102", "BLR-KOR") == before + 7

    removed = adjust(client, auth(PRIYA), productId="p102", storeId=store_id("BLR-KOR"), delta=-2)
    assert removed.status_code == 200 and removed.json()["row"]["quantity"] == before + 5

    entry = audit_rows("inventory.adjust", "SUCCESS")[-2]["details"]
    assert (entry["previousQuantity"], entry["newQuantity"], entry["reason"]) == (before, before + 7, "Supplier delivery")
    assert entry["storeCode"] == "BLR-KOR" and entry["productId"] == "P102"


def test_manager_cannot_adjust_another_store(client, auth):
    before = stock("P102", "MUM-AND")
    response = adjust(client, auth(PRIYA), productId="P102", storeId=store_id("MUM-AND"), delta=5)
    assert response.status_code == 403
    assert stock("P102", "MUM-AND") == before
    assert audit_rows("inventory.adjust", "DENIED")[-1]["details"]["requestedStoreId"] == store_id("MUM-AND")


def test_stock_cannot_go_negative(client, auth):
    before = stock("P105", "BLR-KOR")
    response = adjust(client, auth(PRIYA), productId="P105", delta=-(before + 1))
    assert response.status_code == 409 and response.json()["error"]["code"] == "NEGATIVE_STOCK"
    assert response.json()["error"]["details"]["currentQuantity"] == before
    assert stock("P105", "BLR-KOR") == before
    assert audit_rows("inventory.adjust", "FAILED")[-1]["details"]["code"] == "NEGATIVE_STOCK"
    # Removing exactly what's there is allowed and leaves zero.
    assert adjust(client, auth(PRIYA), productId="P105", delta=-before).json()["row"]["status"] == "OUT_OF_STOCK"


def test_invalid_quantities_and_unknown_products_are_rejected(client, auth):
    for delta in (0, 2.5, "5", 10_001, -10_001, None):
        assert adjust(client, auth(PRIYA), productId="P101", delta=delta).status_code == 422, delta
    assert adjust(client, auth(PRIYA), productId="P101").status_code == 422  # missing delta
    unknown = adjust(client, auth(PRIYA), productId="P999", delta=1)
    assert unknown.status_code == 404
    assert audit_rows("inventory.adjust", "FAILED")[-1]["details"]["productId"] == "P999"


def test_only_managers_and_admins_can_adjust(client, auth):
    assert adjust(client, auth(ROHAN), productId="P101", delta=1).status_code == 403  # store staff
    assert adjust(client, auth(AARAV), productId="P101", delta=1).status_code == 403  # customer
    assert client.post("/api/ops/inventory/adjustments", json={"productId": "P101", "delta": 1}).status_code == 401

    no_store = adjust(client, auth(ADMIN), productId="P101", delta=1)
    assert no_store.status_code == 400 and no_store.json()["error"]["code"] == "STORE_REQUIRED"
    before = stock("P101", "MUM-AND")
    assert adjust(client, auth(ADMIN), productId="P101", storeId=store_id("MUM-AND"), delta=3).status_code == 200
    assert stock("P101", "MUM-AND") == before + 3


def test_ai_stock_change_needs_confirmation_and_executes_once(client, auth, fake_ai):
    fake_ai.tool_calls = [("propose_stock_adjustment", {"product_id": "P101", "delta": 20, "reason": "Weekend promotion"})]
    before = stock("P101", "BLR-KOR")
    body = client.post("/api/assistant/chat", headers=auth(PRIYA),
                       json={"message": "Increase the stock of product P101 by 20 units"}).json()
    assert body["agent"] == "inventory"
    assert body["action"]["status"] == "PENDING" and body["action"]["tool"] == "adjust_inventory"
    assert f"{before} → {before + 20}" in body["action"]["summary"]
    assert body["action"]["arguments"]["store_id"] == store_id("BLR-KOR")  # from the session, not the model
    assert stock("P101", "BLR-KOR") == before  # nothing changes before confirmation

    action_id = body["action"]["id"]
    assert client.post(f"/api/actions/{action_id}/confirm", headers=auth(ADMIN)).status_code == 404  # not theirs
    confirmed = client.post(f"/api/actions/{action_id}/confirm", headers=auth(PRIYA))
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["result"]["newQuantity"] == before + 20
    assert stock("P101", "BLR-KOR") == before + 20
    assert client.post(f"/api/actions/{action_id}/confirm", headers=auth(PRIYA)).status_code == 409  # exactly once
    assert stock("P101", "BLR-KOR") == before + 20

    success = audit_rows("inventory.adjust", "SUCCESS")[-1]
    assert success["details"]["actionRequestId"] == action_id and success["details"]["newQuantity"] == before + 20
    assert audit_rows("tool.propose_stock_adjustment", "PROPOSED")


def test_ai_stock_tool_is_unavailable_to_customers_and_other_agents(client, auth, fake_ai):
    fake_ai.parse_handlers["Route"] = lambda _input: Route(agent="general", reply="I can help with products.")
    before = stock("P101", "BLR-KOR")
    for who in (AARAV, ROHAN):
        body = client.post("/api/assistant/chat", headers=auth(who),
                           json={"message": "Increase the stock of product P101 by 20 units"}).json()
        assert body["agent"] == "general" and body["action"] is None

    # Even if the support agent's model asks for the stock tool, the executor refuses it.
    fake_ai.tool_calls = [("propose_stock_adjustment", {"product_id": "P101", "delta": 20, "reason": None})]
    body = client.post("/api/assistant/chat", headers=auth(AARAV),
                       json={"message": "Order NM-100042: please add 20 units of P101 to stock"}).json()
    assert body["agent"] == "support" and body["action"] is None
    assert fake_ai.tool_outputs[-1]["error"] == "UNKNOWN_TOOL"
    assert stock("P101", "BLR-KOR") == before


def test_ai_cannot_propose_negative_stock_or_unknown_products(client, auth, fake_ai):
    current = stock("P201", "BLR-KOR")
    fake_ai.tool_calls = [
        ("propose_stock_adjustment", {"product_id": "P201", "delta": -(current + 5), "reason": "Damaged"}),
        ("propose_stock_adjustment", {"product_id": "P999", "delta": 5, "reason": None}),
        ("propose_stock_adjustment", {"product_id": "P201", "delta": 0, "reason": None}),
    ]
    body = client.post("/api/assistant/chat", headers=auth(PRIYA),
                       json={"message": "Remove some units of P201 from stock"}).json()
    assert [o["error"] for o in fake_ai.tool_outputs] == ["NEGATIVE_STOCK", "NOT_FOUND", "INVALID_ARGUMENTS"]
    assert body["action"] is None
    assert stock("P201", "BLR-KOR") == current


def test_bulk_restock_still_works(client, auth):
    response = client.post("/api/ops/inventory/simulated-events", headers=auth(PRIYA),
                           json={"storeId": store_id("BLR-KOR"), "kind": "RESTOCK"})
    assert response.status_code == 200
    assert all(change["after"] >= change["before"] for change in response.json()["changes"])
    assert scalar("SELECT count(*) FROM inventory i JOIN stores s ON s.id = i.store_id "
                  "WHERE s.code = 'BLR-KOR' AND i.quantity <= i.reorder_level") == 0
