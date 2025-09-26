"use client";
import { useState } from "react";
import { api } from "../../lib/api";

export default function Plan() {
  const [planned, setPlanned] = useState<any>(null);
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-3">Plan</h1>
      <button className="px-3 py-1 bg-black text-white rounded" onClick={async ()=>{
        const tasks = [{id:"t1",user_id:"u1",title:"Finish RILA section",duration_min:120,priority:0.9,energy:"deep"}];
        const res = await api("/api/plan","POST",{tasks});
        setPlanned(res);
      }}>Auto-Plan Demo</button>
      <div className="mt-4">
        <h2 className="font-medium mb-2">Plan Preview</h2>
        <ul className="list-disc pl-5">
          {planned?.planned_tasks?.map((p:any) => (
            <li key={p.task_id}>{p.task_id}: {p.duration_min}m {p.energy}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}



