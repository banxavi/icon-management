import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

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
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b86f3c]">People</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#1b2a41]">Team directory</h1>
        <p className="mt-2 text-sm text-slate-500">{people.length} people. Name, role, projects, email, contact, and skills.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => (
          <Link key={person.id} href={`/team/${person.id}`}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-5">
                <p className="font-semibold text-[#1b2a41]">{person.fullName}</p>
                <p className="mt-1 text-xs text-slate-500">{person.roles.join(', ') || 'Member'}</p>
                <div className="mt-4 flex flex-col gap-1 text-sm text-slate-600">
                  <span>{person.projects.join(', ') || 'No project'}</span>
                  <span>{person.email}</span>
                  <span>{person.contact || 'No contact'}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1">
                  {person.skills.map((skill) => <Badge key={skill} variant="outline" className="text-[10px]">{skill}</Badge>)}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
