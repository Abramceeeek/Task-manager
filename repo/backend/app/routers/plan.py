from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class TaskIn(BaseModel):
    id: str
    user_id: str
    title: str
    duration_min: int | None = None
    priority: float | None = None
    energy: str | None = None
    earliest_start_dt: str | None = None
    latest_end_dt: str | None = None

class PlanReq(BaseModel):
    tasks: List[TaskIn]
    prefs: dict | None = None

class PlannedTask(BaseModel):
    task_id: str
    duration_min: int
    priority: float
    energy: str
    earliest_start_dt: str | None = None
    latest_end_dt: str | None = None

class PlanRes(BaseModel):
    planned_tasks: List[PlannedTask]

@router.post("/plan", response_model=PlanRes)
def plan(req: PlanReq):
    planned = []
    for t in req.tasks:
        planned.append(PlannedTask(
            task_id=t.id,
            duration_min=t.duration_min or 60,
            priority=t.priority or 0.7,
            energy=t.energy or "deep",
            earliest_start_dt=t.earliest_start_dt,
            latest_end_dt=t.latest_end_dt
        ))
    return {"planned_tasks": planned}



