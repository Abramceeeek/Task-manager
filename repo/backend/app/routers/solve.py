from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.scheduler import solve_schedule

class PlannedTask(BaseModel):
    task_id: str
    duration_min: int

class FixedEvent(BaseModel):
    id: str
    start_dt: str
    end_dt: str

class SolveReq(BaseModel):
    planned_tasks: List[PlannedTask]
    fixed_events: List[FixedEvent] = []

class ProposedEvent(BaseModel):
    task_id: str
    start_dt: str
    end_dt: str
    buffer_before_min: int
    buffer_after_min: int

class SolveRes(BaseModel):
    proposed_events: List[ProposedEvent]

router = APIRouter()

@router.post("/solve", response_model=SolveRes)
def solve(req: SolveReq):
    events = solve_schedule([p.model_dump() for p in req.planned_tasks], [f.model_dump() for f in req.fixed_events], None)
    return {"proposed_events": events}
