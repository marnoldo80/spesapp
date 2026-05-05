import { useState, useEffect } from "react";

const SUPABASE_URL = "https://qfxdmcfshtcfikhoqwlq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeGRtY2ZzaHRjZmlraG9xd2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzExMjYsImV4cCI6MjA5MzU0NzEyNn0.vekMOhwDncvSYJ1CED3XPjqWiN_GBYmgYyKOpPbtTOs";

const api = async (path, opts = {}) => {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

function calcBalances(members, expenses) {
  const bal = {};
  members.forEach(m => (bal[m.email] = 0));
  expenses.forEach(exp => {
    const split = exp.split_among || [];
    const share = exp.amount / split.length;
    split.forEach(p => { if (bal[p.email] !== undefined) bal[p.email] -= share; });
    if (bal[exp.paid_by_email] !== undefined) bal[exp.paid_by_email] += exp.amount;
  });
  return bal;
}

function calcSettlements(balances) {
  const creditors = [], debtors = [];
  Object.entries(balances).forEach(([email, amt]) => {
    if (amt > 0.01) creditors.push({ email, amt });
    else if (amt < -0.01) debtors.push({ email, amt: -amt });
  });
  const txs = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const pay = Math.min(creditors[i].amt, debtors[j].amt);
    txs.push({ from: debtors[j].email, to: creditors[i].email, amount: pay });
    creditors[i].amt -= pay; debtors[j].amt -= pay;
    if (creditors[i].amt < 0.01) i++;
    if (debtors[j].amt < 0.01) j++;
  }
  return txs;
}

function nameFor(email, members) {
  const m = members.find(x => x.email === email);
  return m?.name || email;
}

const btn = (extra = {}) => ({
  border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 15, ...extra
});

