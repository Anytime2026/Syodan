interface Env {
  BACKEND_ORIGIN: string
}

const PROXY_PREFIXES = ['/api', '/health', '/internal', '/ws']

function shouldProxy(pathname: string): boolean {
  return PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  if (!shouldProxy(url.pathname)) {
    return context.next()
  }

  const origin = context.env.BACKEND_ORIGIN?.replace(/\/$/, '')
  if (!origin) {
    return new Response('BACKEND_ORIGIN is not configured', { status: 500 })
  }

  const target = new URL(`${url.pathname}${url.search}`, origin)
  return fetch(target.toString(), context.request)
}
