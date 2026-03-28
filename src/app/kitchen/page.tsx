'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, TableAlert, OrderStatus } from '@/types'
import { timeAgo } from '@/lib/utils'

const COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: 'new', label: 'Novos' },
  { status: 'preparing', label: 'Em preparo' },
  { status: 'ready', label: 'Prontos' },
  { status: 'delivered', label: 'Finalizados' },
]

const NEXT: Record<OrderStatus, OrderStatus | null> = { new: 'preparing', preparing: 'ready', ready: 'delivered', delivered: null }
const BTN_LABEL: Record<OrderStatus, string> = { new: 'Iniciar preparo', preparing: 'Pronto para servir', ready: 'Marcar entregue', delivered: '' }

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [alerts, setAlerts] = useState<TableAlert[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: rest } = await supabase.from('restaurants').select('id, name').single()
    if (!rest) { setLoading(false); return }
    setRestaurantId(rest.id)
    setRestaurantName(rest.name)
    await Promise.all([loadOrders(rest.id), loadAlerts(rest.id)])
    subscribe(rest.id)
    setLoading(false)
  }

  async function loadOrders(rId: string) {
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('restaurant_id', rId).order('created_at', { ascending: false }).limit(60)
    if (data) setOrders(data as Order[])
  }

  async function loadAlerts(rId: string) {
    const { data } = await supabase.from('table_alerts').select('*').eq('restaurant_id', rId).eq('resolved', false).order('created_at', { ascending: false })
    if (data) setAlerts(data as TableAlert[])
  }

  function subscribe(rId: string) {
    supabase.channel('kitchen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${rId}` }, () => { loadOrders(rId); playSound() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => loadOrders(rId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_alerts', filter: `restaurant_id=eq.${rId}` }, () => { loadAlerts(rId); playSound() })
      .subscribe()
  }

  function playSound() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(); osc.stop(ctx.currentTime + 0.4)
    } catch {}
  }

  async function advance(orderId: string, cur: OrderStatus) {
    const next = NEXT[cur]; if (!next) return
    await supabase.from('orders').update({ status: next }).eq('id', orderId)
    setOrders(p => p.map(o => o.id === orderId ? { ...o, status: next } : o))
  }

  async function resolveAlert(id: string) {
    await supabase.from('table_alerts').update({ resolved: true }).eq('id', id)
    setAlerts(p => p.filter(a => a.id !== id))
  }

  const today = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
  const allTables = [...new Set(today.map(o => o.table_number))].sort((a, b) => a - b)
  const alertsByTable: Record<number, TableAlert[]> = {}
  alerts.forEach(a => { if (!alertsByTable[a.table_number]) alertsByTable[a.table_number] = []; alertsByTable[a.table_number].push(a) })

  const s = {
    card: { background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 11, marginBottom: 8 } as React.CSSProperties,
    colHead: { fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--text3)', paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 8 },
    sideSection: { background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 11 } as React.CSSProperties,
    sideTitle: { fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 8, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' },
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 14, color: 'var(--text3)' }}>Carregando...</div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg2)', padding: 16 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{restaurantName} — Cozinha</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--green)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
            ao vivo
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ n: today.length, l: 'hoje' }, { n: orders.filter(o => o.status !== 'delivered').length, l: 'abertos' }, { n: orders.filter(o => o.status === 'ready').length, l: 'prontos' }].map(st => (
            <div key={st.l} style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '5px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{st.n}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{st.l}</div>
            </div>
          ))}
          <a href="/admin" style={{ fontSize: 12, padding: '5px 12px', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8, textDecoration: 'none', color: 'var(--text2)', display: 'flex', alignItems: 'center' }}>Admin</a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
        {/* Kanban */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {COLUMNS.map(col => {
            const colOrders = orders.filter(o => o.status === col.status)
            return (
              <div key={col.status}>
                <div style={s.colHead}>
                  {col.label}
                  {colOrders.length > 0 && <span style={{ marginLeft: 6, background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '1px 6px', fontSize: 10, color: 'var(--text2)' }}>{colOrders.length}</span>}
                </div>
                {colOrders.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', paddingTop: 16 }}>—</div>}
                {colOrders.map(order => (
                  <div key={order.id} style={{ ...s.card, opacity: col.status === 'delivered' ? 0.45 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>Mesa {order.table_number}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{timeAgo(order.created_at)}</span>
                    </div>
                    <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 7, marginBottom: col.status !== 'delivered' ? 8 : 0 }}>
                      {order.order_items?.map(item => (
                        <div key={item.id} style={{ fontSize: 11, color: 'var(--text2)', padding: '2px 0', display: 'flex', gap: 5 }}>
                          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{item.quantity}x</span>{item.menu_item_name}
                        </div>
                      ))}
                      {order.order_items?.some(i => i.notes) && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic', marginTop: 3 }}>
                          {order.order_items.filter(i => i.notes).map(i => i.notes).join(' · ')}
                        </div>
                      )}
                    </div>
                    {col.status !== 'delivered' && (
                      <button onClick={() => advance(order.id, col.status)} style={{ width: '100%', padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: col.status === 'new' ? 'var(--accent)' : col.status === 'preparing' ? 'var(--green-bg)' : 'var(--bg2)', color: col.status === 'new' ? 'var(--accent-text)' : col.status === 'preparing' ? 'var(--green-text)' : 'var(--text3)', border: col.status === 'preparing' ? '0.5px solid var(--green-border)' : '0.5px solid var(--border)' }}>
                        {BTN_LABEL[col.status]}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={s.sideSection}>
            <div style={s.sideTitle}>Alertas ativos</div>
            {alerts.length === 0 && <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>Nenhum alerta</p>}
            {alerts.map(alert => (
              <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div>
                  <span style={{ display: 'inline-block', fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 500, marginBottom: 3, background: alert.type === 'waiter' ? 'var(--amber-bg)' : 'var(--blue-bg)', color: alert.type === 'waiter' ? 'var(--amber-text)' : 'var(--blue-text)', border: `0.5px solid ${alert.type === 'waiter' ? 'var(--amber-border)' : 'var(--blue-border)'}` }}>
                    {alert.type === 'waiter' ? 'garçom' : 'pagamento'}
                  </span>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Mesa {alert.table_number}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{timeAgo(alert.created_at)}</div>
                </div>
                <button onClick={() => resolveAlert(alert.id)} style={{ fontSize: 10, border: '0.5px solid var(--border)', background: 'none', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', color: 'var(--text2)' }}>OK</button>
              </div>
            ))}
          </div>

          <div style={s.sideSection}>
            <div style={s.sideTitle}>Mesas</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {allTables.map(n => {
                const ta = alertsByTable[n] || []
                const hasW = ta.some(a => a.type === 'waiter')
                const hasP = ta.some(a => a.type === 'payment')
                const bg = hasW ? 'var(--amber-bg)' : hasP ? 'var(--blue-bg)' : 'var(--green-bg)'
                const color = hasW ? 'var(--amber-text)' : hasP ? 'var(--blue-text)' : 'var(--green-text)'
                const border = hasW ? 'var(--amber-border)' : hasP ? 'var(--blue-border)' : 'var(--green-border)'
                return (
                  <div key={n} style={{ background: bg, border: `0.5px solid ${border}`, borderRadius: 7, padding: '5px 8px', fontSize: 11, color, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, opacity: 0.7 }}>Mesa {n}</div>
                    {hasW ? 'garçom' : hasP ? 'pagamento' : 'ativa'}
                  </div>
                )
              })}
              {allTables.length === 0 && <p style={{ fontSize: 11, color: 'var(--text3)', gridColumn: '1/-1', textAlign: 'center', padding: '8px 0' }}>Nenhuma mesa ativa</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
