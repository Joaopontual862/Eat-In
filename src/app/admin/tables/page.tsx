'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, Restaurant } from '@/types'
import { generateToken, getTokenExpiry } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'

export default function TablesPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [newTableNumber, setNewTableNumber] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: rest } = await supabase.from('restaurants').select('*').single()
    if (!rest) { setLoading(false); return }
    setRestaurant(rest)
    const { data: tbls } = await supabase.from('tables').select('*').eq('restaurant_id', rest.id).order('number')
    setTables(tbls || [])
    setLoading(false)
  }

  async function generateTable(num?: number) {
    const number = num ?? Number(newTableNumber)
    if (!number || !restaurant) return
    setGenerating(true)
    const token = generateToken()
    const expires = getTokenExpiry()
    const { data } = await supabase.from('tables').upsert(
      { restaurant_id: restaurant.id, number, token, token_expires_at: expires },
      { onConflict: 'restaurant_id,number' }
    ).select().single()
    if (data) {
      setTables(p => [...p.filter(t => t.number !== data.number), data].sort((a, b) => a.number - b.number))
      setNewTableNumber('')
    }
    setGenerating(false)
  }

  async function deleteTable(id: string, number: number) {
    if (!confirm(`Remover Mesa ${number}?`)) return
    await supabase.from('tables').delete().eq('id', id)
    setTables(p => p.filter(t => t.id !== id))
  }

  function printQR(table: Table) {
    const url = `${appUrl}/mesa/${table.token}`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Mesa ${table.number}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}h2{font-size:24px;margin-bottom:8px}p{color:#666;margin-bottom:24px}</style>
      </head><body>
      <h2>${restaurant?.name}</h2>
      <p>Mesa ${table.number}</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}" />
      <p style="margin-top:16px;font-size:12px;color:#999">Escaneie para fazer seu pedido</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eatinmesa.vercel.app'

  const s = {
    input: { width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '0.5px solid var(--border2)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none' } as React.CSSProperties,
    btn: { padding: '9px 18px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' } as React.CSSProperties,
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 14, color: 'var(--text3)' }}>Carregando...</div>

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>Mesas e QR codes</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Gere e gerencie os QR codes de cada mesa</p>
      </div>

      {/* Gerar nova mesa */}
      <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Número da mesa</label>
          <input type="number" min="1" placeholder="Ex: 1" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} onKeyDown={e => e.key === 'Enter' && generateTable()} style={s.input} />
        </div>
        <button onClick={() => generateTable()} disabled={generating} style={{ ...s.btn, opacity: generating ? 0.7 : 1 }}>
          {generating ? 'Gerando...' : 'Gerar QR code'}
        </button>
      </div>

      {tables.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 48 }}>
          Nenhuma mesa ainda. Gere o primeiro QR code acima!
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
        {tables.map(table => {
          const url = `${appUrl}/mesa/${table.token}`
          const expires = new Date(table.token_expires_at)
          const expired = expires < new Date()
          return (
            <div key={table.id} style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>Mesa {table.number}</span>
                <button onClick={() => deleteTable(table.id, table.number)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', background: 'var(--red-bg)', color: 'var(--red-text)', border: '0.5px solid var(--red-border)' }}>
                  Remover
                </button>
              </div>

              <div style={{ fontSize: 10, marginBottom: 12, color: expired ? 'var(--red-text)' : 'var(--green-text)', background: expired ? 'var(--red-bg)' : 'var(--green-bg)', border: `0.5px solid ${expired ? 'var(--red-border)' : 'var(--green-border)'}`, borderRadius: 8, padding: '3px 8px', display: 'inline-block' }}>
                {expired ? 'Expirado' : `Válido até ${expires.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', padding: 10, background: '#fff', border: '0.5px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
                <QRCodeSVG value={url} size={130} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <button onClick={() => window.open(url)} style={{ padding: '7px 0', fontSize: 11, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text2)' }}>
                  Testar
                </button>
                <button onClick={() => generateTable(table.number)} style={{ padding: '7px 0', fontSize: 11, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text2)' }}>
                  Renovar
                </button>
                <button onClick={() => printQR(table)} style={{ padding: '7px 0', fontSize: 11, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text2)' }}>
                  Imprimir
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