function HomeView({ onEnter }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [mode, setMode] = useState("owner");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleOwner = () => { if (!email.trim()) return setMsg("Inserisci la tua email"); onEnter({ email: email.trim(), role: "owner" }); };

  const handleMember = async () => {
    if (!token.trim()) return setMsg("Inserisci il token");
    setLoading(true); setMsg("");
    try {
      const data = await api("project_members?token=eq." + token.trim() + "&select=*,projects(*)");
      if (!data || !data.length) return setMsg("Token non valido");
      const member = data[0];
      if (!member.accepted) await api("project_members?id=eq." + member.id, { method: "PATCH", body: JSON.stringify({ accepted: true, joined_at: new Date().toISOString() }) });
      onEnter({ email: member.email, role: "member", projectId: member.project_id });
    } catch(e) { setMsg("Errore: " + e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 24, padding: 40, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>💸</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>SpesApp</h1>
          <p style={{ margin: "8px 0 0", color: "#666", fontSize: 14 }}>Spese condivise, semplici e trasparenti</p>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["owner","member"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:"10px 0", borderRadius:12, border:"2px solid", borderColor: mode===m?"#667eea":"#e5e7eb", background: mode===m?"#667eea":"white", color: mode===m?"white":"#666", fontWeight:600, cursor:"pointer", fontSize:13 }}>
              {m==="owner"?"👑 Sono il creatore":"🔗 Ho un invito"}
            </button>
          ))}
        </div>
        {mode==="owner" ? (
          <>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="mario@email.com" onKeyDown={e=>e.key==="Enter"&&handleOwner()}
              style={{ width:"100%", padding:"12px 16px", borderRadius:12, border:"1.5px solid #e5e7eb", fontSize:15, boxSizing:"border-box" }} />
            <button onClick={handleOwner} style={{ ...btn({width:"100%",marginTop:12,padding:"14px 0",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white",fontSize:16}) }}>Accedi →</button>
          </>
        ) : (
          <>
            <input value={token} onChange={e=>setToken(e.target.value)} placeholder="token di invito" onKeyDown={e=>e.key==="Enter"&&handleMember()}
              style={{ width:"100%", padding:"12px 16px", borderRadius:12, border:"1.5px solid #e5e7eb", fontSize:13, boxSizing:"border-box", fontFamily:"monospace" }} />
            <button onClick={handleMember} disabled={loading} style={{ ...btn({width:"100%",marginTop:12,padding:"14px 0",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white",fontSize:16}) }}>
              {loading?"...":"Entra nel progetto →"}
            </button>
          </>
        )}
        {msg && <p style={{ marginTop:12, color:"#e53e3e", fontSize:13, textAlign:"center" }}>{msg}</p>}
      </div>
    </div>
  );
}

function ProjectListView({ ownerEmail, onSelect, onNew }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("projects?owner_email=eq." + encodeURIComponent(ownerEmail) + "&order=created_at.desc").then(setProjects).finally(()=>setLoading(false)); }, []);
  return (
    <div style={{ minHeight:"100vh", background:"#f8f9ff", padding:20, maxWidth:480, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div><h2 style={{ margin:0, fontWeight:800 }}>I miei progetti</h2><p style={{ margin:0, fontSize:13, color:"#888" }}>{ownerEmail}</p></div>
        <button onClick={onNew} style={{ ...btn({background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white",padding:"10px 18px",fontSize:14}) }}>+ Nuovo</button>
      </div>
      {loading ? <p style={{ textAlign:"center", color:"#888" }}>Caricamento...</p> : projects.length===0 ? (
        <div style={{ textAlign:"center", padding:60 }}><div style={{ fontSize:48 }}>📂</div><p style={{ color:"#888" }}>Nessun progetto ancora.</p></div>
      ) : projects.map(p => (
        <div key={p.id} onClick={()=>onSelect(p)} style={{ background:"white", borderRadius:16, padding:20, marginBottom:12, boxShadow:"0 2px 12px rgba(0,0,0,.06)", cursor:"pointer", border:"1.5px solid transparent" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#667eea"} onMouseLeave={e=>e.currentTarget.style.borderColor="transparent"}>
          <h3 style={{ margin:0, fontWeight:700 }}>{p.name}</h3>
          {p.description && <p style={{ margin:"4px 0 0", fontSize:13, color:"#888" }}>{p.description}</p>}
        </div>
      ))}
    </div>
  );
}

function NewProjectView({ ownerEmail, onCreated, onBack }) {
  const [name, setName] = useState(""); const [desc, setDesc] = useState(""); const [loading, setLoading] = useState(false); const [msg, setMsg] = useState("");
  const create = async () => {
    if (!name.trim()) return setMsg("Inserisci un nome");
    setLoading(true);
    try {
      const data = await api("projects", { method:"POST", body: JSON.stringify({ name:name.trim(), description:desc.trim(), owner_email:ownerEmail }) });
      await api("project_members", { method:"POST", body: JSON.stringify({ project_id:data[0].id, email:ownerEmail, name:ownerEmail.split("@")[0], accepted:true, joined_at:new Date().toISOString() }) });
      onCreated(data[0]);
    } catch(e) { setMsg("Errore: "+e.message); }
    setLoading(false);
  };
  return (
    <div style={{ minHeight:"100vh", background:"#f8f9ff", padding:20, maxWidth:480, margin:"0 auto" }}>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#667eea", fontWeight:600, cursor:"pointer", marginBottom:20, fontSize:15 }}>← Indietro</button>
      <h2 style={{ margin:"0 0 24px", fontWeight:800 }}>Nuovo progetto</h2>
      <div style={{ background:"white", borderRadius:16, padding:24, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
        <label style={{ display:"block", fontWeight:600, marginBottom:6, fontSize:14 }}>Nome *</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="es. Spese Casa Maggio"
          style={{ width:"100%", padding:"12px 16px", borderRadius:10, border:"1.5px solid #e5e7eb", fontSize:15, boxSizing:"border-box", marginBottom:16 }} />
        <label style={{ display:"block", fontWeight:600, marginBottom:6, fontSize:14 }}>Descrizione</label>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="opzionale"
          style={{ width:"100%", padding:"12px 16px", borderRadius:10, border:"1.5px solid #e5e7eb", fontSize:15, boxSizing:"border-box", marginBottom:20 }} />
        <button onClick={create} disabled={loading} style={{ ...btn({width:"100%",padding:"14px 0",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white",fontSize:16}) }}>
          {loading?"Creazione...":"Crea progetto →"}
        </button>
        {msg && <p style={{ marginTop:10, color:"#e53e3e", fontSize:13 }}>{msg}</p>}
      </div>
    </div>
  );
}

function ProjectView({ project, ownerEmail, onBack }) {
  const isOwner = ownerEmail && project.owner_email === ownerEmail;
  const [tab, setTab] = useState("spese");
  const [members, setMembers] = useState([]); const [expenses, setExpenses] = useState([]); const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false); const [showInvite, setShowInvite] = useState(false);

  const reload = async () => {
    const [m, e] = await Promise.all([
      api("project_members?project_id=eq."+project.id+"&accepted=eq.true"),
      api("expenses?project_id=eq."+project.id+"&order=created_at.desc"),
    ]);
    setMembers(m||[]); setExpenses(e||[]); setLoading(false);
  };
  useEffect(()=>{ reload(); },[]);

  const balances = calcBalances(members, expenses);
  const settlements = calcSettlements(balances);
  const total = expenses.reduce((s,e)=>s+parseFloat(e.amount),0);
  const tabs = [{key:"spese",label:"💳 Spese"},{key:"saldi",label:"⚖️ Saldi"},{key:"membri",label:"👥 Membri"}];

  return (
    <div style={{ minHeight:"100vh", background:"#f8f9ff", maxWidth:480, margin:"0 auto" }}>
      <div style={{ background:"linear-gradient(135deg,#667eea,#764ba2)", padding:"20px 20px 30px", color:"white" }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"white", borderRadius:8, padding:"6px 12px", cursor:"pointer", marginBottom:12 }}>← Progetti</button>
        <h2 style={{ margin:0, fontWeight:800, fontSize:22 }}>{project.name}</h2>
        {project.description && <p style={{ margin:"4px 0 0", opacity:.85, fontSize:14 }}>{project.description}</p>}
        <p style={{ margin:"12px 0 0", fontSize:13, opacity:.8 }}>Totale: <strong>€{total.toFixed(2)}</strong> · {members.length} membri</p>
      </div>
      <div style={{ display:"flex", background:"white", boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{ flex:1, padding:"14px 0", border:"none", background:"none", borderBottom: tab===t.key?"3px solid #667eea":"3px solid transparent", color: tab===t.key?"#667eea":"#888", fontWeight:600, cursor:"pointer", fontSize:13 }}>{t.label}</button>
        ))}
      </div>
      <div style={{ padding:20 }}>
        {loading ? <p style={{ textAlign:"center", color:"#888" }}>Caricamento...</p> : (<>
          {tab==="spese" && (<>
            <button onClick={()=>setShowAddExpense(true)} style={{ ...btn({width:"100%",padding:"14px 0",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white",marginBottom:16}) }}>+ Aggiungi spesa</button>
            {expenses.length===0 ? <div style={{ textAlign:"center", padding:40 }}><div style={{ fontSize:40 }}>🧾</div><p style={{ color:"#888" }}>Nessuna spesa ancora</p></div>
            : expenses.map(exp=>(
              <div key={exp.id} style={{ background:"white", borderRadius:14, padding:16, marginBottom:10, boxShadow:"0 2px 8px rgba(0,0,0,.05)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <p style={{ margin:0, fontWeight:700 }}>{exp.description}</p>
                    <p style={{ margin:"4px 0 0", fontSize:12, color:"#888" }}>Pagato da <strong>{exp.paid_by_name}</strong> · diviso in {exp.split_among?.length||1}</p>
                    <p style={{ margin:"2px 0 0", fontSize:11, color:"#aaa" }}>{new Date(exp.created_at).toLocaleDateString("it-IT")}</p>
                  </div>
                  <span style={{ fontWeight:800, fontSize:18, color:"#667eea" }}>€{parseFloat(exp.amount).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </>)}
          {tab==="saldi" && (<>
            <h3 style={{ margin:"0 0 16px", fontWeight:700, color:"#444" }}>Saldo per persona</h3>
            {members.map(m=>{ const b=balances[m.email]||0; return (
              <div key={m.email} style={{ background:"white", borderRadius:12, padding:"14px 16px", marginBottom:8, boxShadow:"0 2px 8px rgba(0,0,0,.05)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><p style={{ margin:0, fontWeight:600 }}>{m.name||m.email}</p><p style={{ margin:0, fontSize:12, color:"#888" }}>{m.email}</p></div>
                <span style={{ fontWeight:800, fontSize:16, color: b>=0?"#38a169":"#e53e3e" }}>{b>=0?"+":""}€{b.toFixed(2)}</span>
              </div>
            );})}
            {settlements.length>0 && (<>
              <h3 style={{ margin:"24px 0 12px", fontWeight:700, color:"#444" }}>Come pareggiare</h3>
              {settlements.map((s,i)=>(
                <div key={i} style={{ background:"#fff8e1", borderRadius:12, padding:"12px 16px", marginBottom:8, border:"1px solid #ffd54f" }}>
                  <p style={{ margin:0, fontSize:14 }}><strong>{nameFor(s.from,members)}</strong> paga <strong>€{s.amount.toFixed(2)}</strong> a <strong>{nameFor(s.to,members)}</strong></p>
                </div>
              ))}
            </>)}
            {settlements.length===0&&expenses.length>0 && <div style={{ textAlign:"center", padding:20, background:"#f0fff4", borderRadius:12 }}><p style={{ color:"#38a169", fontWeight:600 }}>✅ Tutto in pari!</p></div>}
          </>)}
          {tab==="membri" && (<>
            {isOwner && <button onClick={()=>setShowInvite(true)} style={{ width:"100%", padding:"14px 0", borderRadius:12, border:"2px dashed #667eea", background:"transparent", color:"#667eea", fontWeight:700, fontSize:15, cursor:"pointer", marginBottom:16 }}>+ Invita membro</button>}
            {members.map(m=>(
              <div key={m.email} style={{ background:"white", borderRadius:12, padding:"14px 16px", marginBottom:8, boxShadow:"0 2px 8px rgba(0,0,0,.05)", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:20, background:"linear-gradient(135deg,#667eea,#764ba2)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:700, fontSize:16 }}>{(m.name||m.email)[0].toUpperCase()}</div>
                <div><p style={{ margin:0, fontWeight:600 }}>{m.name||m.email}</p><p style={{ margin:0, fontSize:12, color:"#888" }}>{m.email}</p></div>
                {m.email===project.owner_email && <span style={{ marginLeft:"auto", fontSize:11, background:"#e9d5ff", color:"#7c3aed", borderRadius:20, padding:"3px 10px", fontWeight:600 }}>Admin</span>}
              </div>
            ))}
          </>)}
        </>)}
      </div>
      {showAddExpense && <AddExpenseModal project={project} members={members} onClose={()=>{ setShowAddExpense(false); reload(); }} userEmail={ownerEmail||""} />}
      {showInvite && <InviteModal project={project} onClose={()=>{ setShowInvite(false); reload(); }} />}
    </div>
  );
}

function AddExpenseModal({ project, members, onClose, userEmail }) {
  const [desc, setDesc] = useState(""); const [amount, setAmount] = useState(""); const [paidBy, setPaidBy] = useState(userEmail||(members[0]?.email||""));
  const [splitAmong, setSplitAmong] = useState(members.map(m=>m.email)); const [loading, setLoading] = useState(false); const [msg, setMsg] = useState("");
  const toggle = email => setSplitAmong(prev => prev.includes(email) ? prev.filter(e=>e!==email) : [...prev,email]);
  const save = async () => {
    if (!desc.trim()) return setMsg("Inserisci descrizione");
    if (!amount||isNaN(parseFloat(amount))) return setMsg("Importo non valido");
    if (!splitAmong.length) return setMsg("Seleziona almeno una persona");
    setLoading(true);
    try {
      const payer = members.find(m=>m.email===paidBy);
      await api("expenses", { method:"POST", body: JSON.stringify({ project_id:project.id, description:desc.trim(), amount:parseFloat(amount), paid_by_email:paidBy, paid_by_name:payer?.name||paidBy, split_among:splitAmong.map(e=>{ const m=members.find(x=>x.email===e); return {email:e,name:m?.name||e}; }) }) });
      onClose();
    } catch(e) { setMsg("Errore: "+e.message); }
    setLoading(false);
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", zIndex:100 }}>
      <div style={{ background:"white", borderRadius:"24px 24px 0 0", padding:24, width:"100%", maxWidth:480, margin:"0 auto", maxHeight:"90vh", overflowY:"auto" }}>
        <h3 style={{ margin:"0 0 20px", fontWeight:800 }}>Nuova spesa</h3>
        <label style={{ display:"block", fontWeight:600, marginBottom:6, fontSize:14 }}>Descrizione</label>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="es. Cena al ristorante" style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1.5px solid #e5e7eb", fontSize:15, boxSizing:"border-box", marginBottom:14 }} />
        <label style={{ display:"block", fontWeight:600, marginBottom:6, fontSize:14 }}>Importo (€)</label>
        <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0" step="0.01" style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1.5px solid #e5e7eb", fontSize:15, boxSizing:"border-box", marginBottom:14 }} />
        <label style={{ display:"block", fontWeight:600, marginBottom:8, fontSize:14 }}>Chi ha pagato?</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
          {members.map(m=><button key={m.email} onClick={()=>setPaidBy(m.email)} style={{ padding:"8px 14px", borderRadius:20, border:"1.5px solid", borderColor:paidBy===m.email?"#667eea":"#e5e7eb", background:paidBy===m.email?"#eef2ff":"white", color:paidBy===m.email?"#667eea":"#444", fontWeight:600, cursor:"pointer", fontSize:13 }}>{m.name||m.email}</button>)}
        </div>
        <label style={{ display:"block", fontWeight:600, marginBottom:8, fontSize:14 }}>Dividi tra</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
          {members.map(m=><button key={m.email} onClick={()=>toggle(m.email)} style={{ padding:"8px 14px", borderRadius:20, border:"1.5px solid", borderColor:splitAmong.includes(m.email)?"#38a169":"#e5e7eb", background:splitAmong.includes(m.email)?"#f0fff4":"white", color:splitAmong.includes(m.email)?"#38a169":"#444", fontWeight:600, cursor:"pointer", fontSize:13 }}>{splitAmong.includes(m.email)?"✓ ":""}{m.name||m.email}</button>)}
        </div>
        {splitAmong.length>0&&amount && <p style={{ fontSize:13, color:"#888", marginBottom:16 }}>Quota: <strong>€{(parseFloat(amount)/splitAmong.length).toFixed(2)}</strong> a persona</p>}
        {msg && <p style={{ color:"#e53e3e", fontSize:13, marginBottom:10 }}>{msg}</p>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"1.5px solid #e5e7eb", background:"white", fontWeight:600, cursor:"pointer" }}>Annulla</button>
          <button onClick={save} disabled={loading} style={{ ...btn({flex:2,padding:"13px 0",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white"}) }}>{loading?"Salvataggio...":"Salva spesa"}</button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ project, onClose }) {
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [loading, setLoading] = useState(false); const [result, setResult] = useState(null); const [msg, setMsg] = useState("");
  const invite = async () => {
    if (!email.trim()) return setMsg("Inserisci email");
    setLoading(true); setMsg("");
    try {
      const data = await api("project_members", { method:"POST", body: JSON.stringify({ project_id:project.id, email:email.trim(), name:name.trim()||email.split("@")[0] }) });
      setResult(data[0]);
    } catch(e) { if(e.message.includes("unique")) setMsg("Già invitato"); else setMsg("Errore: "+e.message); }
    setLoading(false);
  };
  const msg2 = result ? 'Sei stato invitato al progetto "'+project.name+'" su SpesApp!\n\nIl tuo token di accesso è:\n'+result.token+'\n\nApri SpesApp, scegli "Ho un invito" e incolla questo token.' : "";
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", zIndex:100 }}>
      <div style={{ background:"white", borderRadius:"24px 24px 0 0", padding:24, width:"100%", maxWidth:480, margin:"0 auto" }}>
        <h3 style={{ margin:"0 0 20px", fontWeight:800 }}>Invita membro</h3>
        {!result ? (<>
          <label style={{ display:"block", fontWeight:600, marginBottom:6, fontSize:14 }}>Nome</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="es. Giulia" style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1.5px solid #e5e7eb", fontSize:15, boxSizing:"border-box", marginBottom:14 }} />
          <label style={{ display:"block", fontWeight:600, marginBottom:6, fontSize:14 }}>Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="giulia@email.com" style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1.5px solid #e5e7eb", fontSize:15, boxSizing:"border-box", marginBottom:20 }} />
          {msg && <p style={{ color:"#e53e3e", fontSize:13, marginBottom:10 }}>{msg}</p>}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"1.5px solid #e5e7eb", background:"white", fontWeight:600, cursor:"pointer" }}>Annulla</button>
            <button onClick={invite} disabled={loading} style={{ ...btn({flex:2,padding:"13px 0",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white"}) }}>{loading?"...":"Crea invito →"}</button>
          </div>
        </>) : (<>
          <div style={{ background:"#f0fff4", borderRadius:12, padding:16, marginBottom:16, border:"1px solid #9ae6b4" }}>
            <p style={{ margin:0, fontWeight:600, color:"#276749" }}>✅ Invito creato!</p>
            <p style={{ margin:"8px 0 0", fontSize:13 }}>Invia questo messaggio a <strong>{email}</strong>:</p>
          </div>
          <div style={{ background:"#f7fafc", borderRadius:10, padding:14, marginBottom:16, fontFamily:"monospace", fontSize:13, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>{msg2}</div>
          <button onClick={()=>navigator.clipboard?.writeText(msg2)} style={{ width:"100%", marginBottom:10, padding:"12px 0", borderRadius:10, border:"1.5px solid #667eea", background:"white", color:"#667eea", fontWeight:700, cursor:"pointer" }}>📋 Copia messaggio</button>
          <button onClick={onClose} style={{ ...btn({width:"100%",padding:"13px 0",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white"}) }}>Chiudi</button>
        </>)}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState("home");
  const [selectedProject, setSelectedProject] = useState(null);

  const handleEnter = (s) => {
    setSession(s);
    if (s.role==="member"&&s.projectId) {
      api("projects?id=eq."+s.projectId).then(data=>{ if(data&&data[0]){ setSelectedProject(data[0]); setView("project"); } });
    } else { setView("projects"); }
  };

  if (view==="home") return <HomeView onEnter={handleEnter} />;
  if (view==="projects") return <ProjectListView ownerEmail={session.email} onSelect={p=>{setSelectedProject(p);setView("project");}} onNew={()=>setView("newProject")} />;
  if (view==="newProject") return <NewProjectView ownerEmail={session.email} onBack={()=>setView("projects")} onCreated={p=>{setSelectedProject(p);setView("project");}} />;
  if (view==="project") return <ProjectView project={selectedProject} ownerEmail={session?.role==="owner"?session.email:null} onBack={()=>setView(session?.role==="member"?"home":"projects")} />;
}