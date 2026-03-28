export type Restaurant = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  created_at: string
}

export type Table = {
  id: string
  restaurant_id: string
  number: number
  token: string
  token_expires_at: string
}

export type Category = {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
}

export type MenuItem = {
  id: string
  restaurant_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  available: boolean
  sort_order: number
}

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivered'

export type OrderItem = {
  id: string
  order_id: string
  menu_item_id: string
  menu_item_name: string
  quantity: number
  unit_price: number
  notes: string | null
}

export type Order = {
  id: string
  restaurant_id: string
  table_id: string
  table_number: number
  status: OrderStatus
  created_at: string
  order_items: OrderItem[]
}

export type AlertType = 'waiter' | 'payment'

export type TableAlert = {
  id: string
  restaurant_id: string
  table_id: string
  table_number: number
  type: AlertType
  resolved: boolean
  created_at: string
}

export type CartItem = {
  menu_item: MenuItem
  quantity: number
  notes: string
}
