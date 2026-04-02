import React from 'react'

export default function StaffSkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="py-4 px-4">
          <div
            className="h-4 bg-muted-fill rounded animate-pulse"
            style={{ width: `${60 + Math.random() * 30}%` }}
          />
        </td>
      ))}
    </tr>
  )
}

