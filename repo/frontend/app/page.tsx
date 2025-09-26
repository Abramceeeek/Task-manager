import Link from "next/link";

export default function Page(){
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-3">AI Scheduler</h1>
      <nav className="flex gap-4">
        <Link href="/inbox">Inbox</Link>
        <Link href="/plan">Plan</Link>
        <Link href="/schedule">Schedule</Link>
        <Link href="/settings">Settings</Link>
      </nav>
    </main>
  )
}
