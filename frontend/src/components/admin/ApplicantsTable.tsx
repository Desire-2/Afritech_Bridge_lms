'use client'
import { useEffect, useState } from 'react'

export default function ApplicantsTable() {
  const [apps, setApps] = useState<any[]>([])

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API}/applications/ranked`)
      .then(res => res.json())
      .then(setApps)
  }, [])

  return (
    <div className="bg-white rounded-xl shadow">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Name</th>
            <th>Score</th>
            <th>Risk</th>
            <th>Device</th>
          </tr>
        </thead>
        <tbody>
          {apps.map(a => (
            <tr key={a._id} className="border-t">
              <td className="p-2">{a.fullName}</td>
              <td>{a.score}</td>
              <td>{a.riskFlag ? '⚠️ High' : '✅ Low'}</td>
              <td>{a.hasComputer}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <a href={`${process.env.NEXT_PUBLIC_API}/applications/export`} className="block p-3 text-center bg-blue-600 text-white">
        Export to Excel
      </a>
    </div>
  )
}