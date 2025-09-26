from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any

class LearnReq(BaseModel):
    telemetry: Dict[str, Any]

class LearnRes(BaseModel):
    updated_weights: Dict[str, float]
    rationale: str

router = APIRouter()

@router.post("/learn", response_model=LearnRes)
def learn(req: LearnReq):
    weights = {"deep_work_morning": 0.5}
    observed = req.telemetry.get("observed", 1)
    new = 0.8 * weights.get("deep_work_morning", 0.5) + 0.2 * float(observed)
    return {"updated_weights": {"deep_work_morning": new}, "rationale": "EWMA update"}



