import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const C = {
  bg: '#0F1117', surface: '#1A1D27', card: '#21253A',
  accent: '#4F8EF7', accent2: '#7C3AED', success: '#10B981',
  warning: '#F59E0B', danger: '#EF4444', text: '#E8EAF0',
  muted: '#6B7280', border: '#2D3148',
}

const STAGES = ['Aplicación','Revisión CV','Entrevista RR.HH','Prueba Técnica','Entrevista Final','Oferta','Contratado','Rechazado']
const ONBOARDING_TASKS = ['Firma de contrato','Configuración de cuentas','Entrega de equipos','Inducción empresa','Inducción área','Capacitación herramientas','Reunión con equipo','Revisión políticas internas']

const fmt = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n)
const stageColor = s => ({'Aplicación':'#6B7280','Revisión CV':'#3B82F6','Entrevista RR.HH':'#8B5CF6','Prueba Técnica':'#F59E0B','Entrevista Final':'#EC4899','Oferta':'#10B981','Contratado':'#059669','Rechazado':'#EF4444'}[s]||'#6B7280')
const statusColor = s => ({'Activo':'#10B981','Prueba':'#F59E0B','Inactivo':'#EF4444','Pagado':'#10B981','Pendiente':'#F59E0B','Completada':'#10B981','En proceso':'#3B82F6'}[s]||'#6B7280')

// ── Gemini API ──
const gemini = async (prompt) => {
  const key = process.env.NEXT_PUBLIC_GEMINI_KEY
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({contents:[{parts:[{text:prompt}]}]})
  })
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar respuesta.'
}

