'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Restaurant } from '@/types'

export default function SettingsPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('restaurants').select('*').single()
      if (data) { setRestaurant(data); setName(data.name) }
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    if (!restaurant || !name.trim()) return
    setSaving(true)
    await supabase.from('restaurants').update({ name: name.trim() }).eq('id', restaurant.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  const s = {
    input: { width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '0.5px solid var(--border2)', borderRadius: 8, fontSize: 14, color: 'var(--text)', outline: 'none' } as React.CSSProperties,
    card: { background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 14, color: 'var(--text3)' }}>Carregando...</div>

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>Configurações</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Gerencie as informações do seu restaurante</p>
      </div>

      <div style={s.card}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Informações gerais</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Nome do restaurante</label>
          <input value={name} onChange={e => setName(e.target.value)} style={s.input} placeholder="Nome do restaurante" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>ID do restaurante</label>
          <input value={restaurant?.id || ''} disabled style={{ ...s.input, color: 'var(--text3)', background: 'var(--bg2)' }} />
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Identificador único — não pode ser alterado</p>
        </div>
        <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: saved ? 'var(--green)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s' }}>
          {saved ? '✓ Salvo!' : saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      <div style={s.card}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Sobre o Eat In</div>
        <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
          Eat In é um sistema de cardápio digital e gestão de pedidos para food service.
          Versão MVP — funcionalidades de login, pagamento e fidelidade serão adicionadas em breve.
        </p>
      </div>
    </div>
  )
}
