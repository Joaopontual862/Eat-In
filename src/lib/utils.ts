export function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function generateToken(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  const array = new Uint8Array(12)
  crypto.getRandomValues(array)
  array.forEach(b => { token += chars[b % chars.length] })
  return token
}

export function getTokenExpiry(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
}

export function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins === 1) return '1 min'
  return `${mins} min`
}
