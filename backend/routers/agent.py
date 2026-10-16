"""Agent task routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from database import get_db
from services.agent_service import AgentService
from models.agent import AgentTask, AgentRunResponse, FeedEvent
from routers.auth import get_current_user

router = APIRouter(prefix="/agent", tags=["Agent"])
agent_service = AgentService()


@router.post("/task", response_model=dict)
async def create_task(
    _task_data: AgentTask,
    _current_user = Depends(get_current_user),
):
    """Create and execute a new agent task."""
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Agent checkout is disabled until a real payment provider and authenticated order processing are configured.",
    )


@router.get("/tasks", response_model=List[AgentRunResponse])
async def get_tasks(
    limit: int = 10,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's agent tasks."""
    tasks = await agent_service.get_tasks(
        db=db,
        user_id=current_user.id,
        limit=limit
    )
    return tasks


@router.get("/tasks/{task_id}")
async def get_task(
    task_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific agent task."""
    task = await agent_service.get_task(
        db=db,
        user_id=current_user.id,
        task_id=task_id
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    return task


@router.get("/feed", response_model=List[FeedEvent])
async def get_feed(
    limit: int = 20,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's agent activity feed."""
    events = await agent_service.get_feed_events(
        db=db,
        user_id=current_user.id,
        limit=limit
    )
    return events


@router.put("/pause")
async def pause_agent(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pause the agent."""
    current_user.agent_paused = True
    await db.commit()
    return {"status": "paused", "message": "Agent paused"}


@router.put("/resume")
async def resume_agent(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resume the agent."""
    current_user.agent_paused = False
    await db.commit()
    return {"status": "running", "message": "Agent resumed"}
