"""Executes model-requested tools: validate -> authorize (as the signed-in user) -> run or propose -> audit.

Consequential actions are never executed here. They become a PENDING ActionRequest that only the user's
explicit Confirm (a separate HTTP call, not the model) can execute, exactly once, after re-checking access.
"""

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, conflict, forbidden, not_found
from app.models import ActionRequest, Inventory, Order, User
from app.models.enums import ActionStatus, AuditOutcome, AuditSource, TicketSource
from app.schemas.assistant import ActionProposal, ActionResult, ToolTrace
from app.services import audit, inventory, tickets
from app.services.orders import find_viewable_order
from app.tools.registry import TOOLS, OrderLookupArgs, StockAdjustmentArgs, TicketProposalArgs

ORDER_NOT_FOUND = {"error": "ORDER_NOT_FOUND", "message": "No order with that number is linked to this account."}


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ToolSession:
    """Tool calls for a single assistant turn. Identity comes from the session, never from tool arguments."""

    db: Session
    user: User | None
    request_id: str | None
    allowed: frozenset[str] = frozenset(TOOLS)  # the tools this agent was given; anything else is refused
    trace: list[ToolTrace] = field(default_factory=list)
    proposal: ActionRequest | None = None

    def __call__(self, name: str, raw_arguments: str) -> str:
        spec = TOOLS.get(name)
        if spec is None or name not in self.allowed:
            return self._done(name, AuditOutcome.FAILED, "Unknown tool", {"error": "UNKNOWN_TOOL"})
        try:
            args = spec.args_model.model_validate_json(raw_arguments)
        except ValidationError as exc:
            errors = [f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()][:3]
            return self._done(name, AuditOutcome.FAILED, "Rejected invalid arguments",
                              {"error": "INVALID_ARGUMENTS", "details": errors}, {"arguments": raw_arguments[:500]})
        if self.user is None:
            return self._done(name, AuditOutcome.DENIED, "Sign-in required",
                              {"error": "SIGN_IN_REQUIRED", "message": "Ask the customer to sign in first."})
        handlers = {
            "get_order_status": self._get_order_status,
            "propose_support_ticket": self._propose_ticket,
            "propose_stock_adjustment": self._propose_stock_adjustment,
        }
        return handlers[name](args)

    def _done(self, tool: str, outcome: str, summary: str, output: dict, details: dict | None = None,
              entity: tuple[str, str] | None = None) -> str:
        self.trace.append(ToolTrace(tool=tool, outcome=outcome, summary=summary))
        audit.record(
            action=f"tool.{tool}", outcome=outcome, actor=self.user, source=AuditSource.AI_ASSISTANT,
            entity_type=entity[0] if entity else None, entity_id=entity[1] if entity else None,
            request_id=self.request_id, details={**(details or {}), "result": output.get("error") or "ok"},
        )
        return json.dumps(output, default=str)

    def _order_denied(self, tool: str, order_number: str) -> str:
        exists = self.db.scalar(select(Order.id).where(Order.order_number == order_number)) is not None
        outcome = AuditOutcome.DENIED if exists else AuditOutcome.FAILED
        reason = "Order belongs to another customer" if exists else "Order does not exist"
        # The model gets the same message either way, so it can't be used to probe other customers' orders.
        return self._done(tool, outcome, f"{order_number}: not accessible", ORDER_NOT_FOUND,
                          {"orderNumber": order_number, "reason": reason}, ("order", order_number))

    def _get_order_status(self, args: OrderLookupArgs) -> str:
        order = find_viewable_order(self.db, self.user, args.order_number)
        if order is None:
            return self._order_denied("get_order_status", args.order_number)
        output = {
            "orderNumber": order.order_number,
            "status": order.status,
            "fulfillmentType": order.fulfillment_type,
            "fulfilledFrom": order.fulfillment_store.name,
            "placedAt": order.placed_at.isoformat(),
            "lastUpdated": order.updated_at.isoformat(),
            "items": [{"name": i.product.name, "productId": i.product.sku, "quantity": i.quantity} for i in order.items],
        }
        return self._done("get_order_status", AuditOutcome.SUCCESS, f"{order.order_number}: {order.status}", output,
                          {"orderNumber": order.order_number}, ("order", order.order_number))

    def _already_proposed(self, tool: str) -> str | None:
        if self.proposal is None:
            return None
        return self._done(tool, AuditOutcome.FAILED, "Second proposal refused",
                          {"error": "ALREADY_PROPOSED", "message": "A proposal is already waiting for confirmation."})

    def _propose(self, tool: str, action_tool: str, arguments: dict, summary: str, output: dict,
                 details: dict | None = None) -> str:
        """Store a PENDING proposal (at most one per turn); nothing is executed until the user confirms."""
        action = ActionRequest(
            requested_by_id=self.user.id,
            tool_name=action_tool,
            arguments=arguments,
            summary=summary,
            expires_at=_now() + timedelta(minutes=get_settings().action_ttl_minutes),
        )
        self.db.add(action)
        self.db.commit()
        self.proposal = action
        return self._done(tool, AuditOutcome.PROPOSED, summary, output,
                          {"actionRequestId": str(action.id), "arguments": arguments, **(details or {})},
                          ("action_request", str(action.id)))

    def _propose_ticket(self, args: TicketProposalArgs) -> str:
        if refused := self._already_proposed("propose_support_ticket"):
            return refused
        order = None
        if args.order_number:
            order = find_viewable_order(self.db, self.user, args.order_number)
            if order is None:
                return self._order_denied("propose_support_ticket", args.order_number)
        elif self.user.role != "CUSTOMER":
            return self._done("propose_support_ticket", AuditOutcome.FAILED, "Order number required",
                              {"error": "ORDER_REQUIRED", "message": "Staff tickets must reference an order."})

        summary = f"{args.priority.title()} priority ticket: {args.subject}"
        if order is not None:
            summary += f" (order {order.order_number})"
        return self._propose(
            "propose_support_ticket", "create_support_ticket", args.model_dump(mode="json"), summary,
            {"status": "AWAITING_CUSTOMER_CONFIRMATION", "message": "The ticket is NOT created yet. "
             "Tell the customer to review the details and press Confirm."},
        )

    def _propose_stock_adjustment(self, args: StockAdjustmentArgs) -> str:
        tool = "propose_stock_adjustment"
        if refused := self._already_proposed(tool):
            return refused
        try:
            # store_id=None: the store always comes from the manager's session, never from the model.
            store, product = inventory.authorize_adjustment(self.db, self.user, sku=args.product_id, store_id=None)
        except AppError as exc:
            outcome = AuditOutcome.DENIED if exc.status_code == 403 else AuditOutcome.FAILED
            return self._done(tool, outcome, exc.message, {"error": exc.code, "message": exc.message},
                              {"productId": args.product_id, "delta": args.delta})
        current = self.db.scalar(
            select(Inventory.quantity).where(Inventory.store_id == store.id, Inventory.product_id == product.id)
        )
        if current is None or current + args.delta < 0:
            message = (f"{product.name} is not stocked at {store.name}." if current is None
                       else f"Only {current} units are in stock, so {-args.delta} cannot be removed.")
            return self._done(tool, AuditOutcome.FAILED, message,
                              {"error": "NOT_STOCKED" if current is None else "NEGATIVE_STOCK", "message": message},
                              {"productId": product.sku, "delta": args.delta}, ("inventory", f"{store.code}/{product.sku}"))
        resulting = current + args.delta
        verb = "Add" if args.delta > 0 else "Remove"
        summary = f"{verb} {abs(args.delta)} × {product.name} ({product.sku}) at {store.name}: {current} → {resulting} units"
        return self._propose(
            tool, "adjust_inventory",
            {"product_id": product.sku, "delta": args.delta, "reason": args.reason, "store_id": store.id},
            summary,
            {"status": "AWAITING_MANAGER_CONFIRMATION", "currentQuantity": current, "resultingQuantity": resulting,
             "message": "Stock is NOT changed yet. Tell the manager to review the change and press Confirm."},
            {"currentQuantity": current, "resultingQuantity": resulting},
        )


