'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EmptyState, PageHeader, Surface, SurfaceBody } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export type DirectoryPerson = {
  id: string
  fullName: string
  email: string
  contact: string
  skills: string[]
  roles: string[]
  projects: string[]
}

export function DirectoryPanel({ people }: { people: DirectoryPerson[] }) {
  const [query, setQuery] = useState('')
  const visible = people.filter((person) =>
    `${person.fullName} ${person.email} ${person.roles.join(' ')} ${person.skills.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="People"
        title="Team directory"
        description={`${people.length} people. Visible fields are name, role, projects, work email, contact, and skills.`}
      />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name, email, or skill..."
        className="max-w-md bg-card"
        aria-label="Search directory"
      />
      {visible.length === 0 ? <EmptyState title="No people match that search." action={null} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((person) => (
          <Link key={person.id} href={`/team/${person.id}`} className="block">
            <Surface interactive className="h-full">
              <SurfaceBody>
                <p className="font-display font-semibold text-foreground">{person.fullName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{person.roles.join(', ') || 'Member'}</p>
                <div className="mt-4 flex flex-col gap-1 text-sm text-muted-foreground">
                  <span>{person.projects.join(', ') || 'No project'}</span>
                  <span>{person.email}</span>
                  <span>{person.contact || 'No contact'}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1">
                  {person.skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="text-[10px]">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </SurfaceBody>
            </Surface>
          </Link>
        ))}
      </div>
    </div>
  )
}
