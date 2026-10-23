"""The AI safety rules, tested with a scripted fake model that tries to misbehave."""

import re

from app.ai.rag.answer import FALLBACK_ANSWER, PolicyDraft
from app.ai.recommendations import Pick, Ranking, ShoppingIntent
from tests.conftest import audit_rows, scalar

AARAV, MEERA, OMAR, ROHAN = "aarav@novamart.demo", "meera@novamart.demo", "omar@novamart.demo", "rohan@novamart.demo"
CHUNK = re.compile(r"\[chunk (\d+)\] (.+?) · v(\S+) · effective \S+ › (.+)")


def excerpts(prompt: str) -> list[tuple[int, str, str, str]]:
    return [(int(i), title, version, section) for i, title, version, section in CHUNK.findall(prompt)]


def laptop_intent(_input):
    return ShoppingIntent(
        interpreted_requirement="Laptop for Java development under ₹80,000", category_slug="laptops",
        min_price=None, max_price=80000, brands=[], keywords=["16 GB RAM"], must_be_in_stock=True,
        clarifying_question=None,
    )


def test_recommendations_only_show_verified_catalog_products(client, fake_ai):
    fake_ai.parse_handlers["ShoppingIntent"] = laptop_intent
    fake_ai.parse_handlers["Ranking"] = lambda _input: Ranking(
        picks=[
            Pick(product_id="P107", reason="Ryzen 7 with 16 GB RAM handles IntelliJ and Docker."),
            Pick(product_id="P999", reason="An invented product."),
            Pick(product_id="P104", reason="Over budget, so never a candidate."),
        ],
        clarifying_question=None,
    )
    store = scalar("SELECT id FROM stores WHERE code = 'BLR-KOR'")
    response = client.post("/api/assistant/recommendations", json={"query": "Laptop for Java dev under 80k", "storeId": store})
    assert response.status_code == 200, response.text
    body = response.json()
    assert [r["productId"] for r in body["recommendations"]] == ["P107"]
    assert body["recommendations"][0]["price"] == 68990.0  # from the database
    assert body["appliedFilters"]["maxPrice"] == 80000

    candidates_prompt = fake_ai.parse_inputs["Ranking"][0]
    assert "P104" not in candidates_prompt and "P106" not in candidates_prompt  # over budget / out of stock here
    dropped = audit_rows("ai.recommendation")[-1]["details"]["droppedUnverifiedIds"]
    assert set(dropped) == {"P999", "P104"}


def test_policy_answer_cites_current_version_and_rejects_invented_citations(client, auth, fake_ai):
    def answer(prompt):
        chunks = excerpts(prompt)
        assert all(version != "2026.1" or title != "Online Return Policy" for _, title, version, _ in chunks)
        opened = next(i for i, title, _, section in chunks if section == "Opened Electronics")
        return PolicyDraft(status="ANSWERED", answer="Yes, within 7 days if it is undamaged and factory reset.",
                           cited_chunk_ids=[opened, 999999])

    fake_ai.parse_handlers["PolicyDraft"] = answer
    response = client.post("/api/assistant/policy-answers", headers=auth(AARAV),
                           json={"question": "Can I return an opened mobile phone purchased online?"})
    body = response.json()
    assert body["followUpRequired"] is False and body["confidence"] in ("HIGH", "MEDIUM")
    assert [(s["document"], s["section"], s["version"]) for s in body["sources"]] == [
        ("Online Return Policy", "Opened Electronics", "2026.2")
    ]
    assert audit_rows("ai.policy_answer")[-1]["details"]["rejectedCitations"] == [999999]


def test_policy_answer_falls_back_without_valid_evidence(client, fake_ai):
    fake_ai.parse_handlers["PolicyDraft"] = lambda _p: PolicyDraft(
        status="ANSWERED", answer="Sure, we accept crypto.", cited_chunk_ids=[424242]
    )
    body = client.post("/api/assistant/policy-answers", json={"question": "Can I pay with cryptocurrency?"}).json()
    assert body == {"answer": FALLBACK_ANSWER, "confidence": "LOW", "sources": [], "followUpRequired": True}


def test_policy_retrieval_respects_tier_country_and_audience(client, auth, fake_ai):
    seen = []
    fake_ai.parse_handlers["PolicyDraft"] = lambda prompt: (
        seen.append({title for _, title, _, _ in excerpts(prompt)})
        or PolicyDraft(status="INSUFFICIENT_EVIDENCE", answer="", cited_chunk_ids=[])
    )
    ask = lambda who, q: client.post("/api/assistant/policy-answers", headers=auth(who), json={"question": q})  # noqa: E731

    ask(MEERA, "Do members get early access to the festive sale laptop offer?")
    ask(AARAV, "Do members get early access to the festive sale laptop offer?")
    ask(OMAR, "How long does delivery take and what are the delivery charges?")
    ask(AARAV, "How do I process an opened device return at the returns desk?")
    ask(ROHAN, "How do I process an opened device return at the returns desk?")

    early_access = "Festive Sale Early Access (Gold and Platinum)"
    assert early_access not in seen[0]  # Standard member
    assert early_access in seen[1]  # Gold member
    assert "UAE Delivery Policy" in seen[2] and "Delivery and Shipping Policy (India)" not in seen[2]
    assert "In-Store Returns Desk Procedure" not in seen[3]  # customers never see internal procedures
    assert "In-Store Returns Desk Procedure" in seen[4]  # staff do