def proposal_out(action: ActionRequest) -> ActionProposal:
    return ActionProposal(id=action.id, tool=action.tool_name, status=action.status, summary=action.summary,
                          arguments=action.arguments, expires_at=action.expires_at)


@dataclass
class Execution:
    result: dict
    message: str
    entity: tuple[str, str]
    details: dict


def _execute_ticket(db: Session, user: User, action: ActionRequest) -> Execution:
    args = TicketProposalArgs.model_validate(action.arguments)
    order = None
    if args.order_number:  # re-check access at execution time, not just at proposal time
        order = find_viewable_order(db, user, args.order_number)
        if order is None:
            raise forbidden("You no longer have access to this order.")
    ticket = tickets.create_ticket(
        db, created_by=user, order=order, category=args.category, priority=args.priority,
        subject=args.subject, description=args.description, source=TicketSource.AI_ASSISTANT,
    )
    return Execution(result={"ticketNumber": ticket.ticket_number}, message=f"Support ticket {ticket.ticket_number} created.",
                     entity=("support_ticket", ticket.ticket_number), details=dict(action.arguments))


def _execute_stock_adjustment(db: Session, user: User, action: ActionRequest) -> Execution:
    args = StockAdjustmentArgs.model_validate({key: action.arguments.get(key) for key in ("product_id", "delta", "reason")})
    # Permission and store scope are re-checked for the confirming user; stock is read inside the atomic UPDATE.
    store, product = inventory.authorize_adjustment(db, user, sku=args.product_id, store_id=action.arguments.get("store_id"))
    previous, new = inventory.apply_adjustment(db, store=store, product=product, delta=args.delta)
    return Execution(
        result={"productId": product.sku, "productName": product.name, "storeName": store.name,
                "previousQuantity": previous, "newQuantity": new, "delta": args.delta},
        message=f"Stock updated: {product.name} at {store.name} is now {new} units (was {previous}).",
        entity=("inventory", f"{store.code}/{product.sku}"),
        details={"productId": product.sku, "storeId": store.id, "storeCode": store.code, "delta": args.delta,
                 "reason": args.reason, "previousQuantity": previous, "newQuantity": new},
    )


