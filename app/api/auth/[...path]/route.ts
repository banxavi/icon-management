import { auth, authReady } from '@/lib/auth/server'

function notConfigured() {
  return new Response(JSON.stringify({ error: 'Neon Auth is not configured' }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  })
}

const handlers = authReady()
  ? auth.handler()
  : {
      GET: async () => notConfigured(),
      POST: async () => notConfigured(),
      PUT: async () => notConfigured(),
      PATCH: async () => notConfigured(),
      DELETE: async () => notConfigured(),
    }

export const { GET, POST, PUT, PATCH, DELETE } = handlers
