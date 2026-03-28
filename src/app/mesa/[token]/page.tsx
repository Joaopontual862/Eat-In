'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MenuItem, Category, CartItem, Restaurant } from '@/types'
import { formatPrice } from '@/lib/utils'

type Props = { params: { token: string } }
type Screen = 'welcome' | 'menu'

export default function MesaPage({ params }: Props) {
  const { token } = params
  const [screen, setScreen] = useState<Screen>('welcome')
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [tableNumber, setTableNumber] = useState<number | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [waiterCalled, setWaiterCalled] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: table } = await supabase
        .from('tables')
        .select('*, restaurants(*)')
        .eq('token', token)
        .gt('token_expires_at', new Date().toISOString())
        .single()

      if (!table) { setError('QR code inválido ou expirado. Solicite um novo ao atendente.'); setLoading(false); return }

      const rest = Array.isArray(table.restaurants) ? table.restaurants[0] : table.restaurants
      setRestaurant(rest)
      setTableNumber(table.number)
      setTableId(table.id)

      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', rest.id).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', rest.id).eq('available', true).order('sort_order'),
      ])
      setCategories(cats || [])
      setItems(menuItems || [])
      setLoading(false)
    }
    init()
  }, [token])

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.menu_item.id === item.id)
      if (ex) return prev.map(c => c.menu_item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menu_item: item, quantity: 1, notes: '' }]
    })
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const ex = prev.find(c => c.menu_item.id === id)
      if (ex?.quantity === 1) return prev.filter(c => c.menu_item.id !== id)
      return prev.map(c => c.menu_item.id === id ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  function getQty(id: string) { return cart.find(c => c.menu_item.id === id)?.quantity || 0 }

  const total = cart.reduce((s, c) => s + c.menu_item.price * c.quantity, 0)
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0)

  const filteredItems = activeCategory === 'all' ? items : items.filter(i => i.category_id === activeCategory)
  const grouped = categories.map(cat => ({ cat, items: filteredItems.filter(i => i.category_id === cat.id) })).filter(g => g.items.length > 0)
  const uncategorized = filteredItems.filter(i => !i.category_id)

  async function submitOrder() {
    if (cart.length === 0 || !restaurant || !tableId) return
    setSubmitting(true)

    const { data: order } = await supabase.from('orders').insert({
      restaurant_id: restaurant.id,
      table_id: tableId,
      table_number: tableNumber,
      status: 'new',
    }).select().single()

    if (order) {
      await supabase.from('order_items').insert(
        cart.map(c => ({
          order_id: order.id,
          menu_item_id: c.menu_item.id,
          menu_item_name: c.menu_item.name,
          quantity: c.quantity,
          unit_price: c.menu_item.price,
          notes: c.notes || null,
        }))
      )
      setCart([])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSubmitting(false)
  }

  async function callWaiter() {
    if (!restaurant || !tableId || waiterCalled) return
    await supabase.from('table_alerts').insert({
      restaurant_id: restaurant.id,
      table_id: tableId,
      table_number: tableNumber,
      type: 'waiter',
      resolved: false,
    })
    setWaiterCalled(true)
    setTimeout(() => setWaiterCalled(false), 30000)
  }

  const st = {
    btn: (active: boolean) => ({
      padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const,
      background: active ? 'var(--accent)' : 'var(--bg)',
      color: active ? 'var(--accent-text)' : 'var(--text2)',
      border: active ? 'none' : '0.5px solid var(--border)',
    }),
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 14, color: 'var(--text3)' }}>Carregando...</div>

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 300 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>{error}</p>
      </div>
    </div>
  )

  // TELA DE BOAS-VINDAS
  if (screen === 'welcome') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--bg2)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>☕</div>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{restaurant?.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>Seja bem-vindo!</p>
          <span style={{ display: 'inline-block', fontSize: 12, padding: '4px 14px', borderRadius: 20, background: 'var(--bg2)', border: '0.5px solid var(--border)', color: 'var(--text2)' }}>Mesa {tableNumber}</span>
        </div>
        <button
          onClick={() => setScreen('menu')}
          style={{ width: '100%', padding: 14, background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
        >
          Ver cardápio
        </button>
        <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
          Ao continuar você concorda com nossa política de privacidade.
        </p>
      </div>
    </div>
  )

  // TELA DO CARDÁPIO
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'var(--bg)' }}>

      {success && (
        <div style={{ background: 'var(--green)', color: '#fff', padding: '12px 20px', fontSize: 14, fontWeight: 500, textAlign: 'center' }}>
          Pedido enviado com sucesso! 🎉
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{restaurant?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Mesa {tableNumber}</div>
        </div>
      </div>

      {/* Categorias */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', borderBottom: '0.5px solid var(--border)', position: 'sticky', top: 56, background: 'var(--bg)', zIndex: 30 }}>
        <button onClick={() => setActiveCategory('all')} style={st.btn(activeCategory === 'all')}>Todos</button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={st.btn(activeCategory === cat.id)}>{cat.name}</button>
        ))}
      </div>

      {/* Itens */}
      <div style={{ paddingBottom: cart.length > 0 ? 200 : 80 }}>
        {grouped.map(({ cat, items: catItems }) => (
          <div key={cat.id}>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', padding: '12px 16px 6px' }}>{cat.name}</div>
            {catItems.map(item => <ItemRow key={item.id} item={item} qty={getQty(item.id)} onAdd={() => addToCart(item)} onRemove={() => removeFromCart(item.id)} />)}
          </div>
        ))}
        {uncategorized.length > 0 && uncategorized.map(item => <ItemRow key={item.id} item={item} qty={getQty(item.id)} onAdd={() => addToCart(item)} onRemove={() => removeFromCart(item.id)} />)}
      </div>

      {/* Chamar garçom */}
      <div style={{ padding: '0 16px 12px' }}>
        <button onClick={callWaiter} disabled={waiterCalled} style={{ width: '100%', padding: '11px 14px', background: waiterCalled ? 'var(--green-bg)' : 'var(--bg2)', border: `0.5px solid ${waiterCalled ? 'var(--green-border)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: waiterCalled ? 'var(--green-text)' : 'var(--text2)', fontWeight: waiterCalled ? 500 : 400 }}>
          {waiterCalled ? '✓ Garçom chamado!' : '🔔 Chamar garçom'}
        </button>
      </div>

      {/* Carrinho */}
      {cart.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', borderTop: '0.5px solid var(--border)', padding: '12px 16px' }}>
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
              {cart.map(c => (
                <div key={c.menu_item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', padding: '2px 0' }}>
                  <span><strong style={{ color: 'var(--text)' }}>{c.quantity}x</strong> {c.menu_item.name}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatPrice(c.menu_item.price * c.quantity)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>
              <span>Total</span><span>{formatPrice(total)}</span>
            </div>
          </div>
          <button onClick={submitOrder} disabled={submitting} style={{ width: '100%', padding: 13, background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enviando...' : `Confirmar pedido · ${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`}
          </button>
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, qty, onAdd, onRemove }: { item: MenuItem, qty: number, onAdd: () => void, onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, background: 'var(--bg2)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, overflow: 'hidden' }}>
        {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '☕'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.name}</div>
        {item.description && <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{item.description}</div>}
        <div style={{ fontSize: 13, fontWeight: 500 }}>{formatPrice(item.price)}</div>
      </div>
      {qty === 0 ? (
        <button onClick={onAdd} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>+</button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={onRemove} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg2)', border: '0.5px solid var(--border)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 16, textAlign: 'center' }}>{qty}</span>
          <button onClick={onAdd} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
      )}
    </div>
  )
}