@dataclass(frozen=True)
class ActionKind:
    audit_action: str
    execute: Callable[[Session, User, ActionRequest], Execution]
    cancelled_message: str


ACTION_KINDS: dict[str, ActionKind] = {
    "create_support_ticket": ActionKind("ticket.create", _execute_ticket, "Cancelled. No ticket was created."),
    "adjust_inventory": ActionKind("inventory.adjust", _execute_stock_adjustment, "Cancelled. No stock was changed."),
}


def _load_for_decision(db: Session, user: User, action_id: UUID, request_id: str | None, verb: str) -> ActionRequest:
    action = db.scalar(select(ActionRequest).where(ActionRequest.id == action_id).with_for_update())
    if action is None or action.requested_by_id != user.id:
        if action is not None:
            audit.record(action=f"action.{verb}", outcome=AuditOutcome.DENIED, actor=user, entity_type="action_request",
                         entity_id=str(action_id), request_id=request_id, details={"reason": "Not the requesting user"})
        raise not_found("This action was not found.")
    if action.status != ActionStatus.PENDING:
        raise conflict("ACTION_NOT_PENDING", f"This action was already {action.status.lower()}.", status=action.status)
    if action.expires_at <= _now():
        action.status = ActionStatus.EXPIRED
        action.decided_at = _now()
        db.commit()
        audit.record(action=f"action.{verb}", outcome=AuditOutcome.EXPIRED, actor=user, entity_type="action_request",
                     entity_id=str(action.id), request_id=request_id)
        raise AppError(410, "ACTION_EXPIRED", "This request expired. Ask the assistant again.")
    return action


def confirm_action(db: Session, user: User, action_id: UUID, request_id: str | None) -> ActionResult:
    action = _load_for_decision(db, user, action_id, request_id, "confirm")
    kind = ACTION_KINDS[action.tool_name]
    try:
        execution = kind.execute(db, user, action)
        action.status = ActionStatus.EXECUTED
        action.result = execution.result
        action.decided_at = _now()
        db.commit()
    except AppError as exc:
        db.rollback()
        db.execute(
            update(ActionRequest)
            .where(ActionRequest.id == action_id, ActionRequest.status == ActionStatus.PENDING)
            .values(status=ActionStatus.FAILED, decided_at=_now(), result={"error": exc.code})
        )
        db.commit()
        audit.record(action=kind.audit_action, outcome=AuditOutcome.DENIED if exc.status_code == 403 else AuditOutcome.FAILED,
                     actor=user, source=AuditSource.AI_ASSISTANT, entity_type="action_request", entity_id=str(action_id),
                     request_id=request_id, details={"code": exc.code, "message": exc.message})
        raise

    audit.record(
        action=kind.audit_action, outcome=AuditOutcome.SUCCESS, actor=user, source=AuditSource.AI_ASSISTANT,
        entity_type=execution.entity[0], entity_id=execution.entity[1], request_id=request_id,
        details={"actionRequestId": str(action.id), "confirmedByUser": True, **execution.details},
    )
    return ActionResult(id=action.id, status=action.status, result=action.result, message=execution.message)


def cancel_action(db: Session, user: User, action_id: UUID, request_id: str | None) -> ActionResult:
    action = _load_for_decision(db, user, action_id, request_id, "cancel")
    kind = ACTION_KINDS[action.tool_name]
    action.status = ActionStatus.CANCELLED
    action.decided_at = _now()
    db.commit()
    audit.record(action=kind.audit_action, outcome=AuditOutcome.CANCELLED, actor=user, source=AuditSource.AI_ASSISTANT,
                 entity_type="action_request", entity_id=str(action.id), request_id=request_id,
                 details={"summary": action.summary})
    return ActionResult(id=action.id, status=action.status, result=None, message=kind.cancelled_message)
