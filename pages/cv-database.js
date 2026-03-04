import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import Link from 'next/link'

const C = {
  bg: '#0F1117', surface: '#1A1D27', card: '#21253A',
  accent: '#4F8EF7', accent2: '#7C3AED', success: '#10B981',
  warning: '#F59E0B', danger: '#EF4444', text: '#E8EAF0',
  muted: '#6B7280', border: '#2D3148',
}

const scoreColor = s => s >= 80 ? C.success : s >= 60 ? C.warning : C.danger
const Badge = ({ label, color }) => <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{label}</span>
const Card = ({ children, style = {} }) => <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, ...style }}>{children}</div>

export default function CVDatabase() {
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filterScore, setFilterScore] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('cv_database').select('*').order('created_at', { ascending: false })
      setCvs(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = cvs.filter(cv => {
    const matchSearch = !search || cv.full_name?.toLowerCase().includes(search.toLowerCase()) || cv.email?.toLowerCase().includes(search.toLowerCase()) || cv.skills?.some(s => s.toLowerCase().includes(search.toLowerCase()))
    const matchScore = cv.score_ai >= filterScore
    return matchSearch && matchScore
  })

  return (
    <>
      <Head>
        <title>Base de CVs — TH Suite</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: '100vh', color: C.text, display: 'flex' }}>

        {/* Sidebar */}
        <div style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, padding: '24px 12px', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0 }}>
          <div style={{ padding: '0 8px 28px' }}>
            <div style={{ fontSize: 20, fontWeight: 900, background: `linear-gradient(135deg,${C.accent},${C.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TH Suite</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Base de CVs</div>
          </div>
          {[
            { href: '/', label: 'Dashboard', icon: '🏠' },
            { href: '/cv-database', label: 'Base de CVs', icon: '📋', active: true },
            { href: '/cv-upload', label: 'Subir CV', icon: '📤' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: item.active ? C.accent + '22' : 'transparent', color: item.active ? C.accent : C.muted, fontWeight: item.active ? 700 : 500, fontSize: 14, textDecoration: 'none', marginBottom: 4 }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Main */}
        <div style={{ marginLeft: 220, flex: 1, padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h2 style={{ color: C.text, margin: 0, fontSize: 22, fontWeight: 800 }}>Base de CVs</h2>
              <p style={{ color: C.muted, margin: '4px 0 0', fontSize: 13 }}>{cvs.length} candidatos registrados</p>
            </div>
            <Link href="/cv-upload" style={{ background: C.accent, border: `2px solid ${C.accent}`, color: '#fff', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>+ Subir CV</Link>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, email o habilidad..." style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none' }} />
            <select value={filterScore} onChange={e => setFilterScore(Number(e.target.value))} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none' }}>
              <option value={0}>Todos los scores</option>
              <option value={80}>Score ≥ 80%</option>
              <option value={60}>Score ≥ 60%</option>
              <option value={40}>Score ≥ 40%</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>Cargando CVs...</div>
          ) : filtered.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <div style={{ color: C.muted }}>No hay CVs que coincidan con la búsqueda</div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {filtered.map(cv => (
                <Card key={cv.id} style={{ cursor: 'pointer', transition: 'transform .15s' }}
                  onClick={() => setSelected(cv)}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 11, background: `linear-gradient(135deg,${C.accent},${C.accent2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                        {cv.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: C.text, fontWeight: 700 }}>{cv.full_name}</div>
                        <div style={{ color: C.muted, fontSize: 12 }}>{cv.email}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: scoreColor(cv.score_ai), fontWeight: 900, fontSize: 20 }}>{cv.score_ai}%</div>
                      <div style={{ color: C.muted, fontSize: 10 }}>Score IA</div>
                    </div>
                  </div>
                  <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>📍 {cv.location || 'Ubicación no especificada'}</div>
                  {cv.skills?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cv.skills.slice(0, 4).map((s, i) => <Badge key={i} label={s} color={C.accent} />)}
                      {cv.skills.length > 4 && <Badge label={`+${cv.skills.length - 4}`} color={C.muted} />}
                    </div>
                  )}
                  <div style={{ marginTop: 12, color: C.muted, fontSize: 11 }}>
                    {cv.experience?.length || 0} experiencias · {cv.education?.length || 0} estudios
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, width: '90%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <h3 style={{ color: C.text, margin: 0, fontSize: 20, fontWeight: 800 }}>{selected.full_name}</h3>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{selected.email} · {selected.phone}</div>
                  {selected.location && <div style={{ color: C.muted, fontSize: 13 }}>📍 {selected.location}</div>}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', background: scoreColor(selected.score_ai) + '18', borderRadius: 10, padding: '8px 16px' }}>
                    <div style={{ color: scoreColor(selected.score_ai), fontWeight: 900, fontSize: 24 }}>{selected.score_ai}%</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>Score IA</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 24, cursor: 'pointer' }}>×</button>
                </div>
              </div>

              {selected.summary && (
                <div style={{ background: C.bg, borderRadius: 10, padding: 14, marginBottom: 20 }}>
                  <div style={{ color: C.accent, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>RESUMEN PROFESIONAL</div>
                  <div style={{ color: C.text, fontSize: 13, lineHeight: 1.7 }}>{selected.summary}</div>
                </div>
              )}

              {selected.skills?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: C.accent, fontSize: 11, fontWeight: 700, marginBottom: 10 }}>HABILIDADES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selected.skills.map((s, i) => <Badge key={i} label={s} color={C.accent} />)}
                  </div>
                </div>
              )}

              {selected.experience?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: C.accent, fontSize: 11, fontWeight: 700, marginBottom: 14 }}>EXPERIENCIA LABORAL</div>
                  {selected.experience.map((exp, i) => (
                    <div key={i} style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: 14, marginBottom: 18 }}>
                      <div style={{ color: C.text, fontWeight: 700 }}>{exp.position}</div>
                      <div style={{ color: C.accent, fontSize: 13 }}>{exp.company}</div>
                      <div style={{ color: C.muted, fontSize: 12, margin: '2px 0 6px' }}>{exp.start_date} — {exp.end_date}</div>
                      {exp.description && <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{exp.description}</div>}
                    </div>
                  ))}
                </div>
              )}

              {selected.education?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: C.accent, fontSize: 11, fontWeight: 700, marginBottom: 14 }}>EDUCACIÓN</div>
                  {selected.education.map((edu, i) => (
                    <div key={i} style={{ borderLeft: `3px solid ${C.accent2}`, paddingLeft: 14, marginBottom: 14 }}>
                      <div style={{ color: C.text, fontWeight: 700 }}>{edu.degree} en {edu.field}</div>
                      <div style={{ color: C.accent2, fontSize: 13 }}>{edu.institution}</div>
                      <div style={{ color: C.muted, fontSize: 12 }}>Graduación: {edu.graduation_year}</div>
                    </div>
                  ))}
                </div>
              )}

              {selected.languages?.length > 0 && (
                <div>
                  <div style={{ color: C.accent, fontSize: 11, fontWeight: 700, marginBottom: 10 }}>IDIOMAS</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selected.languages.map((l, i) => <Badge key={i} label={l} color={C.accent2} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
