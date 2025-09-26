"use client";
import { useState } from "react";
import { api } from "../../lib/api";

export default function Settings() {
  const [weights, setWeights] = useState<any>(null);
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-3">Settings</h1>
      <button className="px-3 py-1 border rounded" onClick={async ()=>{
        const res = await api("/api/learn","POST",{"telemetry":{"user_id":"u1","kind":"user_edit","payload":{"feature":"deep_work_morning","observed":1}}});
        setWeights(res.updated_weights);
      }}>Simulate Telemetry</button>
      <pre className="mt-4 text-sm bg-gray-50 p-2 rounded">{weights ? JSON.stringify(weights,null,2) : "Weights will appear here"}</pre>
    </main>
  );
}



