from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import re

router = APIRouter()

class IngestReq(BaseModel):
    raw_input: str

class IngestRes(BaseModel):
    tasks: List[dict]

@router.post("/ingest", response_model=IngestRes)
def ingest(req: IngestReq):
    text = req.raw_input.strip()
    dur = None
    m = re.search(r"(\d+)\s*(m|min|minutes|h|hr|hours)", text, re.I)
    if m:
        val = int(m.group(1))
        dur = val * 60 if m.group(2).lower().startswith("h") else val
    energy = "deep" if re.search(r"\bdeep\b", text, re.I) else ("light" if re.search(r"\blight\b", text, re.I) else None)
    title = re.sub(r"(\d+\s*(m|min|minutes|h|hr|hours))|\bdeep\b|\blight\b", "", text, flags=re.I).strip()
    tasks = [{
        "id": "t_ingest_1",
        "user_id": "u_demo",
        "title": title or text,
        "duration_min": dur,
        "energy": energy,
    }]
    return {"tasks": tasks}



