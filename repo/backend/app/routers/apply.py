from fastapi import APIRouter, Header, Query
from pydantic import BaseModel
from typing import List
from app.services_idempotency import is_duplicate_request, remember_request

class ProposedEvent(BaseModel):
    task_id: str
    start_dt: str
    end_dt: str

class ApplyReq(BaseModel):
    events: List[ProposedEvent]

class ApplyRes(BaseModel):
    diff: List[str]
    receipts: List[str]

router = APIRouter()

@router.post("/apply", response_model=ApplyRes)
def apply(req: ApplyReq, dry_run: bool = Query(default=True), x_idempotency_key: str | None = Header(default=None)):
    key = x_idempotency_key or "no-key"
    if not dry_run and is_duplicate_request(key):
        return {"diff": [], "receipts": ["idempotent:no-op"]}
    diff = [f"ADD {e.task_id} {e.start_dt}->{e.end_dt}" for e in req.events]
    receipts: list[str] = []
    if not dry_run:
        remember_request(key)
        receipts = [f"google:{i}" for i,_ in enumerate(req.events)]
    return {"diff": diff, "receipts": receipts}