def damaged_phone_ticket(order_number="NM-100042"):
    return {"order_number": order_number, "category": "DAMAGED_ITEM", "priority": "HIGH",
            "subject": "Screen cracked on arrival", "description": "The phone screen was cracked when I opened the box."}


def test_support_ticket_needs_confirmation_and_executes_once(client, auth, fake_ai):
    fake_ai.tool_calls = [("get_order_status", {"order_number": "NM-100042"}),
                          ("propose_support_ticket", damaged_phone_ticket())]
    tickets_before = scalar("SELECT count(*) FROM support_tickets")
    response = client.post("/api/assistant/chat", headers=auth(AARAV),
                           json={"message": "My order NM-100042 arrived with a cracked screen"})
    body = response.json()
    assert body["agent"] == "support" and body["action"]["status"] == "PENDING"
    assert fake_ai.tool_outputs[0]["status"] == "DELIVERED"
    assert scalar("SELECT count(*) FROM support_tickets") == tickets_before  # nothing created yet

    action_id = body["action"]["id"]
    assert client.post(f"/api/actions/{action_id}/confirm", headers=auth(MEERA)).status_code == 404  # not hers
    confirmed = client.post(f"/api/actions/{action_id}/confirm", headers=auth(AARAV))
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "EXECUTED"
    ticket = confirmed.json()["result"]["ticketNumber"]
    assert scalar("SELECT source FROM support_tickets WHERE ticket_number = :t", t=ticket) == "AI_ASSISTANT"
    assert client.post(f"/api/actions/{action_id}/confirm", headers=auth(AARAV)).status_code == 409  # exactly once
    assert audit_rows("tool.propose_support_ticket", "PROPOSED")
    assert any(r["entity_id"] == ticket for r in audit_rows("ticket.create", "SUCCESS"))


def test_support_agent_cannot_reach_other_customers_orders(client, auth, fake_ai):
    fake_ai.tool_calls = [("get_order_status", {"order_number": "NM-100031"}),  # Meera's order
                          ("propose_support_ticket", damaged_phone_ticket("NM-100031"))]
    body = client.post("/api/assistant/chat", headers=auth(AARAV),
                       json={"message": "What's the status of NM-100031?"}).json()
    assert [o["error"] for o in fake_ai.tool_outputs] == ["ORDER_NOT_FOUND", "ORDER_NOT_FOUND"]
    assert body["action"] is None
    assert any(r["entity_id"] == "NM-100031" for r in audit_rows("tool.get_order_status", "DENIED"))


def test_invalid_or_injected_tool_arguments_are_rejected(client, auth, fake_ai):
    fake_ai.tool_calls = [
        ("get_order_status", {"order_number": "NM-100042'; DROP TABLE orders;--"}),
        ("propose_support_ticket", {**damaged_phone_ticket(), "customer_id": 2}),  # extra field: refused
        ("delete_all_orders", {}),
    ]
    body = client.post("/api/assistant/chat", headers=auth(AARAV), json={"message": "Order NM-100042 help"}).json()
    assert [o["error"] for o in fake_ai.tool_outputs] == ["INVALID_ARGUMENTS", "INVALID_ARGUMENTS", "UNKNOWN_TOOL"]
    assert body["action"] is None
    assert scalar("SELECT count(*) FROM orders") > 0


def test_cancelled_and_expired_actions_never_execute(client, auth, fake_ai):
    fake_ai.tool_calls = [("propose_support_ticket", damaged_phone_ticket())]
    first = client.post("/api/assistant/chat", headers=auth(AARAV), json={"message": "NM-100042 is damaged"}).json()
    cancelled = client.post(f"/api/actions/{first['action']['id']}/cancel", headers=auth(AARAV))
    assert cancelled.json()["status"] == "CANCELLED"
    assert client.post(f"/api/actions/{first['action']['id']}/confirm", headers=auth(AARAV)).status_code == 409

    fake_ai.tool_outputs.clear()
    second = client.post("/api/assistant/chat", headers=auth(AARAV), json={"message": "NM-100042 is damaged"}).json()
    from app.db.session import engine
    from sqlalchemy import text

    with engine.begin() as conn:
        conn.execute(text("UPDATE action_requests SET expires_at = now() - interval '1 minute' WHERE id = :id"),
                     {"id": second["action"]["id"]})
    expired = client.post(f"/api/actions/{second['action']['id']}/confirm", headers=auth(AARAV))
    assert expired.status_code == 410
