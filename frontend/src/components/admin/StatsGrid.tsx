'use client'
import { useEffect, useState } from 'react'

export default function StatsGrid() {
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API}/applications/stats`)
      .then(res => res.json())
      .then(setStats)
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Stat title="Total" value={stats.total} />
      <Stat title="High Risk" value={stats.highRisk} />
      <Stat title="Avg Score" value={stats.avgScore} />
    </div>
  )
}

function Stat({ title, value }:any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <p className="text-gray-500">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}