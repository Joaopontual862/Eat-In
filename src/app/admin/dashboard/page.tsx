'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'

type Period = 'today' | '7days' | '30days'

type Metrics = {
  revenue: number
  orders: number
  avgTicket: number
  tablesServed: number
  revenuePrev: number
  ordersPrev: number
  avgTicketPrev: number
}

type TopItem = { name: string; qty: number }
type HourData = { hour: number; count: number }
type TableTicket = { table_number: number; total: number }
type WeekComparison = { label: string; revenue: number; current: boolean }

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [hourData, setHourData] = useState<HourData[]>([])
  const [tableTickets, setTableTickets] = useState<TableTicket[]>([])
  const [weekComparison, setWeekComparison] = useState<WeekComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState('')

  useEffect(() => {
    loadAll()
  }, [period])

  async function loadAll() {
    setLoading(true)
    const { data: rest } = await supabase.from('restaurants').select('id, name').single()
    if (!rest) { setLoading(false); return }
    setRestaurantName(rest.name)

    const { start, end, prevStart, prevEnd } = getDateRange(period)

    const [orders, prevOrders, items, allOrders] = await Promise.all([
      supabase.from('orders').select('id, table_number, created_at, order_items(unit_price, quantity)').eq('restaurant_id', rest.id).gte('created_at', start).lte('created_at', end),
      supabase.from('orders').select('id, order_items(unit_price, quantity)').eq('restaurant_id', rest.id).gte('created_at', prevStart).lte('created_at', prevEnd),
      supabase.from('order_items').select('menu_item_name, quantity, orders!inner(restaurant_id, created_at)').eq('orders.restaurant_id', rest.id).gte('orders.created_at', start).lte('orders.created_at', end),
      supabase.from('orders').select('id, table_number, created_at, order_items(unit_price, quantity)').eq('restaurant_id', rest.id),
    ])

    const curOrders = orders.data || []
    const pOrders = prevOrders.data || []

    // Métricas atuais
    const revenue = curOrders.reduce((s, o) => s + (o.order_items || []).reduce((a: number, i: any) => a + i.unit_price * i.quantity, 0), 0)
    const ordersCount = curOrders.length
    const avgTicket = ordersCount > 0 ? revenue / ordersCount : 0
    const tablesServed = new Set(curOrders.map(o => o.table_number)).size

    // Métricas anteriores
    const revenuePrev = pOrders.reduce((s, o) => s + (o.order_items || []).reduce((a: number, i: any) => a + i.unit_price * i.quantity, 0), 0)
    const ordersPrev = pOrders.length
    const avgTicketPrev = ordersPrev > 0 ? revenuePrev / ordersPrev : 0

    setMetrics({ revenue, orders: ordersCount, avgTicket, tablesServed, revenuePrev, ordersPrev, avgTicketPrev })

    // Top itens
    const itemMap: Record<string, number> = {}
    ;(items.data || []).forEach((i: any) => { itemMap[i.menu_item_name] = (itemMap[i.menu_item_name] || 0) + i.quantity })
    const top = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }))
    setTopItems(top)

    // Horários de pico
    const hourMap: Record<number, number> = {}
    curOrders.forEach(o => { const h = new Date(o.created_at).getHours(); hourMap[h] = (hourMap[h] || 0) + 1 })
    const hours = Array.from({ length: 18 }, (_, i) => i + 6).map(h => ({ hour: h, count: hourMap[h] || 0 }))
    setHourData(hours)

    // Ticket por mesa
    const tableMap: Record<number, number> = {}
    curOrders.forEach(o => {
      const t = (o.order_items || []).reduce((a: number, i: any) => a + i.unit_price * i.quantity, 0)
      tableMap[o.table_number] = (tableMap[o.table_number] || 0) + t
    })
    const tickets = Object.entries(tableMap).map(([n, t]) => ({ table_number: Number(n), total: t })).sort((a, b) => b.total - a.total).slice(0, 6)
    setTableTickets(tickets)

    // Comparativo: mesmo dia das últimas 4 semanas
    const today = new Date()
    const dayOfWeek = today.getDay()
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const allOrd = allOrders.data || []
    const weeks: WeekComparison[] = []
    for (let w = 3; w >= 0; w--) {
      const date = new Date(today)
      date.setDate(today.getDate() - w * 7)
      const dateStr = date.toISOString().split('T')[0]
      const dayRevenue = allOrd.filter(o => o.created_at.startsWith(dateStr)).reduce((s, o) => s + (o.order_items || []).reduce((a: number, i: any) => a + i.unit_price * i.quantity, 0), 0)
      weeks.push({ label: w === 0 ? 'Hoje' : `${dayNames[dayOfWeek]} -${w}s`, revenue: dayRevenue, current: w === 0 })
    }
    setWeekComparison(weeks)
    setLoading(false)
  }

  function getDateRange(p: Period) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = now.toISOString()

    if (p === 'today') {
      const prevDay = new Date(today); prevDay.setDate(today.getDate() - 1)
      const prevDayEnd = new Date(today); prevDayEnd.setMilliseconds(-1)
      return { start: today.toISOString(), end, prevStart: prevDay.toISOString(), prevEnd: prevDayEnd.toISOString() }
    }
    if (p === '7days') {
      const start = new Date(today); start.setDate(today.getDate() - 7)
      const prevStart = new Date(today); prevStart.setDate(today.getDate() - 14)
      const prevEnd = new Date(start); prevEnd.setMilliseconds(-1)
      return { start: start.toISOString(), end, prevStart: prevStart.toISOString(), prevEnd: prevEnd.toISOString() }
    }
    const start = new Date(today); start.setDate(today.getDate() - 30)
    const prevStart = new Date(today); prevStart.setDate(today.getDate() - 60)
    const prevEnd = new Date(start); prevEnd.setMilliseconds(-1)
    return { start: start.toISOString(), end, prevStart: prevStart.toISOString(), prevEnd: prevEnd.toISOString() }
  }

  function delta(cur: number, prev: number) {
    if (prev === 0) return null
    const pct = ((cur - prev) / prev) * 100
    const up = pct >= 0
    return <span style={{ fontSize: 11, color: up ? 'var(--green)' : 'var(--red-text)' }}>{up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}% vs anterior</span>
  }

  const maxHour = Math.max(...hourData.map(h => h.count), 1)
  const maxItem = topItems[0]?.qty || 1
  const maxWeek = Math.max(...weekComparison.map(w => w.revenue), 1)

  const periodLabel = period === 'today' ? 'hoje' : period === '7days' ? 'últimos 7 dias' : 'últimos 30 dias'

  const s = {
    card: { background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 16 } as React.CSSProperties,
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 14, color: 'var(--text3)' }}>
      Carregando dashboard...
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {restaurantName} · {periodLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['today', '7days', '30days'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 7, border: '0.5px solid var(--border)', cursor: 'pointer', background: period === p ? 'var(--accent)' : 'var(--bg)', color: period === p ? 'var(--accent-text)' : 'var(--text2)', fontWeight: period === p ? 500 : 400 }}>
              {p === 'today' ? 'Hoje' : p === '7days' ? '7 dias' : '30 dias'}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Faturamento', value: formatPrice(metrics?.revenue || 0), d: delta(metrics?.revenue || 0, metrics?.revenuePrev || 0) },
          { label: 'Pedidos', value: String(metrics?.orders || 0), d: delta(metrics?.orders || 0, metrics?.ordersPrev || 0) },
          { label: 'Ticket médio', value: formatPrice(metrics?.avgTicket || 0), d: delta(metrics?.avgTicket || 0, metrics?.avgTicketPrev || 0) },
          { label: 'Mesas atendidas', value: String(metrics?.tablesServed || 0), d: <span style={{ fontSize: 11, color: 'var(--text3)' }}>mesas únicas</span> },
        ].map(m => (
          <div key={m.label} style={s.card}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{m.value}</div>
            {m.d}
          </div>
        ))}
      </div>

      {/* Itens mais vendidos + Horários de pico */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Itens mais vendidos</div>
          {topItems.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 16 }}>Sem dados no período</p>}
          {topItems.map((item, i) => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)', width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.name}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(item.qty / maxItem) * 100}%`, background: 'var(--accent)', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)', width: 32, textAlign: 'right', flexShrink: 0 }}>{item.qty}x</span>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Horários de pico</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {hourData.map(h => {
              const pct = maxHour > 0 ? (h.count / maxHour) * 100 : 0
              const isHot = pct >= 70
              const isWarm = pct >= 35 && pct < 70
              return (
                <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }} title={`${h.hour}h: ${h.count} pedidos`}>
                  <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, background: isHot ? 'var(--accent)' : isWarm ? 'var(--text2)' : 'var(--border2)', borderRadius: '2px 2px 0 0', opacity: isHot ? 1 : isWarm ? 0.6 : 0.3 }} />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text3)' }}>
            <span>6h</span><span>9h</span><span>12h</span><span>15h</span><span>18h</span><span>21h</span><span>23h</span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} /> pico
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--text2)', opacity: 0.6 }} /> moderado
            </div>
          </div>
        </div>
      </div>

      {/* Ticket por mesa + Comparativo semanal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Ticket médio por mesa</div>
          {tableTickets.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 16 }}>Sem dados no período</p>}
          {tableTickets.map((t, i) => (
            <div key={t.table_number} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < tableTickets.length - 1 ? '0.5px solid var(--border)' : 'none', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>Mesa {t.table_number}</span>
              <span style={{ fontWeight: 500 }}>{formatPrice(t.total)}</span>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Comparativo semanal</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>
            Mesmo dia das últimas 4 semanas
          </div>
          {weekComparison.map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: w.current ? 'var(--text)' : 'var(--text2)', fontWeight: w.current ? 500 : 400, width: 52, flexShrink: 0 }}>{w.label}</span>
              <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(w.revenue / maxWeek) * 100}%`, background: w.current ? 'var(--green)' : 'var(--border2)', borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: w.current ? 500 : 400, color: w.current ? 'var(--green)' : 'var(--text2)', width: 72, textAlign: 'right', flexShrink: 0 }}>{formatPrice(w.revenue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
