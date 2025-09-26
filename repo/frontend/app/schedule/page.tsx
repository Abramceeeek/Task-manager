"use client";
import { useState } from "react";
import { api } from "../../lib/api";

export default function Schedule() {
  const [events, setEvents] = useState<any[]>([]);
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-3">Schedule</h1>
      <div className="flex gap-2">
        <button className="px-3 py-1 border rounded" onClick={async ()=>{
          const planned_tasks = [{task_id:"t1",duration_min:120,priority:0.9,energy:"deep"}];
          const fixed_events = [{id:"f1",start_dt:"2025-09-25T09:30:00+01:00",end_dt:"2025-09-25T10:00:00+01:00",is_blocking:true,location:null,source:"seed"}];
          const solve = await api("/api/solve","POST",{planned_tasks,fixed_events});
          setEvents(solve.proposed_events);
        }}>Solve</button>
        <button className="px-3 py-1 bg-black text-white rounded" onClick={async ()=>{
          const diff = await api("/api/apply?dry_run=true","POST",{events});
          alert("Dry-run diff:\n" + JSON.stringify(diff, null, 2));
        }}>Dry-Run Apply</button>
      </div>
      <pre className="mt-4 text-sm bg-gray-50 p-2 rounded">{JSON.stringify(events,null,2)}</pre>
    </main>
  );
}



