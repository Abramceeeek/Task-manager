from typing import List, Dict, Any, Optional, NamedTuple
from datetime import datetime, timedelta
import pytz
from ortools.sat.python import cp_model
import logging

logger = logging.getLogger(__name__)

class SolverInput(NamedTuple):
    date: str
    tasks: List[Dict[str, Any]]
    fixed_events: List[Dict[str, str]]
    preferences: Dict[str, Any]

class SolverOutput(NamedTuple):
    success: bool
    scheduled_blocks: List[Dict[str, Any]]
    unscheduled_tasks: List[str]
    stats: Dict[str, Any]
    messages: List[str]

class TaskScheduler:
    def __init__(self, slot_minutes: int = 15, timezone: str = "Europe/London"):
        self.slot_minutes = slot_minutes
        self.timezone = pytz.timezone(timezone)

    def solve(self, input_data: SolverInput) -> SolverOutput:
        """
        Solve the task scheduling problem using OR-Tools CP-SAT.

        Constraints:
        - Tasks must fit within work hours
        - No overlapping scheduled tasks
        - Respect fixed events (blocked times)
        - Buffer time between tasks
        - Time windows (start_after, due_at)

        Objective:
        - Maximize priority-weighted scheduled tasks
        - Prefer deep work in morning hours
        - Minimize after-hours scheduling
        - Minimize tardiness (past due dates)
        """
        try:
            messages = []

            # Parse date and preferences
            target_date = datetime.fromisoformat(input_data.date).date()
            prefs = input_data.preferences

            # Create timezone-aware datetime objects for work hours
            work_start_time = datetime.combine(
                target_date,
                datetime.strptime(prefs["work_start"], "%H:%M").time()
            )
            work_start = self.timezone.localize(work_start_time)

            work_end_time = datetime.combine(
                target_date,
                datetime.strptime(prefs["work_end"], "%H:%M").time()
            )
            work_end = self.timezone.localize(work_end_time)

            if prefs.get("allow_overtime", False):
                work_end += timedelta(minutes=prefs.get("max_overtime_minutes", 120))

            # Calculate total work minutes and slots
            total_minutes = int((work_end - work_start).total_seconds() / 60)
            total_slots = total_minutes // self.slot_minutes

            if total_slots <= 0:
                return SolverOutput(False, [], [t["id"] for t in input_data.tasks],
                                    {"reason": "invalid_work_hours"},
                                    ["Invalid work hours configuration"])

            # Create CP-SAT model
            model = cp_model.CpModel()

            # Process tasks
            tasks = []
            for task in input_data.tasks:
                # Convert estimated minutes to slots (round up)
                duration_slots = max(1, (task["estimated_minutes"] + self.slot_minutes - 1) // self.slot_minutes)

                # Calculate time windows
                earliest_slot = 0
                latest_start_slot = total_slots - duration_slots

                if task.get("start_after"):
                    start_after = datetime.fromisoformat(task["start_after"])
                    if start_after.tzinfo is None:
                        start_after = self.timezone.localize(start_after)
                    if start_after > work_start:
                        earliest_slot = max(0, int((start_after - work_start).total_seconds() / 60) // self.slot_minutes)

                if task.get("due_at"):
                    due_at = datetime.fromisoformat(task["due_at"])
                    if due_at.tzinfo is None:
                        due_at = self.timezone.localize(due_at)
                    if due_at < work_end:
                        latest_deadline_slot = int((due_at - work_start).total_seconds() / 60) // self.slot_minutes
                        latest_start_slot = min(latest_start_slot, latest_deadline_slot - duration_slots)

                # Skip tasks that can't fit
                if earliest_slot > latest_start_slot or latest_start_slot < 0:
                    messages.append(f"Task '{task['title']}' cannot fit in schedule")
                    continue

                tasks.append({
                    **task,
                    "duration_slots": duration_slots,
                    "earliest_slot": earliest_slot,
                    "latest_start_slot": latest_start_slot
                })

            if not tasks:
                return SolverOutput(True, [], [t["id"] for t in input_data.tasks],
                                    {"total_slots": total_slots},
                                    ["No tasks can be scheduled"])

            # Process fixed events to get blocked slots
            blocked_slots = set()
            for event in input_data.fixed_events:
                event_start = datetime.fromisoformat(event["start"])
                event_end = datetime.fromisoformat(event["end"])

                if event_start.tzinfo is None:
                    event_start = self.timezone.localize(event_start)
                if event_end.tzinfo is None:
                    event_end = self.timezone.localize(event_end)

                # Find overlapping slots
                if event_end > work_start and event_start < work_end:
                    start_slot = max(0, int((event_start - work_start).total_seconds() / 60) // self.slot_minutes)
                    end_slot = min(total_slots, (int((event_end - work_start).total_seconds() / 60) + self.slot_minutes - 1) // self.slot_minutes)

                    for slot in range(start_slot, end_slot):
                        blocked_slots.add(slot)

            # Create decision variables
            task_vars = {}
            task_scheduled = {}

            for task in tasks:
                task_id = task["id"]
                # Start time variable (slot index)
                start_var = model.NewIntVar(
                    task["earliest_slot"],
                    task["latest_start_slot"],
                    f"start_{task_id}"
                )
                # Scheduled boolean variable
                scheduled_var = model.NewBoolVar(f"scheduled_{task_id}")

                task_vars[task_id] = start_var
                task_scheduled[task_id] = scheduled_var

            # Constraint: No overlapping tasks
            for i, task_a in enumerate(tasks):
                for j, task_b in enumerate(tasks[i+1:], i+1):
                    task_a_id = task_a["id"]
                    task_b_id = task_b["id"]

                    # If both tasks are scheduled, they must not overlap
                    # Task A ends before Task B starts OR Task B ends before Task A starts
                    overlap_constraint = model.NewBoolVar(f"no_overlap_{task_a_id}_{task_b_id}")

                    # Task A before Task B
                    model.Add(
                        task_vars[task_a_id] + task_a["duration_slots"] + 1 <= task_vars[task_b_id]
                    ).OnlyEnforceIf([task_scheduled[task_a_id], task_scheduled[task_b_id], overlap_constraint])

                    # Task B before Task A
                    model.Add(
                        task_vars[task_b_id] + task_b["duration_slots"] + 1 <= task_vars[task_a_id]
                    ).OnlyEnforceIf([task_scheduled[task_a_id], task_scheduled[task_b_id], overlap_constraint.Not()])

                    # At least one must be true if both scheduled
                    model.AddImplication(
                        task_scheduled[task_a_id].And(task_scheduled[task_b_id]),
                        overlap_constraint.Or(overlap_constraint.Not())
                    )

            # Constraint: Avoid blocked slots (fixed events)
            for task in tasks:
                task_id = task["id"]
                for slot in blocked_slots:
                    for task_slot_offset in range(task["duration_slots"]):
                        # If task is scheduled and occupies this slot, constraint violated
                        slot_conflict = model.NewBoolVar(f"conflict_{task_id}_{slot}_{task_slot_offset}")
                        model.Add(
                            task_vars[task_id] + task_slot_offset == slot
                        ).OnlyEnforceIf([task_scheduled[task_id], slot_conflict])

                        model.Add(slot_conflict == 0)  # Forbid conflicts

            # Buffer constraint: Add buffer between consecutive tasks
            buffer_slots = max(1, prefs.get("buffer_minutes", 15) // self.slot_minutes)

            for i, task_a in enumerate(tasks):
                for j, task_b in enumerate(tasks[i+1:], i+1):
                    task_a_id = task_a["id"]
                    task_b_id = task_b["id"]

                    # If Task A comes before Task B, ensure buffer
                    buffer_constraint = model.NewBoolVar(f"buffer_{task_a_id}_{task_b_id}")
                    model.Add(
                        task_vars[task_a_id] + task_a["duration_slots"] + buffer_slots <= task_vars[task_b_id]
                    ).OnlyEnforceIf([task_scheduled[task_a_id], task_scheduled[task_b_id], buffer_constraint])

                    # Similar constraint for reverse order
                    buffer_constraint_rev = model.NewBoolVar(f"buffer_{task_b_id}_{task_a_id}")
                    model.Add(
                        task_vars[task_b_id] + task_b["duration_slots"] + buffer_slots <= task_vars[task_a_id]
                    ).OnlyEnforceIf([task_scheduled[task_a_id], task_scheduled[task_b_id], buffer_constraint_rev])

                    # One must be true if both are scheduled
                    model.AddImplication(
                        task_scheduled[task_a_id].And(task_scheduled[task_b_id]),
                        buffer_constraint.Or(buffer_constraint_rev)
                    )

            # Objective function
            objective_terms = []

            # Maximize scheduled high-priority tasks
            for task in tasks:
                priority_weight = int(task.get("priority", 0.5) * 1000)  # Scale for integer optimization
                objective_terms.append(task_scheduled[task["id"]] * priority_weight)

            # Deep work morning preference
            morning_end_slot = min(total_slots, 4 * 60 // self.slot_minutes)  # First 4 hours
            deep_work_weight = int(prefs.get("deep_work_morning", 0.6) * 500)

            for task in tasks:
                if task.get("task_type") == "deep_work" or task.get("priority", 0.5) > 0.8:
                    # Bonus for scheduling in morning
                    morning_bonus = model.NewBoolVar(f"morning_{task['id']}")
                    model.Add(
                        task_vars[task["id"]] + task["duration_slots"] <= morning_end_slot
                    ).OnlyEnforceIf([task_scheduled[task["id"]], morning_bonus])

                    objective_terms.append(morning_bonus * deep_work_weight)

            # Penalty for tardiness (scheduling past due date)
            for task in tasks:
                if task.get("due_at"):
                    due_at = datetime.fromisoformat(task["due_at"])
                    if due_at.tzinfo is None:
                        due_at = self.timezone.localize(due_at)

                    due_slot = int((due_at - work_start).total_seconds() / 60) // self.slot_minutes
                    if due_slot < total_slots:
                        tardiness_penalty = model.NewBoolVar(f"tardiness_{task['id']}")
                        model.Add(
                            task_vars[task["id"]] + task["duration_slots"] > due_slot
                        ).OnlyEnforceIf([task_scheduled[task["id"]], tardiness_penalty])

                        objective_terms.append(tardiness_penalty * -2000)  # High penalty

            model.Maximize(sum(objective_terms))

            # Solve
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = 30.0  # 30 second timeout

            status = solver.Solve(model)

            if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
                return SolverOutput(False, [], [t["id"] for t in tasks],
                                    {"solver_status": solver.StatusName(status)},
                                    [f"Solver failed: {solver.StatusName(status)}"])

            # Extract solution
            scheduled_blocks = []
            unscheduled_tasks = []

            for task in tasks:
                task_id = task["id"]
                if solver.Value(task_scheduled[task_id]):
                    start_slot = solver.Value(task_vars[task_id])
                    start_time = work_start + timedelta(minutes=start_slot * self.slot_minutes)
                    end_time = start_time + timedelta(minutes=task["duration_slots"] * self.slot_minutes)

                    scheduled_blocks.append({
                        "task_id": task_id,
                        "title": task["title"],
                        "start": start_time.isoformat(),
                        "end": end_time.isoformat(),
                        "block_type": "task",
                        "confidence": 1.0
                    })
                else:
                    unscheduled_tasks.append(task_id)

            # Sort blocks by start time
            scheduled_blocks.sort(key=lambda x: x["start"])

            # Add buffer blocks
            buffer_blocks = []
            buffer_minutes = prefs.get("buffer_minutes", 15)

            for i in range(len(scheduled_blocks) - 1):
                current_end = datetime.fromisoformat(scheduled_blocks[i]["end"])
                next_start = datetime.fromisoformat(scheduled_blocks[i + 1]["start"])

                gap_minutes = (next_start - current_end).total_seconds() / 60
                if gap_minutes >= buffer_minutes:
                    buffer_end = current_end + timedelta(minutes=buffer_minutes)
                    buffer_blocks.append({
                        "title": "Buffer",
                        "start": current_end.isoformat(),
                        "end": buffer_end.isoformat(),
                        "block_type": "buffer",
                        "confidence": 0.8
                    })

            all_blocks = scheduled_blocks + buffer_blocks
            all_blocks.sort(key=lambda x: x["start"])

            stats = {
                "total_tasks": len(input_data.tasks),
                "scheduled_tasks": len(scheduled_blocks),
                "unscheduled_tasks": len(unscheduled_tasks),
                "total_scheduled_minutes": sum(
                    (datetime.fromisoformat(b["end"]) - datetime.fromisoformat(b["start"])).total_seconds() / 60
                    for b in scheduled_blocks
                ),
                "solver_status": solver.StatusName(status),
                "solve_time_seconds": solver.WallTime()
            }

            return SolverOutput(
                success=True,
                scheduled_blocks=all_blocks,
                unscheduled_tasks=unscheduled_tasks,
                stats=stats,
                messages=messages
            )

        except Exception as e:
            logger.error(f"Solver error: {str(e)}", exc_info=True)
            return SolverOutput(False, [], [t["id"] for t in input_data.tasks],
                                {"error": str(e)},
                                [f"Solver exception: {str(e)}"])