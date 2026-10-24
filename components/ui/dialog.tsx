'use client'
import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Ctx = { open: boolean; setOpen: (value: boolean) => void }
const DialogContext = React.createContext<Ctx | null>(null)
export function Dialog({ children, open: controlled, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) { const [internal, setInternal] = React.useState(false); const open = controlled ?? internal; const setOpen = (value: boolean) => { setInternal(value); onOpenChange?.(value) }; return <DialogContext.Provider value={{open, setOpen}}>{children}</DialogContext.Provider> }
export function DialogTrigger({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) { const ctx = React.useContext(DialogContext)!; return React.cloneElement(children, { onClick: () => ctx.setOpen(true) }) }
export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) { const ctx = React.useContext(DialogContext)!; if (!ctx.open) return null; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => ctx.setOpen(false)}><div className={cn('w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl', className)} onMouseDown={e => e.stopPropagation()}><button className="absolute" aria-label="Đóng" onClick={() => ctx.setOpen(false)}><X className="size-4"/></button>{children}</div></div> }
export function DialogHeader({ children }: { children: React.ReactNode }) { return <div className="mb-5">{children}</div> }
export function DialogTitle({ children }: { children: React.ReactNode }) { return <h2 className="text-lg font-semibold text-[#1b2a41]">{children}</h2> }
