from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ProposedEvent(BaseModel):
    task_id: str
    start_dt: str
    end_dt: str

class FixedEvent(BaseModel):
    id: str
    start_dt: str
    end_dt: str

class CriticReq(BaseModel):
    proposed_events: List[ProposedEvent]
    fixed_events: List[FixedEvent]

class CriticRes(BaseModel):
    approve: bool
    replan_request: Optional[dict] = None
    violations: List[str] = []

router = APIRouter()

@router.post("/critic", response_model=CriticRes)
def critic(req: CriticReq):
    violations: list[str] = []
    for pe in req.proposed_events:
        ps = datetime.fromisoformat(pe.start_dt)
        pe_ = datetime.fromisoformat(pe.end_dt)
        for fe in req.fixed_events:
            fs = datetime.fromisoformat(fe.start_dt)
            fe_ = datetime.fromisoformat(fe.end_dt)
            if not (pe_ <= fs or ps >= fe_):
                violations.append(f"overlap:{pe.task_id}:{fe.id}")
    approve = len(violations) == 0
    return {"approve": approve, "replan_request": None if approve else {"reason":"overlap","hints":["adjust windows"]}, "violations": violations}



