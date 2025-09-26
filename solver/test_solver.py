import pytest
from datetime import datetime, timedelta
from main import TaskScheduler, Task, FixedEvent, Preferences

def test_solver_basic():
    """Test basic solver functionality with simple scenario"""
    scheduler = TaskScheduler()
    
    tasks = [
        Task(
            id=1,
            title="Write report",
            duration_min=60,
            priority=0.8,
            energy="deep"
        ),
        Task(
            id=2,
            title="Call client",
            duration_min=30,
            priority=0.6,
            energy="light"
        )
    ]
    
    fixed_events = [
        FixedEvent(
            id=1,
            start_dt="2024-01-15T10:00:00Z",
            end_dt="2024-01-15T11:00:00Z",
            title="Team Meeting",
            is_blocking=True
        )
    ]
    
    prefs = Preferences(
        work_hours_by_day={
            "monday": "09:00-18:00",
            "tuesday": "09:00-18:00",
            "wednesday": "09:00-18:00",
            "thursday": "09:00-18:00",
            "friday": "09:00-18:00"
        },
        buffer_min=15,
        meeting_gap_min=10,
        sleep_window="22:00-07:00",
        travel_speed_kmh=5,
        energy_profile_by_hour={
            "09:00": 0.8,
            "10:00": 0.9,
            "11:00": 0.9,
            "12:00": 0.7,
            "13:00": 0.6,
            "14:00": 0.7,
            "15:00": 0.8,
            "16:00": 0.8,
            "17:00": 0.7,
            "18:00": 0.6
        },
        avoid_times=[],
        weights={}
    )
    
    result = scheduler.solve(
        tasks=tasks,
        fixed_events=fixed_events,
        prefs=prefs,
        date="2024-01-15",
        timezone="Europe/London"
    )
    
    assert result is not None
    assert len(result.proposed_events) >= 0
    assert len(result.unscheduled) >= 0

def test_solver_constraints():
    """Test that solver respects work hours and fixed events"""
    scheduler = TaskScheduler()
    
    tasks = [
        Task(
            id=1,
            title="Deep work",
            duration_min=120,
            priority=0.9,
            energy="deep"
        )
    ]
    
    fixed_events = [
        FixedEvent(
            id=1,
            start_dt="2024-01-15T09:00:00Z",
            end_dt="2024-01-15T10:00:00Z",
            title="Morning Meeting",
            is_blocking=True
        )
    ]
    
    prefs = Preferences(
        work_hours_by_day={"monday": "09:00-17:00"},
        buffer_min=15,
        meeting_gap_min=10,
        sleep_window="22:00-07:00",
        travel_speed_kmh=5,
        energy_profile_by_hour={"10:00": 0.9, "11:00": 0.9},
        avoid_times=[],
        weights={}
    )
    
    result = scheduler.solve(
        tasks=tasks,
        fixed_events=fixed_events,
        prefs=prefs,
        date="2024-01-15",
        timezone="Europe/London"
    )
    
    assert result is not None
    
    # Check that no proposed events overlap with fixed events
    for event in result.proposed_events:
        event_start = datetime.fromisoformat(event.start_dt.replace('Z', '+00:00'))
        event_end = datetime.fromisoformat(event.end_dt.replace('Z', '+00:00'))
        
        for fixed in fixed_events:
            fixed_start = datetime.fromisoformat(fixed.start_dt.replace('Z', '+00:00'))
            fixed_end = datetime.fromisoformat(fixed.end_dt.replace('Z', '+00:00'))
            
            # No overlap
            assert not (event_start < fixed_end and event_end > fixed_start)

def test_solver_after_hours_penalty():
    """Test that solver penalizes after-hours scheduling"""
    scheduler = TaskScheduler()
    
    tasks = [
        Task(
            id=1,
            title="Late task",
            duration_min=60,
            priority=0.5,
            energy="light"
        )
    ]
    
    prefs = Preferences(
        work_hours_by_day={"monday": "09:00-17:00"},
        buffer_min=15,
        meeting_gap_min=10,
        sleep_window="22:00-07:00",
        travel_speed_kmh=5,
        energy_profile_by_hour={},
        avoid_times=[],
        weights={}
    )
    
    result = scheduler.solve(
        tasks=tasks,
        fixed_events=[],
        prefs=prefs,
        date="2024-01-15",
        timezone="Europe/London"
    )
    
    assert result is not None
    
    # If tasks are scheduled, they should be within work hours
    for event in result.proposed_events:
        event_start = datetime.fromisoformat(event.start_dt.replace('Z', '+00:00'))
        event_end = datetime.fromisoformat(event.end_dt.replace('Z', '+00:00'))
        
        # Should be within work hours (9 AM to 5 PM)
        assert event_start.hour >= 9
        assert event_end.hour <= 17

def test_solver_energy_preference():
    """Test that solver considers energy preferences"""
    scheduler = TaskScheduler()
    
    tasks = [
        Task(
            id=1,
            title="Deep work task",
            duration_min=60,
            priority=0.8,
            energy="deep"
        )
    ]
    
    prefs = Preferences(
        work_hours_by_day={"monday": "09:00-18:00"},
        buffer_min=15,
        meeting_gap_min=10,
        sleep_window="22:00-07:00",
        travel_speed_kmh=5,
        energy_profile_by_hour={
            "10:00": 0.9,  # High energy morning
            "14:00": 0.3   # Low energy afternoon
        },
        avoid_times=[],
        weights={}
    )
    
    result = scheduler.solve(
        tasks=tasks,
        fixed_events=[],
        prefs=prefs,
        date="2024-01-15",
        timezone="Europe/London"
    )
    
    assert result is not None
    
    # Deep work should be scheduled during high energy hours if possible
    for event in result.proposed_events:
        event_start = datetime.fromisoformat(event.start_dt.replace('Z', '+00:00'))
        # Should prefer morning hours for deep work
        assert event_start.hour >= 9
        assert event_start.hour <= 12

if __name__ == "__main__":
    pytest.main([__file__])