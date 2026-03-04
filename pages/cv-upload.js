import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import Link from 'next/link'

const C = {
  bg: '#0F1117', surface: '#1A1D27', card: '#21253A',
  accent: '#4F8EF7', accent2: '#7C3AED', success: '#10B981',
  warning: '#F59E0B', danger: '#EF4444', text: '#E8EAF0',
  muted: '#6B7280', border: '#2D3148',
}

const gemini = async (prompt) => {
  const key = process.env.NEXT_PUBLIC_GEMINI_KEY
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  })
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

const geminiWithFile = async (base64Data, mimeType, prompt) => {
  const key = process.env.NEXT_PUBLIC_GEMINI_KEY
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Data } },
          { text: prompt }
        ]
      }]
    })
  })
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

const Btn = ({ children, onClick, color = C.accent, outline = false, style = {}, disabled = false }) => (
  <button disabled={disabled} onClick={onClick} style={{ background: outline ? 'transparent' : color, border: `2px solid ${color}`, color: outline ? color : '#fff', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'all .15s', ...style }}>{children}</button>
)

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, ...style }}>{children}</div>
)

const Badge = ({ label, color }) => (
  <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{label}</span>
)

const Field = ({ label, value }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
    <div style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>{value || '—'}</div>
  </div>
)

export default function CVParser() {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [position, setPosition] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [cvData, setCvData] = useState(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowed.includes(f.type)) {
      setError('Solo se aceptan archivos PDF o Word (.docx)')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('El archivo no debe superar 10MB')
      return
    }
    setFile(f)
    setError('')
  }

  const extractCV = async () => {
    if (!file || !position) return
    setLoading(true)
    setLoadingMsg('Leyendo documento...')

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1]
        const mimeType = file.type

        setLoadingMsg('Gemini está analizando el CV...')

        const prompt = `Analiza este CV/hoja de vida y extrae TODA la información en formato JSON. 
El candidato aplica al cargo: "${position}"

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin markdown, sin backticks, solo JSON puro):
{
  "full_name": "nombre completo",
  "email": "email",
  "phone": "teléfono",
  "location": "ciudad, país",
  "linkedin": "url linkedin o vacío",
  "summary": "resumen profesional o perfil en 2-3 oraciones",
  "skills": ["habilidad1", "habilidad2", "habilidad3"],
  "experience": [
    {
      "company": "empresa",
      "position": "cargo",
      "start_date": "mes/año inicio",
      "end_date": "mes/año fin o Actual",
      "description": "descripción de responsabilidades"
    }
  ],
  "education": [
    {
      "institution": "institución",
      "degree": "título",
      "field": "área de estudio",
      "graduation_year": "año"
    }
  ],
  "languages": ["idioma1 - nivel", "idioma2 - nivel"],
  "score_ai": número del 0 al 100 indicando qué tan apto es para el cargo "${position}",
  "score_reason": "explicación breve del score en 1 oración"
}`

        const result = await geminiWithFile(base64, mimeType, prompt)

        setLoadingMsg('Procesando datos extraídos...')

        // Clean and parse JSON
        let jsonStr = result.trim()
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        let parsed
        try {
          parsed = JSON.parse(jsonStr)
        } catch {
          // Try to extract JSON from response
          const match = jsonStr.match(/\{[\s\S]*\}/)
          if (match) parsed = JSON.parse(match[0])
          else throw new Error('No se pudo procesar la respuesta de IA')
        }

        setCvData(parsed)
        setStep(2)
        setLoading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError('Error al procesar el CV: ' + err.message)
      setLoading(false)
    }
  }

  const saveToDatabase = async () => {
    if (!cvData) return
    setLoading(true)
    setLoadingMsg('Guardando en base de datos...')

    try {
      // First create candidate
      const { data: candidateData, error: candError } = await supabase
        .from('candidates')
        .insert([{
          name: cvData.full_name,
          position: position,
          email: cvData.email,
          phone: cvData.phone,
          source: 'CV Subido',
          stage: 'Revisión CV',
          score: cvData.score_ai || 0,
          date: new Date().toISOString().slice(0, 10)
        }])
        .select()

      if (candError) throw candError

      const candidateId = candidateData[0].id

      // Save full CV to database
      const { error: cvError } = await supabase
        .from('cv_database')
        .insert([{
          candidate_id: candidateId,
          full_name: cvData.full_name,
          email: cvData.email,
          phone: cvData.phone,
          location: cvData.location,
          linkedin: cvData.linkedin,
          summary: cvData.summary,
          skills: cvData.skills || [],
          experience: cvData.experience || [],
          education: cvData.education || [],
          languages: cvData.languages || [],
          score_ai: cvData.score_ai || 0,
          raw_text: JSON.stringify(cvData)
        }])

      if (cvError) throw cvError

      setSaved(true)
      setStep(3)
    } catch (err) {
      setError('Error guardando: ' + err.message)
    }
    setLoading(false)
  }

  const reset = () => {
    setStep(1); setFile(null); setPosition(''); setCvData(null); setSaved(false); setError('')
  }

  const scoreColor = s => s >= 80 ? C.success : s >= 60 ? C.warning : C.danger

  return (
    <>
      <Head>
        <title>Subir CV — TH Suite</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: '100vh', color: C.text }}>

        {/* Header */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, background: `linear-gradient(135deg,${C.accent},${C.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TH Suite</div>
            <div style={{ color: C.muted, fontSize: 11 }}>Portal de Candidatos</div>
          </div>
          <Link href="/" style={{ color: C.accent, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Volver al sistema</Link>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>

          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40, gap: 8 }}>
            {[['1', 'Subir CV'], ['2', 'Revisar datos'], ['3', 'Confirmación']].map(([n, label], i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < 2 ? 1 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: step > i + 1 ? C.success : step === i + 1 ? C.accent : C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: step >= i + 1 ? '#fff' : C.muted, flexShrink: 0 }}>
                    {step > i + 1 ? '✓' : n}
                  </div>
                  <span style={{ color: step === i + 1 ? C.text : C.muted, fontWeight: step === i + 1 ? 700 : 400, fontSize: 13 }}>{label}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: step > i + 1 ? C.success : C.border, marginLeft: 8 }} />}
              </div>
            ))}
          </div>

          {/* STEP 1: Upload */}
          {step === 1 && (
            <Card>
              <h2 style={{ color: C.text, margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>📄 Sube tu CV</h2>
              <p style={{ color: C.muted, margin: '0 0 28px', fontSize: 14 }}>Gemini AI extraerá automáticamente todos tus datos</p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: C.muted, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>CARGO AL QUE APLICAS *</label>
                <input value={position} onChange={e => setPosition(e.target.value)} placeholder="Ej. Desarrollador Frontend" style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', color: C.muted, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>DOCUMENTO CV *</label>
                <label style={{ display: 'block', border: `2px dashed ${file ? C.success : C.border}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: file ? C.success + '08' : 'transparent', transition: 'all .2s' }}>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleFile} style={{ display: 'none' }} />
                  {file ? (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      <div style={{ color: C.success, fontWeight: 700 }}>{file.name}</div>
                      <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB — clic para cambiar</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📎</div>
                      <div style={{ color: C.text, fontWeight: 600, marginBottom: 6 }}>Arrastra tu CV aquí o haz clic</div>
                      <div style={{ color: C.muted, fontSize: 13 }}>PDF o Word (.docx) — máx. 10MB</div>
                    </div>
                  )}
                </label>
              </div>

              {error && <div style={{ background: C.danger + '18', border: `1px solid ${C.danger}44`, borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13, marginBottom: 16 }}>{error}</div>}

              {loading && (
                <div style={{ background: C.accent + '18', border: `1px solid ${C.accent}44`, borderRadius: 10, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 20, height: 20, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <span style={{ color: C.accent, fontWeight: 600, fontSize: 13 }}>{loadingMsg}</span>
                </div>
              )}

              <Btn onClick={extractCV} disabled={!file || !position || loading} style={{ width: '100%', padding: '14px', fontSize: 15 }}>
                {loading ? 'Procesando...' : '🤖 Analizar CV con Gemini AI'}
              </Btn>
            </Card>
          )}

          {/* STEP 2: Review */}
          {step === 2 && cvData && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h2 style={{ color: C.text, margin: 0, fontSize: 22, fontWeight: 800 }}>✅ Datos Extraídos</h2>
                  <p style={{ color: C.muted, margin: '4px 0 0', fontSize: 13 }}>Revisa que todo esté correcto antes de guardar</p>
                </div>
                <div style={{ textAlign: 'center', background: scoreColor(cvData.score_ai) + '18', border: `2px solid ${scoreColor(cvData.score_ai)}44`, borderRadius: 12, padding: '10px 20px' }}>
                  <div style={{ color: scoreColor(cvData.score_ai), fontSize: 28, fontWeight: 900 }}>{cvData.score_ai}%</div>
                  <div style={{ color: C.muted, fontSize: 11 }}>Score IA</div>
                </div>
              </div>

              {cvData.score_reason && (
                <div style={{ background: C.accent + '12', border: `1px solid ${C.accent}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16 }}>🤖</span>
                  <span style={{ color: C.text, fontSize: 13 }}>{cvData.score_reason}</span>
                </div>
              )}

              {/* Personal Info */}
              <Card style={{ marginBottom: 16 }}>
                <div style={{ color: C.accent, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>👤 Datos Personales</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <Field label="Nombre" value={cvData.full_name} />
                  <Field label="Email" value={cvData.email} />
                  <Field label="Teléfono" value={cvData.phone} />
                  <Field label="Ubicación" value={cvData.location} />
                  <Field label="LinkedIn" value={cvData.linkedin} />
                  <Field label="Cargo aplicado" value={position} />
                </div>
                {cvData.summary && (
                  <div style={{ marginTop: 8, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Resumen</div>
                    <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{cvData.summary}</div>
                  </div>
                )}
              </Card>

              {/* Skills */}
              {cvData.skills?.length > 0 && (
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ color: C.accent, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>⚡ Habilidades</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {cvData.skills.map((s, i) => <Badge key={i} label={s} color={C.accent} />)}
                  </div>
                </Card>
              )}

              {/* Experience */}
              {cvData.experience?.length > 0 && (
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ color: C.accent, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>💼 Experiencia Laboral</div>
                  {cvData.experience.map((exp, i) => (
                    <div key={i} style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: 16, marginBottom: 20 }}>
                      <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{exp.position}</div>
                      <div style={{ color: C.accent, fontWeight: 600, fontSize: 13, marginTop: 2 }}>{exp.company}</div>
                      <div style={{ color: C.muted, fontSize: 12, marginTop: 2, marginBottom: 8 }}>{exp.start_date} — {exp.end_date}</div>
                      {exp.description && <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{exp.description}</div>}
                    </div>
                  ))}
                </Card>
              )}

              {/* Education */}
              {cvData.education?.length > 0 && (
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ color: C.accent, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>🎓 Educación</div>
                  {cvData.education.map((edu, i) => (
                    <div key={i} style={{ borderLeft: `3px solid ${C.accent2}`, paddingLeft: 16, marginBottom: 16 }}>
                      <div style={{ color: C.text, fontWeight: 700 }}>{edu.degree} en {edu.field}</div>
                      <div style={{ color: C.accent2, fontSize: 13, marginTop: 2 }}>{edu.institution}</div>
                      <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Graduación: {edu.graduation_year}</div>
                    </div>
                  ))}
                </Card>
              )}

              {/* Languages */}
              {cvData.languages?.length > 0 && (
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ color: C.accent, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>🌍 Idiomas</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {cvData.languages.map((l, i) => <Badge key={i} label={l} color={C.accent2} />)}
                  </div>
                </Card>
              )}

              {error && <div style={{ background: C.danger + '18', border: `1px solid ${C.danger}44`, borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 12 }}>
                <Btn outline color={C.muted} onClick={() => setStep(1)} style={{ flex: 1 }}>← Volver</Btn>
                <Btn onClick={saveToDatabase} disabled={loading} color={C.success} style={{ flex: 2, padding: '14px' }}>
                  {loading ? 'Guardando...' : '💾 Guardar en Base de CVs'}
                </Btn>
              </div>
            </div>
          )}

          {/* STEP 3: Success */}
          {step === 3 && (
            <Card style={{ textAlign: 'center', padding: '48px 32px' }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
              <h2 style={{ color: C.success, fontSize: 26, fontWeight: 900, margin: '0 0 12px' }}>¡CV Registrado!</h2>
              <p style={{ color: C.muted, fontSize: 15, margin: '0 0 32px', lineHeight: 1.6 }}>
                Los datos de <strong style={{ color: C.text }}>{cvData?.full_name}</strong> han sido extraídos y guardados en la base de CVs. El equipo de RR.HH revisará tu perfil pronto.
              </p>
              <div style={{ background: C.bg, borderRadius: 12, padding: '16px 24px', marginBottom: 32, display: 'inline-block' }}>
                <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Score de compatibilidad</div>
                <div style={{ color: scoreColor(cvData?.score_ai), fontSize: 36, fontWeight: 900 }}>{cvData?.score_ai}%</div>
                <div style={{ color: C.muted, fontSize: 12 }}>para {position}</div>
              </div>
              <br />
              <Btn onClick={reset} style={{ padding: '12px 32px' }}>📄 Subir otro CV</Btn>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
