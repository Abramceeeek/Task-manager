"use client";
import { useState } from "react";
import { api } from "../../lib/api";

export default function Inbox() {
  const [raw, setRaw] = useState("Finish RILA section by Thursday 17:00, 120m deep");
  const [out, setOut] = useState<any>(null);
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-3">Inbox</h1>
      <textarea className="border p-2 w-full" rows={4} value={raw} onChange={(e)=>setRaw(e.target.value)} />
      <div className="mt-2 flex gap-2">
        <button className="px-3 py-1 bg-black text-white rounded" onClick={async ()=>{
          try {
            const res = await api("/api/ingest","POST",{raw_input: raw});
            setOut(res);
          } catch (e) { alert("Ingest failed"); }
        }}>Parse</button>
      </div>
      <pre className="mt-4 text-sm bg-gray-50 p-2 rounded">{out ? JSON.stringify(out,null,2) : "Parsed tasks will appear here"}</pre>
    </main>
  );
}



