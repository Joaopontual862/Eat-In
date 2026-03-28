'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { MenuItem, Category, Table, Restaurant } from '@/types'
import { formatPrice, generateToken, getTokenExpiry } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'

type Tab = 'menu' | 'tables'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('menu')
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', description: '', price: '', category_id: '', available: true })
  const [catForm, setCatForm] = useState('')
  const [saving, setSaving] = useState(false)
  const [newTableNumber, setNewTableNumber] = useState('')
  const [uploadingImg, setUploadingImg] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: rest } = await supabase.from('restaurants').select('*').single()
    if (!rest) { setLoading(false); return }
    setRestaurant(rest)
    const [{ data: cats }, { data: menuItems }, { data: tbls }] = await Promise.all([
      supabase.from('categories').select('*').eq('restaurant_id', rest.id).order('sort_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', rest.id).order('sort_order'),
      supabase.from('tables').select('*').eq('restaurant_id', rest.id).order('number'),
    ])
    setCategories(cats || [])
    setItems(menuItems || [])
    setTables(tbls || [])
    setLoading(false)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !restaurant) return
    setUploadingImg(true)
    setPreviewUrl(URL.createObjectURL(file))
    const ext = file.name.split('.').pop()
    const path = `${restaurant.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
      setImageUrl(data.publicUrl)
    } else {
      alert('Erro ao fazer upload. Verifique se o bucket "menu-images" foi criado no Supabase Storage.')
      setPreviewUrl(null)
    }
    setUploadingImg(false)
  }

  function clearImage() {
    setPreviewUrl(null)
    setImageUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function addCategory() {
    if (!catForm.trim() || !restaurant) return
    const { data } = await supabase.from('categories').insert({
      restaurant_id: restaurant.id, name: catForm.trim(), sort_order: categories.length,
    }).select().single()
    if (data) { setCategories(p => [...p, data]); setCatForm('') }
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`Remover a categoria "${name}"? Os itens desta categoria ficarão sem categoria.`)) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(p => p.filter(c => c.id !== id))
    setItems(p => p.map(i => i.category_id === id ? { ...i, category_id: null } : i))
  }

  async function addItem() {
    if (!form.name || !form.price || !restaurant) return
    setSaving(true)
    const { data } = await supabase.from('menu_items').insert({
      restaurant_id: restaurant.id,
      category_id: form.category_id || null,
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      image_url: imageUrl || null,
      available: true,
      sort_order: items.length,
    }).select().single()
    if (data) {
      setItems(p => [...p, data as MenuItem])
      setForm({ name: '', description: '', price: '', category_id: '', available: true })
      clearImage()
    }
    setSaving(false)
  }

  async function toggleAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    setItems(p => p.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
  }

  async function deleteItem(id: string, name: string) {
    if (!confirm(`Remover "${name}" do cardápio?`)) return
    await supabase.from('menu_items').delete().eq('id', id)
    setItems(p => p.filter(i => i.id !== id))
  }

  async function generateTable() {
    if (!newTableNumber || !restaurant) return
    const token = generateToken()
    const expires = getTokenExpiry()
    const { data } = await supabase.from('tables').upsert(
      { restaurant_id: restaurant.id, number: Number(newTableNumber), token, token_expires_at: expires },
      { onConflict: 'restaurant_id,number' }
    ).select().single()
    if (data) {
      setTables(p => [...p.filter(t => t.number !== data.number), data].sort((a, b) => a.number - b.number))
      setNewTableNumber('')
    }
  }

  async function deleteTable(id: string, number: number) {
    if (!confirm(`Remover Mesa ${number}?`)) return
    await supabase.from('tables').delete().eq('id', id)
    setTables(p => p.filter(t => t.id !== id))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const s = {
    input: { width: '100%', padding: '9px 12px', background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none' } as React.CSSProperties,
    btn: { padding: '9px 18px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' } as React.CSSProperties,
    btnSm: { fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '0.5px solid var(--border)' } as React.CSSProperties,
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 14, color: 'var(--text3)' }}>Carregando...</div>

  if (!restaurant) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ fontSize: 13, color: 'var(--text2)' }}>Nenhum restaurante encontrado. Rode o schema.sql no Supabase.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>{restaurant.name}</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Painel administrativo — Eat In</p>
        </div>
        <a href="/kitchen" style={{ fontSize: 13, padding: '7px 14px', background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 8, textDecoration: 'none', color: 'var(--text2)' }}>Ver cozinha →</a>
      </div>

      <div style={{ display: 'flex', marginBottom: 28, borderBottom: '0.5px solid var(--border)' }}>
        {(['menu', 'tables'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', fontWeight: tab === t ? 500 : 400, color: tab === t ? 'var(--text)' : 'var(--text3)', marginBottom: -1 }}>
            {t === 'menu' ? 'Cardápio' : 'Mesas e QR codes'}
          </button>
        ))}
      </div>

      {tab === 'menu' && (
        <div>
          {/* Categorias */}
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Categorias</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {categories.length === 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma categoria ainda</span>}
              {categories.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 6px 4px 10px', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 20, color: 'var(--text2)' }}>
                  {c.name}
                  <button onClick={() => deleteCategory(c.id, c.name)} style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'var(--border2)', color: 'var(--text2)', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Nova categoria..." value={catForm} onChange={e => setCatForm(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} style={{ ...s.input, flex: 1 }} />
              <button onClick={addCategory} style={s.btn}>Adicionar</button>
            </div>
          </div>

          {/* Novo item */}
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Adicionar item</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <input placeholder="Nome *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={s.input} />
              <input placeholder="Preço ex: 12.50 *" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} type="number" step="0.01" min="0" style={s.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <input placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={s.input} />
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} style={s.input}>
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Upload de foto */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Foto do item (opcional)</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {previewUrl ? (
                  <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', border: '0.5px solid var(--border)', flexShrink: 0 }}>
                    <img src={previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={clearImage} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 10, border: '0.5px dashed var(--border2)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>☕</div>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} id="img-upload" />
                  <label htmlFor="img-upload" style={{ fontSize: 12, padding: '7px 14px', background: 'var(--bg)', border: '0.5px solid var(--border2)', borderRadius: 8, cursor: 'pointer', color: 'var(--text2)', display: 'inline-block' }}>
                    {uploadingImg ? 'Enviando...' : previewUrl ? 'Trocar foto' : 'Escolher foto'}
                  </label>
                  {imageUrl && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>✓ Foto carregada</div>}
                </div>
              </div>
            </div>

            <button onClick={addItem} disabled={saving || uploadingImg} style={{ ...s.btn, opacity: saving || uploadingImg ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : 'Adicionar item'}
            </button>
          </div>

          {/* Lista de itens */}
          {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 32 }}>Nenhum item ainda. Adicione o primeiro item acima!</p>}
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '0.5px solid var(--border)', opacity: item.available ? 1 : 0.5 }}>
              <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', border: '0.5px solid var(--border)', flexShrink: 0, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '☕'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</div>
                {item.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{item.description}</div>}
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{formatPrice(item.price)}</div>
              </div>
              <button onClick={() => toggleAvailable(item)} style={{ ...s.btnSm, background: item.available ? 'var(--green-bg)' : 'var(--bg2)', color: item.available ? 'var(--green-text)' : 'var(--text3)', borderColor: item.available ? 'var(--green-border)' : 'var(--border)' }}>
                {item.available ? 'Disponível' : 'Indisponível'}
              </button>
              <button onClick={() => deleteItem(item.id, item.name)} style={{ ...s.btnSm, background: 'var(--red-bg)', color: 'var(--red-text)', borderColor: 'var(--red-border)' }}>
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'tables' && (
        <div>
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Número da mesa</label>
              <input type="number" min="1" placeholder="Ex: 1" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} onKeyDown={e => e.key === 'Enter' && generateTable()} style={s.input} />
            </div>
            <button onClick={generateTable} style={s.btn}>Gerar QR code</button>
          </div>

          {tables.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 32 }}>Nenhuma mesa ainda. Gere o primeiro QR code acima!</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {tables.map(table => {
              const url = `${appUrl}/mesa/${table.token}`
              const expires = new Date(table.token_expires_at)
              const expired = expires < new Date()
              return (
                <div key={table.id} style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>Mesa {table.number}</span>
                    <button onClick={() => deleteTable(table.id, table.number)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', background: 'var(--red-bg)', color: 'var(--red-text)', border: '0.5px solid var(--red-border)' }}>Remover</button>
                  </div>
                  <div style={{ fontSize: 10, marginBottom: 12, color: expired ? 'var(--red-text)' : 'var(--green-text)', background: expired ? 'var(--red-bg)' : 'var(--green-bg)', border: `0.5px solid ${expired ? 'var(--red-border)' : 'var(--green-border)'}`, borderRadius: 8, padding: '2px 8px', display: 'inline-block' }}>
                    {expired ? 'Expirado — clique em renovar' : `Válido até ${expires.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 8, background: '#fff', border: '0.5px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
                    <QRCodeSVG value={url} size={130} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => window.open(url)} style={{ flex: 1, padding: '7px 0', fontSize: 12, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text2)' }}>Testar</button>
                    <button onClick={() => { setNewTableNumber(String(table.number)); generateTable() }} style={{ flex: 1, padding: '7px 0', fontSize: 12, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text2)' }}>Renovar</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
