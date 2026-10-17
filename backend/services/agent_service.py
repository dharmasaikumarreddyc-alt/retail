"""Agent service for managing agent tasks and orchestration."""

from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from database.models import AgentRunDB, FeedEventDB, SpendingRulesDB, OrderDB, ApprovalDB
from agents import AgentOrchestrator


class AgentService:
    """Service for agent task management and orchestration."""

    def __init__(self):
        self._orchestrator: Optional[AgentOrchestrator] = None

    @property
    def orchestrator(self) -> AgentOrchestrator:
        if self._orchestrator is None:
            self._orchestrator = AgentOrchestrator()
        return self._orchestrator

    async def create_task(
        self,
        db: AsyncSession,
        user_id: str,
        task: str
    ) -> Dict[str, Any]:
        """
        Create and execute a new agent task.

        Args:
            db: Database session
            user_id: User ID
            task: Natural language task

        Returns:
            Task result with status and details
        """
        # Get user's spending rules
        rules_result = await db.execute(
            select(SpendingRulesDB).where(SpendingRulesDB.user_id == user_id)
        )
        rules_db = rules_result.scalar_one_or_none()

        user_rules = None
        if rules_db:
            user_rules = {
                "monthly_budget": rules_db.monthly_budget,
                "current_spent": await self._get_current_month_spent(db, user_id),
                "categories": rules_db.categories,
                "guardrails": rules_db.guardrails,
                "merchant_whitelist": rules_db.merchant_whitelist,
                "merchant_blacklist": rules_db.merchant_blacklist
            }

        # Create agent run record
        agent_run = AgentRunDB(
            user_id=user_id,
            task=task,
            status="running",
            detail="Processing your request...",
            time=datetime.now().strftime("%I:%M %p")
        )
        db.add(agent_run)
        await db.commit()
        await db.refresh(agent_run)

        # Execute the task
        result = await self.orchestrator.process_task(
            task=task,
            user_id=user_id,
            user_rules=user_rules,
            user_address="123 Main St, Mumbai 400001"  # Would come from user profile
        )

        # Update agent run with result
        agent_run.status = result.get("status", "completed")
        agent_run.detail = self._get_status_detail(result)
        agent_run.steps = result.get("steps", [])
        agent_run.result = result

        if result.get("status") == "completed":
            agent_run.completed_at = datetime.utcnow()

        # Save feed events
        for event in result.get("feed_events", []):
            feed_event = FeedEventDB(
                user_id=user_id,
                type=event["type"],
                title=event["title"],
                detail=event["detail"],
                time=event["time"],
                status=event["status"],
                agent_run_id=agent_run.id
            )
            db.add(feed_event)

        # If order was placed, save it
        if result.get("order"):
            order_data = result["order"]
            order = OrderDB(
                id=order_data["id"],
                user_id=user_id,
                merchant=order_data["merchant"],
                items=order_data["items"],
                total=order_data["total"],
                savings=order_data.get("savings", 0),
                date=order_data["date"],
                status=order_data["status"],
                agent_task=order_data["agent_task"],
                card=order_data["card"],
                address=order_data["address"],
                steps=order_data["steps"]
            )
            db.add(order)

        # If approval needed, create approval record
        if result.get("approval_needed"):
            approval_data = result["approval_needed"]
            approval = ApprovalDB(
                user_id=user_id,
                merchant=approval_data["merchant"],
                item=approval_data["item"],
                qty=approval_data.get("qty", 1),
                amount=approval_data["amount"],
                reason=approval_data["reason"],
                comparison=approval_data.get("comparison", []),
                status="pending",
                expires_at=datetime.fromisoformat(approval_data["expires_at"]),
                agent_task_id=agent_run.id
            )
            db.add(approval)

        await db.commit()
        await db.refresh(agent_run)

        return {
            "id": agent_run.id,
            "task": agent_run.task,
            "status": agent_run.status,
            "detail": agent_run.detail,
            "time": agent_run.time,
            "result": result
        }

    async def get_tasks(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get user's agent tasks."""
        result = await db.execute(
            select(AgentRunDB)
            .where(AgentRunDB.user_id == user_id)
            .order_by(desc(AgentRunDB.created_at))
            .limit(limit)
        )
        runs = result.scalars().all()

        return [
            {
                "id": run.id,
                "task": run.task,
                "status": run.status,
                "detail": run.detail,
                "time": run.time
            }
            for run in runs
        ]

    async def get_task(
        self,
        db: AsyncSession,
        user_id: str,
        task_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a specific agent task."""
        result = await db.execute(
            select(AgentRunDB)
            .where(AgentRunDB.id == task_id, AgentRunDB.user_id == user_id)
        )
        run = result.scalar_one_or_none()

        if not run:
            return None

        return {
            "id": run.id,
            "task": run.task,
            "status": run.status,
            "detail": run.detail,
            "time": run.time,
            "steps": run.steps,
            "result": run.result
        }

    async def get_feed_events(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get user's feed events."""
        result = await db.execute(
            select(FeedEventDB)
            .where(FeedEventDB.user_id == user_id)
            .order_by(desc(FeedEventDB.created_at))
            .limit(limit)
        )
        events = result.scalars().all()

        return [
            {
                "id": event.id,
                "type": event.type,
                "title": event.title,
                "detail": event.detail,
                "time": event.time,
                "status": event.status
            }
            for event in events
        ]

    async def _get_current_month_spent(self, db: AsyncSession, user_id: str) -> float:
        """Calculate total spent this month."""
        now = datetime.utcnow()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        result = await db.execute(
            select(OrderDB)
            .where(
                OrderDB.user_id == user_id,
                OrderDB.created_at >= start_of_month
            )
        )
        orders = result.scalars().all()
        return sum(order.total for order in orders)

    def _get_status_detail(self, result: Dict) -> str:
        """Get human-readable status detail from result."""
        status = result.get("status")

        if status == "completed":
            if result.get("order"):
                return f"Order {result['order']['id']} placed successfully"
            return result.get("message", "Task completed")
        elif status == "waiting":
            return "Awaiting your approval"
        elif status == "blocked":
            return result.get("message", "Blocked by spending rules")
        elif status == "failed":
            return result.get("error", "Task failed")
        else:
            return "Processing..."
