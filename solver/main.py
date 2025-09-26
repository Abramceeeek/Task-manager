from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import pytz
from ortools.sat.python import cp_model
import json

app = FastAPI(title="Motion AI Solver", version="1.0.0")

class Task(BaseModel):
    id: int
    title: str
    duration_min: int
    priority: float
    energy: str
    deadline_dt: Optional[str] = None
    earliest_start_dt: Optional[str] = None
    latest_end_dt: Optional[str] = None
    hard_fixed: bool = False
    location: Optional[str] = None

class FixedEvent(BaseModel):
    id: int
    start_dt: str
    end_dt: str
    title: str
    is_blocking: bool = True
    is_commute: bool = False
    location: Optional[str] = None

class Preferences(BaseModel):
    work_hours_by_day: Dict[str, str]
    buffer_min: int = 15
    meeting_gap_min: int = 10
    sleep_window: str = "22:00-07:00"
    travel_speed_kmh: int = 5
    energy_profile_by_hour: Dict[str, float]
    avoid_times: List[str]
    weights: Dict[str, float]

class SolveRequest(BaseModel):
    tasks: List[Task]
    fixed_events: List[FixedEvent]
    prefs: Preferences
    date: str
    timezone: str = "Europe/London"

class ProposedEvent(BaseModel):
    task_id: int
    title: str
    start_dt: str
    end_dt: str
    reason: str

class SolveResponse(BaseModel):
    proposed_events: List[ProposedEvent]
    unscheduled: List[str]
    total_score: float

@app.get("/health")
async def health():
    return {"status": "ok", "service": "solver"}

@app.post("/solve", response_model=SolveResponse)
async def solve(request: SolveRequest):
    try:
        solver = TaskScheduler()
        result = solver.solve(
            tasks=request.tasks,
            fixed_events=request.fixed_events,
            prefs=request.prefs,
            date=request.date,
            timezone=request.timezone
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TaskScheduler:
    def __init__(self):
        self.slot_duration = 15
        self.model = None
        self.solver = None
        
    def solve(self, tasks, fixed_events, prefs, date, timezone):
        tz = pytz.timezone(timezone)
        target_date = datetime.fromisoformat(date.replace('Z', '+00:00')).date()
        
        work_start, work_end = self._get_work_hours(prefs, target_date)
        if not work_start or not work_end:
            return SolveResponse(proposed_events=[], unscheduled=[t.title for t in tasks], total_score=0)
        
        start_time = datetime.combine(target_date, work_start)
        end_time = datetime.combine(target_date, work_end)
        
        slots = self._create_time_slots(start_time, end_time)
        fixed_slots = self._get_fixed_slots(fixed_events, slots, tz)
        
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        
        task_vars = {}
        for task in tasks:
            task_vars[task.id] = {}
            for i, slot in enumerate(slots):
                var_name = f"task_{task.id}_slot_{i}"
                task_vars[task.id][i] = self.model.NewBoolVar(var_name)
        
        self._add_constraints(task_vars, tasks, slots, fixed_slots, prefs)
        self._add_objective(task_vars, tasks, slots, prefs)
        
        status = self.solver.Solve(self.model)
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            return self._extract_solution(task_vars, tasks, slots, tz)
        else:
            return SolveResponse(
                proposed_events=[],
                unscheduled=[t.title for t in tasks],
                total_score=0
            )
    
    def _get_work_hours(self, prefs, date):
        weekday = date.strftime('%A').lower()
        work_hours = prefs.work_hours_by_day.get(weekday, "09:00-18:00")
        
        if not work_hours:
            return None, None
            
        start_str, end_str = work_hours.split('-')
        start_time = datetime.strptime(start_str, '%H:%M').time()
        end_time = datetime.strptime(end_str, '%H:%M').time()
        
        return start_time, end_time
    
    def _create_time_slots(self, start_time, end_time):
        slots = []
        current = start_time
        while current < end_time:
            slots.append(current)
            current += timedelta(minutes=self.slot_duration)
        return slots
    
    def _get_fixed_slots(self, fixed_events, slots, tz):
        fixed_slots = set()
        for event in fixed_events:
            if not event.is_blocking:
                continue
                
            start_dt = datetime.fromisoformat(event.start_dt.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(event.end_dt.replace('Z', '+00:00'))
            
            for i, slot in enumerate(slots):
                slot_start = slot
                slot_end = slot + timedelta(minutes=self.slot_duration)
                
                if (start_dt <= slot_start < end_dt) or (start_dt < slot_end <= end_dt):
                    fixed_slots.add(i)
        
        return fixed_slots
    
    def _add_constraints(self, task_vars, tasks, slots, fixed_slots, prefs):
        for task in tasks:
            required_slots = (task.duration_min + self.slot_duration - 1) // self.slot_duration
            
            self.model.Add(sum(task_vars[task.id].values()) == required_slots)
            
            for i, slot in enumerate(slots):
                if i in fixed_slots:
                    self.model.Add(task_vars[task.id][i] == 0)
                
                if task.earliest_start_dt:
                    earliest = datetime.fromisoformat(task.earliest_start_dt.replace('Z', '+00:00'))
                    if slot < earliest:
                        self.model.Add(task_vars[task.id][i] == 0)
                
                if task.latest_end_dt:
                    latest = datetime.fromisoformat(task.latest_end_dt.replace('Z', '+00:00'))
                    if slot + timedelta(minutes=self.slot_duration) > latest:
                        self.model.Add(task_vars[task.id][i] == 0)
        
        for i in range(len(slots)):
            total_usage = sum(task_vars[task.id][i] for task in tasks)
            self.model.Add(total_usage <= 1)
    
    def _add_objective(self, task_vars, tasks, slots, prefs):
        objective_terms = []
        
        for task in tasks:
            for i, slot in enumerate(slots):
                if task_vars[task.id][i] in self.model.GetOrMakeIndex():
                    score = task.priority * 100
                    
                    hour = slot.hour
                    energy_multiplier = prefs.energy_profile_by_hour.get(f"{hour:02d}:00", 0.5)
                    if task.energy == 'deep':
                        score *= energy_multiplier
                    
                    if hour < 9 or hour > 18:
                        score *= 0.1
                    
                    objective_terms.append(score * task_vars[task.id][i])
        
        self.model.Maximize(sum(objective_terms))
    
    def _extract_solution(self, task_vars, tasks, slots, tz):
        proposed_events = []
        unscheduled = []
        
        for task in tasks:
            scheduled_slots = []
            for i, slot in enumerate(slots):
                if self.solver.Value(task_vars[task.id][i]):
                    scheduled_slots.append(i)
            
            if scheduled_slots:
                start_slot = min(scheduled_slots)
                end_slot = max(scheduled_slots)
                
                start_time = slots[start_slot]
                end_time = slots[end_slot] + timedelta(minutes=self.slot_duration)
                
                proposed_events.append(ProposedEvent(
                    task_id=task.id,
                    title=task.title,
                    start_dt=start_time.isoformat(),
                    end_dt=end_time.isoformat(),
                    reason=f"Scheduled {task.energy} work"
                ))
            else:
                unscheduled.append(task.title)
        
        return SolveResponse(
            proposed_events=proposed_events,
            unscheduled=unscheduled,
            total_score=self.solver.ObjectiveValue()
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)