// ── UI primitives ──
const Badge = ({label,color}) => <span style={{background:color+'22',color,border:`1px solid ${color}44`,borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>{label}</span>
const Card = ({children,style={}}) => <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20,...style}}>{children}</div>
const Btn = ({children,onClick,color=C.accent,outline=false,style={},disabled=false}) => <button disabled={disabled} onClick={onClick} style={{background:outline?'transparent':color,border:`2px solid ${color}`,color:outline?color:'#fff',borderRadius:8,padding:'8px 18px',fontWeight:700,fontSize:13,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.6:1,...style}}>{children}</button>
const Input = ({label,...props}) => <div style={{marginBottom:14}}>{label&&<label style={{display:'block',color:C.muted,fontSize:12,marginBottom:5,fontWeight:600}}>{label}</label>}<input {...props} style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 12px',color:C.text,fontSize:14,boxSizing:'border-box',outline:'none',...props.style}}/></div>
const Sel = ({label,children,...props}) => <div style={{marginBottom:14}}>{label&&<label style={{display:'block',color:C.muted,fontSize:12,marginBottom:5,fontWeight:600}}>{label}</label>}<select {...props} style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 12px',color:C.text,fontSize:14,outline:'none'}}>{children}</select></div>
const Modal = ({title,children,onClose,wide=false}) => <div style={{position:'fixed',inset:0,background:'#000b',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:18,padding:28,minWidth:wide?700:420,maxWidth:wide?800:560,width:'90%',maxHeight:'90vh',overflowY:'auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><h3 style={{color:C.text,margin:0,fontSize:18,fontWeight:800}}>{title}</h3><button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer'}}>×</button></div>{children}</div></div>
const StatCard = ({label,value,icon,color=C.accent}) => <Card style={{flex:1,minWidth:160}}><div style={{display:'flex',justifyContent:'space-between'}}><div><div style={{color:C.muted,fontSize:11,marginBottom:6,fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>{label}</div><div style={{color,fontSize:28,fontWeight:800}}>{value}</div></div><div style={{fontSize:26}}>{icon}</div></div></Card>

const AIBox = ({result,loading}) => {
  if(!result && !loading) return null
  return (
    <div style={{background:C.bg,border:`1px solid ${C.accent}44`,borderRadius:12,padding:16,marginTop:16}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
        <span style={{fontSize:16}}>🤖</span>
        <span style={{color:C.accent,fontWeight:700,fontSize:13}}>Gemini AI</span>
        {loading && <span style={{color:C.muted,fontSize:12}}>Generando...</span>}
      </div>
      {loading ? (
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:C.accent,animation:'pulse 1s infinite'}}/>
          <div style={{width:8,height:8,borderRadius:'50%',background:C.accent,animation:'pulse 1s infinite .2s'}}/>
          <div style={{width:8,height:8,borderRadius:'50%',background:C.accent,animation:'pulse 1s infinite .4s'}}/>
          <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
        </div>
      ) : (
        <div style={{color:C.text,fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{result}</div>
      )}
    </div>
  )
}

// ── DASHBOARD ──
function Dashboard({candidates,employees,evaluations,payroll}) {
  const active = employees.filter(e=>e.status==='Activo').length
  const inProcess = candidates.filter(c=>!['Contratado','Rechazado'].includes(c.stage)).length
  const totalNet = payroll.reduce((a,b)=>a+(b.net||0),0)
  const pendingEvals = evaluations.filter(e=>e.status!=='Completada').length
  return (
    <div>
      <h2 style={{color:C.text,margin:'0 0 6px',fontSize:22,fontWeight:800}}>Dashboard General</h2>
      <p style={{color:C.muted,margin:'0 0 24px',fontSize:13}}>Resumen ejecutivo de Talento Humano</p>
      <div style={{display:'flex',gap:14,marginBottom:28,flexWrap:'wrap'}}>
        <StatCard label="Empleados Activos" value={active} icon="👥"/>
        <StatCard label="Candidatos Activos" value={inProcess} icon="🔍" color={C.accent2}/>
        <StatCard label="Nómina Mensual" value={fmt(totalNet)} icon="💰" color={C.success}/>
        <StatCard label="Evals. Pendientes" value={pendingEvals} icon="📋" color={C.warning}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Card>
          <div style={{color:C.muted,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Pipeline Reclutamiento</div>
          {STAGES.slice(0,6).map(s=>{
            const count=candidates.filter(c=>c.stage===s).length
            return <div key={s} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{width:110,color:C.muted,fontSize:12}}>{s}</div>
              <div style={{flex:1,background:C.border,borderRadius:6,height:10,overflow:'hidden'}}><div style={{height:'100%',width:`${(count/(candidates.length||1))*100}%`,background:stageColor(s),borderRadius:6}}/></div>
              <div style={{width:20,color:C.text,fontSize:12,fontWeight:700,textAlign:'right'}}>{count}</div>
            </div>
          })}
        </Card>
        <Card>
          <div style={{color:C.muted,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Equipo Actual</div>
          {employees.map(emp=>(
            <div key={emp.id} style={{display:'flex',alignItems:'center',gap:10,background:C.bg,borderRadius:10,padding:'10px 12px',marginBottom:8}}>
              <div style={{width:36,height:36,borderRadius:9,background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:13,flexShrink:0}}>{emp.avatar||emp.name?.slice(0,2).toUpperCase()}</div>
              <div style={{flex:1}}><div style={{color:C.text,fontWeight:600,fontSize:13}}>{emp.name}</div><div style={{color:C.muted,fontSize:11}}>{emp.role}</div></div>
              <Badge label={emp.status} color={statusColor(emp.status)}/>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ── RECRUITMENT ──
function Recruitment({candidates,setCandidates}) {
  const [view,setView]=useState('kanban')
  const [modal,setModal]=useState(null)
  const [detail,setDetail]=useState(null)
  const [form,setForm]=useState({name:'',position:'',email:'',phone:'',source:'LinkedIn'})
  const [loading,setLoading]=useState(false)
  const [aiResult,setAiResult]=useState('')
  const [aiLoading,setAiLoading]=useState(false)
  const [cvText,setCvText]=useState('')
  const [questions,setQuestions]=useState('')
  const [qLoading,setQLoading]=useState(false)

  const add = async () => {
    if(!form.name||!form.position) return
    setLoading(true)
    const {data,error} = await supabase.from('candidates').insert([{...form,stage:'Aplicación',score:0,date:new Date().toISOString().slice(0,10)}]).select()
    if(!error&&data) setCandidates(c=>[...c,...data])
    setLoading(false); setModal(null); setForm({name:'',position:'',email:'',phone:'',source:'LinkedIn'})
  }

  const moveStage = async (id,stage) => {
    await supabase.from('candidates').update({stage}).eq('id',id)
    setCandidates(cs=>cs.map(c=>c.id===id?{...c,stage}:c))
    if(detail?.id===id) setDetail(d=>({...d,stage}))
  }

  const analyzeCV = async () => {
    if(!cvText||!detail) return
    setAiLoading(true); setAiResult('')
    const result = await gemini(`Eres un experto en selección de personal. Analiza el siguiente CV para el cargo de "${detail.position}" y proporciona:
1. Score del 0 al 100 basado en idoneidad
2. Fortalezas principales (3 puntos)
3. Áreas de mejora o gaps (2 puntos)
4. Recomendación final (contratar / entrevistar / descartar)

CV: ${cvText}

Responde en español, de forma concisa y profesional.`)
    setAiResult(result)
    // Extract score from result and update candidate
    const scoreMatch = result.match(/(\d{1,3})\s*(?:\/\s*100|%|puntos)/i)
    if(scoreMatch) {
      const score = parseInt(scoreMatch[1])
      if(score>=0&&score<=100) {
        await supabase.from('candidates').update({score}).eq('id',detail.id)
        setCandidates(cs=>cs.map(c=>c.id===detail.id?{...c,score}:c))
        setDetail(d=>({...d,score}))
      }
    }
    setAiLoading(false)
  }

  const generateQuestions = async (candidate) => {
    setQLoading(true); setQuestions('')
    const result = await gemini(`Eres un experto en selección de personal. Genera 8 preguntas de entrevista para el cargo de "${candidate.position}" para el candidato ${candidate.name}.

Incluye:
- 3 preguntas técnicas del cargo
- 2 preguntas de comportamiento (método STAR)
- 2 preguntas de cultura y valores
- 1 pregunta situacional

Responde en español, numeradas y con una breve guía de qué evalúa cada pregunta.`)
    setQuestions(result)
    setQLoading(false)
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><h2 style={{color:C.text,margin:0,fontSize:22,fontWeight:800}}>Reclutamiento & Selección</h2><p style={{color:C.muted,margin:'4px 0 0',fontSize:13}}>{candidates.length} candidatos</p></div>
        <div style={{display:'flex',gap:10}}>
          <Btn outline color={C.accent} onClick={()=>setView(v=>v==='kanban'?'list':'kanban')}>{view==='kanban'?'📋 Lista':'🗂 Kanban'}</Btn>
          <Btn onClick={()=>setModal('new')}>+ Nuevo Candidato</Btn>
        </div>
      </div>
      <div style={{display:'flex',gap:14,marginBottom:24,flexWrap:'wrap'}}>
        <StatCard label="Total" value={candidates.length} icon="👥"/>
        <StatCard label="En Proceso" value={candidates.filter(c=>!['Contratado','Rechazado'].includes(c.stage)).length} icon="⏳" color={C.warning}/>
        <StatCard label="Contratados" value={candidates.filter(c=>c.stage==='Contratado').length} icon="✅" color={C.success}/>
      </div>
      {view==='kanban'?(
        <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:12}}>
          {STAGES.filter(s=>s!=='Rechazado').map(stage=>{
            const cols=candidates.filter(c=>c.stage===stage)
            return <div key={stage} style={{minWidth:190,flex:'0 0 190px'}}>
              <div style={{background:stageColor(stage)+'22',border:`1px solid ${stageColor(stage)}44`,borderRadius:10,padding:'8px 12px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{color:stageColor(stage),fontWeight:800,fontSize:11}}>{stage}</span>
                <span style={{background:stageColor(stage),color:'#fff',borderRadius:20,padding:'1px 8px',fontSize:11,fontWeight:700}}>{cols.length}</span>
              </div>
              {cols.map(c=>(
                <div key={c.id} onClick={()=>{setDetail(c);setAiResult('');setCvText('');setQuestions('')}} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:8,cursor:'pointer'}}>
                  <div style={{color:C.text,fontWeight:700,fontSize:13,marginBottom:3}}>{c.name}</div>
                  <div style={{color:C.muted,fontSize:11,marginBottom:8}}>{c.position}</div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    {c.score>0?<Badge label={`${c.score}%`} color={c.score>=80?C.success:c.score>=60?C.warning:C.danger}/>:<span/>}
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={e=>{e.stopPropagation();const i=STAGES.indexOf(c.stage);if(i>0)moveStage(c.id,STAGES[i-1])}} style={{background:C.border,border:'none',color:C.muted,borderRadius:5,padding:'2px 6px',cursor:'pointer',fontSize:11}}>◀</button>
                      <button onClick={e=>{e.stopPropagation();const i=STAGES.indexOf(c.stage);if(i<STAGES.length-1)moveStage(c.id,STAGES[i+1])}} style={{background:C.accent,border:'none',color:'#fff',borderRadius:5,padding:'2px 6px',cursor:'pointer',fontSize:11}}>▶</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          })}
        </div>
      ):(
        <Card>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{['Candidato','Cargo','Etapa','Fecha','Score','Acciones'].map(h=><th key={h} style={{color:C.muted,fontSize:11,fontWeight:700,padding:'8px 12px',textAlign:'left',textTransform:'uppercase',letterSpacing:1}}>{h}</th>)}</tr></thead>
            <tbody>{candidates.map(c=><tr key={c.id} style={{borderBottom:`1px solid ${C.border}22`}}>
              <td style={{padding:12,color:C.text,fontWeight:600}}>{c.name}</td>
              <td style={{padding:12,color:C.muted,fontSize:13}}>{c.position}</td>
              <td style={{padding:12}}><Badge label={c.stage} color={stageColor(c.stage)}/></td>
              <td style={{padding:12,color:C.muted,fontSize:13}}>{c.date}</td>
              <td style={{padding:12}}>{c.score>0?<Badge label={`${c.score}%`} color={c.score>=80?C.success:C.warning}/>:<span style={{color:C.muted}}>—</span>}</td>
              <td style={{padding:12}}><Btn onClick={()=>{setDetail(c);setAiResult('');setCvText('');setQuestions('')}} style={{padding:'5px 12px',fontSize:12}}>Ver</Btn></td>
            </tr>)}</tbody>
          </table>
        </Card>
      )}

      {modal==='new'&&<Modal title="Nuevo Candidato" onClose={()=>setModal(null)}>
        <Input label="Nombre completo" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ej. Ana Martínez"/>
        <Input label="Cargo" value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="Ej. Desarrollador Backend"/>
        <Input label="Email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
        <Input label="Teléfono" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
        <Sel label="Fuente" value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>
          {['LinkedIn','Portal Empleo','Referido','Web Empresa','Otro'].map(s=><option key={s}>{s}</option>)}
        </Sel>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:10}}>
          <Btn outline color={C.muted} onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn onClick={add} disabled={loading}>{loading?'Guardando...':'Agregar'}</Btn>
        </div>
      </Modal>}

      {detail&&<Modal title="Detalle Candidato" onClose={()=>{setDetail(null);setAiResult('');setCvText('');setQuestions('')}} wide>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          {[['Nombre',detail.name],['Cargo',detail.position],['Email',detail.email],['Teléfono',detail.phone],['Fuente',detail.source],['Fecha',detail.date]].map(([k,v])=>(
            <div key={k} style={{background:C.bg,borderRadius:8,padding:12}}><div style={{color:C.muted,fontSize:11,fontWeight:700,marginBottom:3}}>{k}</div><div style={{color:C.text,fontWeight:600}}>{v||'—'}</div></div>
          ))}
        </div>

        {/* Move stage */}
        <div style={{marginBottom:16}}><div style={{color:C.muted,fontSize:11,fontWeight:700,marginBottom:8}}>ETAPA</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {STAGES.map(s=><button key={s} onClick={()=>moveStage(detail.id,s)} style={{background:detail.stage===s?stageColor(s):'transparent',border:`1px solid ${stageColor(s)}`,color:detail.stage===s?'#fff':stageColor(s),borderRadius:6,padding:'5px 10px',fontSize:11,cursor:'pointer',fontWeight:700}}>{s}</button>)}
          </div>
        </div>

        {/* AI: Analyze CV */}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,marginBottom:16}}>
          <div style={{color:C.accent,fontSize:13,fontWeight:700,marginBottom:8}}>🤖 Analizar CV con IA</div>
          <textarea value={cvText} onChange={e=>setCvText(e.target.value)} placeholder="Pega aquí el texto del CV del candidato..." rows={4} style={{width:'100%',background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 12px',color:C.text,fontSize:13,boxSizing:'border-box',outline:'none',resize:'vertical',marginBottom:8}}/>
          <Btn onClick={analyzeCV} disabled={aiLoading||!cvText} color={C.accent2}>
            {aiLoading?'Analizando...':'🔍 Analizar CV'}
          </Btn>
          <AIBox result={aiResult} loading={aiLoading}/>
        </div>

        {/* AI: Interview Questions */}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
          <div style={{color:C.accent,fontSize:13,fontWeight:700,marginBottom:8}}>🎯 Preguntas de Entrevista con IA</div>
          <Btn onClick={()=>generateQuestions(detail)} disabled={qLoading} color={C.accent}>
            {qLoading?'Generando...':'✨ Generar Preguntas'}
          </Btn>
          <AIBox result={questions} loading={qLoading}/>
        </div>
      </Modal>}
    </div>
  )
}

// ── ONBOARDING ──
function Onboarding({employees,tasks,setTasks}) {
  const [selected,setSelected]=useState(null)
  const toggleTask = async (empId,taskName) => {
    const existing=tasks.find(t=>t.employee_id===empId&&t.task===taskName)
    if(existing){
      await supabase.from('onboarding_tasks').update({done:!existing.done}).eq('id',existing.id)
      setTasks(ts=>ts.map(t=>t.id===existing.id?{...t,done:!t.done}:t))
    } else {
      const {data}=await supabase.from('onboarding_tasks').insert([{employee_id:empId,task:taskName,done:true}]).select()
      if(data) setTasks(ts=>[...ts,...data])
    }
  }
  const getDone=(empId)=>tasks.filter(t=>t.employee_id===empId&&t.done).length
  return (
    <div>
      <h2 style={{color:C.text,margin:'0 0 6px',fontSize:22,fontWeight:800}}>Onboarding</h2>
      <p style={{color:C.muted,margin:'0 0 24px',fontSize:13}}>Seguimiento de incorporación</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {employees.map(emp=>{
          const done=getDone(emp.id);const pct=Math.round((done/ONBOARDING_TASKS.length)*100)
          return <Card key={emp.id} style={{cursor:'pointer'}} onClick={()=>setSelected(emp)}>
            <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:14}}>
              <div style={{width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14}}>{emp.avatar||emp.name?.slice(0,2).toUpperCase()}</div>
              <div><div style={{color:C.text,fontWeight:700}}>{emp.name}</div><div style={{color:C.muted,fontSize:12}}>{emp.role} · {emp.dept}</div></div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{color:C.muted,fontSize:12}}>{done}/{ONBOARDING_TASKS.length} tareas</span>
              <span style={{color:pct===100?C.success:C.accent,fontWeight:700,fontSize:12}}>{pct}%</span>
            </div>
            <div style={{background:C.border,borderRadius:8,height:8,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct}%`,background:pct===100?C.success:`linear-gradient(90deg,${C.accent},${C.accent2})`,borderRadius:8}}/>
            </div>
            <div style={{marginTop:10}}><Badge label={emp.status} color={statusColor(emp.status)}/></div>
          </Card>
        })}
      </div>
      {selected&&<Modal title={`Onboarding — ${selected.name}`} onClose={()=>setSelected(null)}>
        {ONBOARDING_TASKS.map((task,i)=>{
          const done=tasks.find(t=>t.employee_id===selected.id&&t.task===task)?.done||false
          return <div key={i} onClick={()=>toggleTask(selected.id,task)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,marginBottom:6,background:done?C.success+'18':C.bg,border:`1px solid ${done?C.success+'44':C.border}`,cursor:'pointer'}}>
            <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${done?C.success:C.border}`,background:done?C.success:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {done&&<span style={{color:'#fff',fontSize:13,fontWeight:700}}>✓</span>}
            </div>
            <span style={{color:done?C.success:C.text,fontSize:14,fontWeight:done?700:400}}>{task}</span>
          </div>
        })}
      </Modal>}
    </div>
  )
}

// ── EVALUATION ──
function Evaluation({evaluations,setEvaluations,employees}) {
  const [modal,setModal]=useState(null)
  const [form,setForm]=useState({goals:'',skills:'',attitude:''})
  const [report,setReport]=useState('')
  const [rLoading,setRLoading]=useState(false)
  const [reportModal,setReportModal]=useState(null)

  const submit=async(ev)=>{
    const goals=parseInt(form.goals)||0,skills=parseInt(form.skills)||0,attitude=parseInt(form.attitude)||0
    const score=Math.round((goals+skills+attitude)/3)
    await supabase.from('evaluations').update({goals,skills,attitude,score,status:'Completada'}).eq('id',ev.id)
    setEvaluations(es=>es.map(e=>e.id===ev.id?{...e,goals,skills,attitude,score,status:'Completada'}:e))
    setModal(null);setForm({goals:'',skills:'',attitude:''})
  }

  const generateReport = async (ev) => {
    setReportModal(ev); setReport(''); setRLoading(true)
    const emp = employees.find(e=>e.name===ev.employee)
    const result = await gemini(`Eres un experto en gestión del talento humano. Genera un informe profesional de evaluación de desempeño para:

Empleado: ${ev.employee}
Cargo: ${emp?.role || 'No especificado'}
Departamento: ${emp?.dept || 'No especificado'}
Período: ${ev.period}
Evaluador: ${ev.reviewer}

Resultados:
- Cumplimiento de Objetivos: ${ev.goals}/100
- Competencias y Habilidades: ${ev.skills}/100
- Actitud y Trabajo en Equipo: ${ev.attitude}/100
- Score Global: ${ev.score}/100

El informe debe incluir:
1. Resumen ejecutivo (2-3 oraciones)
2. Análisis por dimensión evaluada
3. Logros destacados del período
4. Áreas de oportunidad y desarrollo
5. Plan de acción recomendado (3 acciones concretas)
6. Conclusión y recomendación

Escribe en español, tono profesional y constructivo.`)
    setReport(result)
    setRLoading(false)
  }

  const sc=s=>s>=85?C.success:s>=70?C.warning:C.danger
  const Bar=({label,value})=><div style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}><span style={{color:C.muted,fontSize:12}}>{label}</span><span style={{color:sc(value),fontWeight:700,fontSize:12}}>{value}%</span></div><div style={{background:C.border,borderRadius:8,height:8}}><div style={{height:'100%',width:`${value}%`,background:sc(value),borderRadius:8}}/></div></div>

  return (
    <div>
      <h2 style={{color:C.text,margin:'0 0 6px',fontSize:22,fontWeight:800}}>Evaluación de Desempeño</h2>
      <p style={{color:C.muted,margin:'0 0 24px',fontSize:13}}>Gestión de evaluaciones por periodo</p>
      <div style={{display:'flex',gap:14,marginBottom:24,flexWrap:'wrap'}}>
        <StatCard label="Total" value={evaluations.length} icon="📊"/>
        <StatCard label="Completadas" value={evaluations.filter(e=>e.status==='Completada').length} icon="✅" color={C.success}/>
        <StatCard label="Pendientes" value={evaluations.filter(e=>e.status!=='Completada').length} icon="⏳" color={C.warning}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
        {evaluations.map(ev=>(
          <Card key={ev.id}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
              <div><div style={{color:C.text,fontWeight:700,fontSize:15}}>{ev.employee}</div><div style={{color:C.muted,fontSize:12,marginTop:2}}>{ev.period} · {ev.reviewer}</div></div>
              <Badge label={ev.status} color={statusColor(ev.status)}/>
            </div>
            {ev.status==='Completada'?(
              <div>
                <div style={{textAlign:'center',marginBottom:14}}><div style={{fontSize:36,fontWeight:900,color:sc(ev.score)}}>{ev.score}%</div><div style={{color:C.muted,fontSize:12}}>Score Global</div></div>
                <Bar label="Cumplimiento de Objetivos" value={ev.goals}/>
                <Bar label="Competencias" value={ev.skills}/>
                <Bar label="Actitud y Trabajo en Equipo" value={ev.attitude}/>
                <div style={{marginTop:14}}>
                  <Btn color={C.accent2} onClick={()=>generateReport(ev)} style={{width:'100%',fontSize:12}}>
                    🤖 Generar Informe con IA
                  </Btn>
                </div>
              </div>
            ):(
              <div style={{textAlign:'center',padding:'14px 0'}}>
                <div style={{color:C.muted,marginBottom:12,fontSize:14}}>Pendiente de calificación</div>
                <Btn onClick={()=>{setModal(ev);setForm({goals:'',skills:'',attitude:''})}}>Completar Evaluación</Btn>
              </div>
            )}
          </Card>
        ))}
      </div>

      {modal&&<Modal title={`Evaluar — ${modal.employee}`} onClose={()=>setModal(null)}>
        <Input label="Cumplimiento de Objetivos (0-100)" type="number" min="0" max="100" value={form.goals} onChange={e=>setForm(f=>({...f,goals:e.target.value}))} placeholder="85"/>
        <Input label="Competencias (0-100)" type="number" min="0" max="100" value={form.skills} onChange={e=>setForm(f=>({...f,skills:e.target.value}))} placeholder="78"/>
        <Input label="Actitud (0-100)" type="number" min="0" max="100" value={form.attitude} onChange={e=>setForm(f=>({...f,attitude:e.target.value}))} placeholder="90"/>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:10}}>
          <Btn outline color={C.muted} onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn color={C.success} onClick={()=>submit(modal)}>Guardar</Btn>
        </div>
      </Modal>}

      {reportModal&&<Modal title={`Informe IA — ${reportModal.employee}`} onClose={()=>{setReportModal(null);setReport('')}} wide>
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          {[['Objetivos',reportModal.goals],['Competencias',reportModal.skills],['Actitud',reportModal.attitude],['Score',reportModal.score]].map(([k,v])=>(
            <div key={k} style={{background:C.bg,borderRadius:8,padding:'8px 14px',textAlign:'center'}}>
              <div style={{color:C.muted,fontSize:11}}>{k}</div>
              <div style={{color:sc(v),fontWeight:800,fontSize:18}}>{v}%</div>
            </div>
          ))}
        </div>
        {rLoading?(
          <div style={{textAlign:'center',padding:'32px 0'}}>
            <div style={{color:C.muted,marginBottom:12}}>Gemini está generando el informe...</div>
            <div style={{display:'flex',gap:8,justifyContent:'center'}}>
              {[0,.2,.4].map(d=><div key={d} style={{width:10,height:10,borderRadius:'50%',background:C.accent2,animation:`pulse 1s infinite ${d}s`}}/>)}
            </div>
            <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
          </div>
        ):(
          <div style={{background:C.bg,borderRadius:12,padding:20,color:C.text,fontSize:13,lineHeight:1.8,whiteSpace:'pre-wrap',maxHeight:500,overflowY:'auto'}}>
            {report || 'Cargando informe...'}
          </div>
        )}
      </Modal>}
    </div>
  )
}

// ── PAYROLL ──
function Payroll({payroll,setPayroll,employees}) {
  const [detail,setDetail]=useState(null)
  const markPaid=async(id)=>{
    await supabase.from('payroll').update({status:'Pagado'}).eq('id',id)
    setPayroll(ps=>ps.map(p=>p.id===id?{...p,status:'Pagado'}:p))
  }
  const total=payroll.reduce((a,b)=>a+(b.net||0),0)
  const pending=payroll.filter(p=>p.status==='Pendiente').reduce((a,b)=>a+(b.net||0),0)
  return (
    <div>
      <h2 style={{color:C.text,margin:'0 0 6px',fontSize:22,fontWeight:800}}>Nómina & Contratos</h2>
      <p style={{color:C.muted,margin:'0 0 24px',fontSize:13}}>Gestión de pagos y contratos</p>
      <div style={{display:'flex',gap:14,marginBottom:24,flexWrap:'wrap'}}>
        <StatCard label="Nómina Total" value={fmt(total)} icon="💰" color={C.success}/>
        <StatCard label="Pendiente" value={fmt(pending)} icon="⏳" color={C.warning}/>
        <StatCard label="Pagados" value={payroll.filter(p=>p.status==='Pagado').length} icon="✅" color={C.success}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16}}>
        {payroll.map(p=>(
          <Card key={p.id}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
              <div><div style={{color:C.text,fontWeight:700}}>{p.employee}</div><div style={{color:C.muted,fontSize:12,marginTop:2}}>{p.month}</div></div>
              <Badge label={p.status} color={statusColor(p.status)}/>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:12}}>
              {[['Salario Base',p.base_salary,C.text],['Bonificaciones',p.bonus,C.success],['Deducciones',-p.deductions,C.danger]].map(([k,v,col])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{color:C.muted,fontSize:13}}>{k}</span>
                  <span style={{color:col,fontWeight:600,fontSize:13}}>{v<0?`-${fmt(-v)}`:fmt(v)}</span>
                </div>
              ))}
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,marginTop:4,display:'flex',justifyContent:'space-between'}}>
                <span style={{color:C.text,fontWeight:700}}>Neto</span>
                <span style={{color:C.success,fontWeight:900,fontSize:16}}>{fmt(p.net)}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              {p.status==='Pendiente'&&<Btn color={C.success} onClick={()=>markPaid(p.id)} style={{flex:1}}>✓ Pagado</Btn>}
              <Btn outline color={C.accent} onClick={()=>setDetail(p)} style={{flex:1,fontSize:12}}>Ver Contrato</Btn>
            </div>
          </Card>
        ))}
      </div>
      {detail&&<Modal title="Detalle Contrato" onClose={()=>setDetail(null)}>
        {(()=>{
          const emp=employees.find(e=>e.name===detail.employee)
          return <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
              {[['Empleado',detail.employee],['Contrato',emp?.contract||'—'],['Dept',emp?.dept||'—'],['Cargo',emp?.role||'—'],['Ingreso',emp?.start_date||'—'],['Estado',emp?.status||'—']].map(([k,v])=>(
                <div key={k} style={{background:C.bg,borderRadius:8,padding:12}}><div style={{color:C.muted,fontSize:11,fontWeight:700}}>{k}</div><div style={{color:C.text,fontWeight:600,marginTop:2}}>{v}</div></div>
              ))}
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:14}}>
              {[['Salario Base',fmt(detail.base_salary)],['Bonificaciones',fmt(detail.bonus)],['Deducciones',fmt(detail.deductions)],['Neto',fmt(detail.net)]].map(([k,v],i)=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<3?`1px solid ${C.border}`:'none'}}>
                  <span style={{color:i===3?C.text:C.muted,fontWeight:i===3?700:400}}>{k}</span>
                  <span style={{color:i===3?C.success:C.text,fontWeight:i===3?900:600}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        })()}
      </Modal>}
    </div>
  )
}

