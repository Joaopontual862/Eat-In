'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MenuItem, Category, CartItem, Restaurant } from '@/types'
import { formatPrice } from '@/lib/utils'

type Screen = 'welcome' | 'menu'

export default function MesaPage() {
  // ✅ tipagem correta Next 15
  const params = useParams<{ token: string }>()
  const token = params.token

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

  // ================= INIT =================
  useEffect(() => {
    async function init() {
      if (!token) return

      const { data: table } = await supabase
        .from('tables')
        .select('*, restaurants(*)')
        .eq('token', token)
        .gt('token_expires_at', new Date().toISOString())
        .single()

      if (!table) {
        setError('QR code inválido ou expirado.')
        setLoading(false)
        return
      }

      const rest = Array.isArray(table.restaurants)
        ? table.restaurants[0]
        : table.restaurants

      setRestaurant(rest)
      setTableNumber(table.number)
      setTableId(table.id)

      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('restaurant_id', rest.id)
          .order('sort_order'),

        supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', rest.id)
          .eq('available', true)
          .order('sort_order'),
      ])

      setCategories(cats || [])
      setItems(menuItems || [])
      setLoading(false)
    }

    init()
  }, [token])

  // ================= CART =================
  function addToCart(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.menu_item.id === item.id)
      if (ex)
        return prev.map(c =>
          c.menu_item.id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )

      return [...prev, { menu_item: item, quantity: 1, notes: '' }]
    })
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const ex = prev.find(c => c.menu_item.id === id)
      if (ex?.quantity === 1)
        return prev.filter(c => c.menu_item.id !== id)

      return prev.map(c =>
        c.menu_item.id === id
          ? { ...c, quantity: c.quantity - 1 }
          : c
      )
    })
  }

  function getQty(id: string) {
    return cart.find(c => c.menu_item.id === id)?.quantity || 0
  }

  const total = cart.reduce(
    (s, c) => s + c.menu_item.price * c.quantity,
    0
  )

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0)

  const filteredItems =
    activeCategory === 'all'
      ? items
      : items.filter(i => i.category_id === activeCategory)

  const grouped = categories
    .map(cat => ({
      cat,
      items: filteredItems.filter(i => i.category_id === cat.id),
    }))
    .filter(g => g.items.length > 0)

  const uncategorized = filteredItems.filter(i => !i.category_id)

  // ================= ORDER =================
  async function submitOrder() {
    if (!restaurant || !tableId || cart.length === 0) return

    setSubmitting(true)

    const { data: order } = await supabase
      .from('orders')
      .insert({
        restaurant_id: restaurant.id,
        table_id: tableId,
        table_number: tableNumber,
        status: 'new',
      })
      .select()
      .single()

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

  // ================= STATES =================
  if (loading)
    return <div style={{ padding: 40 }}>Carregando...</div>

  if (error)
    return <div style={{ padding: 40 }}>{error}</div>

  // ================= WELCOME =================
  if (screen === 'welcome')
    return (
      <div style={{ padding: 40 }}>
        <h1>{restaurant?.name}</h1>
        <p>Mesa {tableNumber}</p>

        <button onClick={() => setScreen('menu')}>
          Ver cardápio
        </button>
      </div>
    )

  // ================= MENU =================
  return (
    <div style={{ padding: 20 }}>
      <h2>{restaurant?.name}</h2>

      {grouped.map(({ cat, items }) => (
        <div key={cat.id}>
          <h3>{cat.name}</h3>

          {items.map(item => (
            <div key={item.id}>
              {item.name} — {formatPrice(item.price)}

              <button onClick={() => addToCart(item)}>+</button>
              <button onClick={() => removeFromCart(item.id)}>
                -
              </button>

              ({getQty(item.id)})
            </div>
          ))}
        </div>
      ))}

      {cart.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <strong>Total: {formatPrice(total)}</strong>

          <button onClick={submitOrder} disabled={submitting}>
            Confirmar pedido ({totalItems})
          </button>
        </div>
      )}

      <button onClick={callWaiter}>
        {waiterCalled ? 'Garçom chamado ✓' : 'Chamar garçom'}
      </button>
    </div>
  )
}