const TABS=[{id:'dashboard',label:'Dashboard',icon:'🏠'},{id:'recruitment',label:'Reclutamiento',icon:'🔍'},{id:'onboarding',label:'Onboarding',icon:'🎯'},{id:'evaluation',label:'Evaluaciones',icon:'📊'},{id:'payroll',label:'Nómina',icon:'💰'}]

export default function Home() {
  const [tab,setTab]=useState('dashboard')
  const [candidates,setCandidates]=useState([])
  const [employees,setEmployees]=useState([])
  const [evaluations,setEvaluations]=useState([])
  const [payroll,setPayroll]=useState([])
  const [tasks,setTasks]=useState([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    const load=async()=>{
      const [c,e,ev,p,t]=await Promise.all([
        supabase.from('candidates').select('*').order('id'),
        supabase.from('employees').select('*').order('id'),
        supabase.from('evaluations').select('*').order('id'),
        supabase.from('payroll').select('*').order('id'),
        supabase.from('onboarding_tasks').select('*'),
      ])
      setCandidates(c.data||[]);setEmployees(e.data||[]);setEvaluations(ev.data||[]);setPayroll(p.data||[]);setTasks(t.data||[])
      setLoading(false)
    }
    load()
  },[])

  return (
    <>
      <Head>
        <title>TH Suite — Talento Humano</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      </Head>
      <div style={{display:'flex',minHeight:'100vh',background:C.bg}}>
        <div style={{width:220,background:C.surface,borderRight:`1px solid ${C.border}`,padding:'24px 12px',display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,bottom:0,zIndex:100}}>
          <div style={{padding:'0 8px 28px'}}>
            <div style={{fontSize:20,fontWeight:900,background:`linear-gradient(135deg,${C.accent},${C.accent2})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>TH Suite</div>
            <div style={{color:C.muted,fontSize:11,marginTop:2}}>Talento Humano</div>
          </div>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,border:'none',background:tab===t.id?C.accent+'22':'transparent',color:tab===t.id?C.accent:C.muted,fontWeight:tab===t.id?700:500,fontSize:14,cursor:'pointer',marginBottom:4,textAlign:'left',width:'100%'}}>
              <span>{t.icon}</span><span>{t.label}</span>
              {tab===t.id&&<div style={{marginLeft:'auto',width:4,height:4,borderRadius:2,background:C.accent}}/>}
            </button>
          ))}
          <div style={{flex:1}}/>
          <div style={{padding:'12px 8px',borderTop:`1px solid ${C.border}`}}>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <div style={{width:34,height:34,borderRadius:8,background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:12}}>HR</div>
              <div><div style={{color:C.text,fontSize:13,fontWeight:600}}>Admin RRHH</div><div style={{color:C.muted,fontSize:11}}>Administrador</div></div>
            </div>
          </div>
        </div>
        <div style={{marginLeft:220,flex:1,padding:32,minHeight:'100vh'}}>
          {loading?(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:16}}>
              <div style={{width:40,height:40,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <span style={{color:C.muted}}>Cargando datos...</span>
            </div>
          ):(
            <>
              {tab==='dashboard'&&<Dashboard candidates={candidates} employees={employees} evaluations={evaluations} payroll={payroll}/>}
              {tab==='recruitment'&&<Recruitment candidates={candidates} setCandidates={setCandidates}/>}
              {tab==='onboarding'&&<Onboarding employees={employees} tasks={tasks} setTasks={setTasks}/>}
              {tab==='evaluation'&&<Evaluation evaluations={evaluations} setEvaluations={setEvaluations} employees={employees}/>}
              {tab==='payroll'&&<Payroll payroll={payroll} setPayroll={setPayroll} employees={employees}/>}
            </>
          )}
        </div>
      </div>
    </>
  )
}
