import { useState, useEffect, useRef } from "react";

// ── CONSTANTS ──
const PF_RATE=0.12,PF_CAP=15000,ESI_EE=0.0075,ESI_ER=0.0325,ESI_THRESH=21000,OT_MULT=2;

const WORKERS=[
  {id:1,name:"Ramesh Patel",role:"Fitter",wage:650,uan:"100123456789",esi:"3112345678",site:"Tema India"},
  {id:2,name:"Suresh Yadav",role:"Welder",wage:750,uan:"100123456790",esi:"3112345679",site:"Tema India"},
  {id:3,name:"Mahesh Sharma",role:"Helper",wage:450,uan:"100123456791",esi:"3112345680",site:"Tema India"},
  {id:4,name:"Rajesh Tiwari",role:"Fitter",wage:650,uan:"100123456792",esi:"3112345681",site:"Tema India"},
  {id:5,name:"Dinesh Kumar",role:"Electrician",wage:700,uan:"100123456793",esi:"3112345682",site:"Sudhir Brothers"},
  {id:6,name:"Ganesh Rathod",role:"Helper",wage:450,uan:"100123456794",esi:"3112345683",site:"Sudhir Brothers"},
  {id:7,name:"Prakash Solanki",role:"Crane Op.",wage:800,uan:"100123456795",esi:"3112345684",site:"Tema India"},
  {id:8,name:"Nilesh Joshi",role:"Welder",wage:750,uan:"100123456796",esi:"3112345685",site:"Sudhir Brothers"},
  {id:9,name:"Kamlesh Parmar",role:"Fitter",wage:650,uan:"100123456797",esi:"3112345686",site:"Tema India"},
  {id:10,name:"Yogesh Bhatt",role:"Helper",wage:450,uan:"100123456798",esi:"3112345687",site:"Sudhir Brothers"},
];

const SITES=["Tema India","Sudhir Brothers"];
const MONTHS=["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function seedAtt(workers,m,y){
  const days=new Date(y,m,0).getDate();
  const a={};
  workers.forEach(w=>{a[w.id]={};
    for(let d=1;d<=days;d++){
      const dow=new Date(y,m-1,d).getDay();
      if(dow===0){a[w.id][d]="WO";continue;}
      const r=Math.random();
      a[w.id][d]=r<0.76?"P":r<0.86?"A":r<0.92?"HD":"OT";
    }
  });return a;
}

function calcWage(w,att,m,y){
  const days=new Date(y,m,0).getDate();
  let pr=0,ab=0,hd=0,ot=0,wo=0;
  for(let d=1;d<=days;d++){
    const s=att[d]||"A";
    if(s==="P")pr++;else if(s==="A")ab++;else if(s==="HD")hd++;
    else if(s==="OT"){pr++;ot++;}else if(s==="WO")wo++;
  }
  const eff=pr+hd*0.5;
  const basic=Math.round(eff*w.wage);
  const otPay=Math.round(ot*(w.wage/8)*OT_MULT);
  const gross=basic+otPay;
  const pfW=Math.min(gross,PF_CAP);
  const pfEe=Math.round(pfW*PF_RATE);
  const pfEr=Math.round(pfW*PF_RATE);
  const esiOk=gross<=ESI_THRESH;
  const esiEe=esiOk?Math.round(gross*ESI_EE):0;
  const esiEr=esiOk?Math.round(gross*ESI_ER):0;
  const net=gross-pfEe-esiEe;
  return{pr,ab,hd,ot,wo,eff,basic,otPay,gross,pfW,pfEe,pfEr,esiEe,esiEr,net};
}

const fmt=n=>"₹"+n.toLocaleString("en-IN");

// ── CHAT RESPONSES ──
function chatResponse(input,wages,workers){
  const l=input.toLowerCase();
  if(l.includes("attendance")||l.includes("haziri")||l.includes("hajri")){
    const tp=wages.reduce((s,w)=>s+w.pr,0);
    const ta=wages.reduce((s,w)=>s+w.ab,0);
    return`📋 March 2026 Attendance Summary:\n\nTotal Workers: ${workers.length}\nPresent Days (all workers): ${tp}\nAbsent Days: ${ta}\nAvg Attendance: ${Math.round(tp/(tp+ta)*100)}%\n\n✅ Logged successfully.`;
  }
  if(l.includes("aaj")||l.includes("today")){
    const present=workers.filter((_,i)=>Math.random()>0.15);
    const absent=workers.filter(w=>!present.includes(w));
    return`✅ Attendance — 15 Mar 2026:\n\nPresent (${present.length}): ${present.map(w=>w.name.split(" ")[0]).join(", ")}\nAbsent (${absent.length}): ${absent.length?absent.map(w=>w.name.split(" ")[0]).join(", "):"None"}\n\nTotal: ${present.length}/${workers.length} logged.`;
  }
  if(l.includes("wage")||l.includes("salary")||l.includes("tankhwah")){
    const tg=wages.reduce((s,w)=>s+w.gross,0);
    const tn=wages.reduce((s,w)=>s+w.net,0);
    const tp=wages.reduce((s,w)=>s+w.pfEe,0);
    return`💰 March 2026 Wages:\n\nTotal Gross: ${fmt(tg)}\nPF Deductions: ${fmt(tp)}\nNet Payable: ${fmt(tn)}\n\n📅 Payment due: 7 Apr 2026\n📄 PF ECR due: 15 Apr 2026\n\n📎 Wage sheet Excel ready — downloading...`;
  }
  if(l.includes("invoice")||l.includes("bill")){
    const tg=wages.reduce((s,w)=>s+w.gross,0);
    const pfr=wages.reduce((s,w)=>s+w.pfEr,0);
    const esir=wages.reduce((s,w)=>s+w.esiEr,0);
    const sc=Math.round(tg*0.10);
    const sub=tg+pfr+esir+sc;
    const gst=Math.round(sub*0.18);
    return`🧾 Invoice — March 2026:\n\nGross Wages: ${fmt(tg)}\nPF Employer: ${fmt(pfr)}\nESI Employer: ${fmt(esir)}\nService (10%): ${fmt(sc)}\nSub-total: ${fmt(sub)}\nGST @18%: ${fmt(gst)}\n\n━━━━━━━━━━━━━━━━━\nTotal: ${fmt(sub+gst)}\n━━━━━━━━━━━━━━━━━\n\n📎 Invoice PDF ready.`;
  }
  if(l.includes("pf")||l.includes("provident")){
    const ee=wages.reduce((s,w)=>s+w.pfEe,0);
    const er=wages.reduce((s,w)=>s+w.pfEr,0);
    return`🏦 PF Summary — March 2026:\n\nEmployee (12%): ${fmt(ee)}\nEmployer (12%): ${fmt(er)}\nTotal Deposit: ${fmt(ee+er)}\n\n⚠️ ECR Filing Due: 15 Apr 2026\nLate penalty: 12% interest + damages`;
  }
  if(l.includes("esi")){
    const eligible=wages.filter(w=>w.esiEe>0).length;
    const ee=wages.reduce((s,w)=>s+w.esiEe,0);
    const er=wages.reduce((s,w)=>s+w.esiEr,0);
    return`🏥 ESI Summary — March 2026:\n\nEligible (≤₹21K): ${eligible}/${workers.length}\nEmployee (0.75%): ${fmt(ee)}\nEmployer (3.25%): ${fmt(er)}\nTotal: ${fmt(ee+er)}\n\n📅 Due: 15 Apr 2026`;
  }
  if(l.includes("clra")||l.includes("license")||l.includes("compliance")){
    return`📋 Compliance Status:\n\n✅ CLRA License: Valid till 31-Dec-2026\n✅ PF Registration: Active (MHBAN0012345)\n✅ ESI Registration: Active (31-12345-678)\n⏳ Half-yearly Return: Due 30-Jul-2026\n✅ Form A,B,C,D: Digital — up to date\n\n🔔 Next reminder: PF ECR — 15 Apr`;
  }
  if(l.includes("help")||l.includes("kya")||l.includes("madad")){
    return`Main aapki ye madad kar sakta hoon:\n\n📋 "aaj attendance" — Daily haziri log karo\n💰 "tankhwah" — Monthly wage calculation\n🧾 "invoice" — Client bill generate karo\n🏦 "PF" — PF challan details\n🏥 "ESI" — ESI contribution\n📋 "CLRA" — License & compliance\n👷 Worker ka naam — Individual details\n\nHindi ya English mein type karo!`;
  }
  const found=workers.find(w=>l.includes(w.name.split(" ")[0].toLowerCase()));
  if(found){
    const i=workers.indexOf(found);
    const wg=wages[i];
    return`👷 ${found.name} (${found.role}):\nSite: ${found.site}\nDaily: ${fmt(found.wage)}\nUAN: ${found.uan}\n\nMarch 2026:\nPresent: ${wg.pr} | Absent: ${wg.ab} | HD: ${wg.hd} | OT: ${wg.ot}\nGross: ${fmt(wg.gross)}\nPF: -${fmt(wg.pfEe)} | ESI: -${fmt(wg.esiEe)}\nNet Pay: ${fmt(wg.net)}`;
  }
  return`Samajh gaya! Aap "${input}" ke baare mein pooch rahe hain.\n\nTry karo:\n• "aaj attendance" — haziri\n• "tankhwah" — wages\n• "invoice" — bill\n• "PF" / "ESI"\n• "help" — sab commands\n• Worker ka naam (e.g. "Ramesh")`;
}

// ── STYLES ──
const S={
  bg:"#0a0e14",card:"#141b27",card2:"#1a2435",accent:"#10b981",accentDim:"#059669",
  text:"#e2e8f0",dim:"#64748b",border:"#1e293b",danger:"#ef4444",warn:"#f59e0b",
  info:"#3b82f6",input:"#0c1220",white:"#fff",
};

const css=`
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:${S.bg};color:${S.text};font-family:'DM Sans',sans-serif;overflow:hidden;}
  ::-webkit-scrollbar{width:5px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:${S.border};border-radius:4px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  .fade-up{animation:fadeUp .3s ease}
  .typing{animation:pulse 1s infinite}
  input,textarea{font-family:inherit;}
`;

// ── COMPONENTS ──
function Badge({status}){
  const m={P:{bg:"#052e1680",c:"#10b981",l:"P"},A:{bg:"#3b111180",c:"#ef4444",l:"A"},HD:{bg:"#3b280e80",c:"#f59e0b",l:"½"},OT:{bg:"#0e1f3b80",c:"#3b82f6",l:"OT"},WO:{bg:"#1a1a2e60",c:"#475569",l:"W"}};
  const s=m[status]||m.A;
  return <div style={{width:30,height:30,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:s.bg,color:s.c,fontSize:11,fontWeight:600,fontFamily:"'DM Mono',monospace",userSelect:"none"}}>{s.l}</div>;
}

function Stat({label,value,sub,color,icon}){
  return <div className="fade-up" style={{background:S.card,borderRadius:14,padding:"18px 22px",border:`1px solid ${S.border}`,flex:1,minWidth:155}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <span style={{fontSize:11,color:S.dim,textTransform:"uppercase",letterSpacing:1.2,fontFamily:"'DM Mono',monospace"}}>{label}</span>
      {icon&&<span style={{fontSize:16}}>{icon}</span>}
    </div>
    <div style={{fontSize:28,fontWeight:700,color:color||S.text,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:S.dim,marginTop:6}}>{sub}</div>}
  </div>;
}

// ── MAIN APP ──
export default function App(){
  const[tab,setTab]=useState("dashboard");
  const[att,setAtt]=useState(()=>seedAtt(WORKERS,3,2026));
  const[msgs,setMsgs]=useState([{from:"bot",text:"🙏 Namaste! Main Thekedar AI hoon — aapka contractor assistant.\n\nAap mujhe attendance, tankhwah, invoice, PF/ESI ke baare mein pooch sakte hain.\n\nType karo 'help' for all commands.",time:"9:00 AM"}]);
  const[chatIn,setChatIn]=useState("");
  const[typing,setTyping]=useState(false);
  const[site,setSite]=useState("All");
  const chatEnd=useRef(null);

  const wages=WORKERS.map(w=>calcWage(w,att[w.id]||{},3,2026));
  const filtered=site==="All"?WORKERS:WORKERS.filter(w=>w.site===site);
  const filtIdx=filtered.map(w=>WORKERS.indexOf(w));
  const fWages=filtIdx.map(i=>wages[i]);

  const tGross=fWages.reduce((s,w)=>s+w.gross,0);
  const tNet=fWages.reduce((s,w)=>s+w.net,0);
  const tPfEe=fWages.reduce((s,w)=>s+w.pfEe,0);
  const tPfEr=fWages.reduce((s,w)=>s+w.pfEr,0);
  const tEsiEe=fWages.reduce((s,w)=>s+w.esiEe,0);
  const tEsiEr=fWages.reduce((s,w)=>s+w.esiEr,0);
  const svcCharge=Math.round(tGross*0.10);
  const invTotal=tGross+tPfEr+tEsiEr+svcCharge;

  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send=()=>{
    if(!chatIn.trim())return;
    const now=new Date();const t=now.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
    setMsgs(p=>[...p,{from:"user",text:chatIn.trim(),time:t}]);
    const input=chatIn.trim();setChatIn("");setTyping(true);
    setTimeout(()=>{
      const resp=chatResponse(input,wages,WORKERS);
      setMsgs(p=>[...p,{from:"bot",text:resp,time:new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}]);
      setTyping(false);
    },800+Math.random()*600);
  };

  const toggleAtt=(wid,d)=>{
    setAtt(p=>{
      const c=p[wid]?.[d];if(c==="WO")return p;
      const cyc=["P","A","HD","OT"];
      return{...p,[wid]:{...p[wid],[d]:cyc[(cyc.indexOf(c)+1)%cyc.length]}};
    });
  };

  const daysInMonth=31;
  const tabs=[
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"chat",icon:"💬",label:"AI Chat"},
    {id:"attendance",icon:"📋",label:"Attendance"},
    {id:"wages",icon:"💰",label:"Wages"},
    {id:"invoice",icon:"🧾",label:"Invoice"},
    {id:"workers",icon:"👷",label:"Workers"},
    {id:"compliance",icon:"🛡️",label:"Compliance"},
  ];

  return <div style={{height:"100vh",display:"flex",background:S.bg}}>
    <style>{css}</style>

    {/* ── SIDEBAR ── */}
    <div style={{width:220,background:S.card,borderRight:`1px solid ${S.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{padding:"20px 18px",borderBottom:`1px solid ${S.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,${S.accent},${S.accentDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚡</div>
          <div>
            <div style={{fontSize:15,fontWeight:700,fontFamily:"'DM Mono',monospace",letterSpacing:1.5,color:S.accent}}>THEKEDAR AI</div>
            <div style={{fontSize:9,color:S.dim,letterSpacing:2,textTransform:"uppercase"}}>ARQ ONE AI LABS</div>
          </div>
        </div>
      </div>

      <div style={{padding:"12px 10px",flex:1}}>
        {tabs.map(t=><div key={t.id} onClick={()=>setTab(t.id)} style={{
          display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,
          cursor:"pointer",marginBottom:2,transition:"all .15s",
          background:tab===t.id?`${S.accent}18`:"transparent",
          color:tab===t.id?S.accent:S.dim,fontWeight:tab===t.id?600:400,fontSize:13,
        }}>
          <span style={{fontSize:15}}>{t.icon}</span>{t.label}
        </div>)}
      </div>

      <div style={{padding:"14px 18px",borderTop:`1px solid ${S.border}`,fontSize:11,color:S.dim}}>
        <div style={{marginBottom:4}}>📅 March 2026</div>
        <div>{WORKERS.length} Workers • 2 Sites</div>
        <div style={{marginTop:8,padding:"6px 10px",background:S.accent+"20",borderRadius:6,color:S.accent,fontSize:10,fontWeight:600,textAlign:"center"}}>SIMULATION MODE</div>
      </div>
    </div>

    {/* ── MAIN CONTENT ── */}
    <div style={{flex:1,overflow:"auto",padding:0}}>

      {/* Site filter bar */}
      <div style={{padding:"12px 28px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:S.card+"80"}}>
        <div style={{display:"flex",gap:6}}>
          {["All",...SITES].map(s=><button key={s} onClick={()=>setSite(s)} style={{
            padding:"6px 14px",borderRadius:8,border:`1px solid ${site===s?S.accent:S.border}`,
            background:site===s?S.accent+"20":"transparent",color:site===s?S.accent:S.dim,
            fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans'"
          }}>{s} {s==="All"?`(${WORKERS.length})`:`(${WORKERS.filter(w=>w.site===s).length})`}</button>)}
        </div>
        <div style={{fontSize:12,color:S.dim,fontFamily:"'DM Mono',monospace"}}>
          15 Mar 2026, Sunday
        </div>
      </div>

      <div style={{padding:28}}>

      {/* ── DASHBOARD ── */}
      {tab==="dashboard"&&<div>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:24}}>
          <Stat label="Workers" value={filtered.length} icon="👷" sub={`${SITES.length} sites`}/>
          <Stat label="Gross Wages" value={`₹${Math.round(tGross/1000)}K`} color={S.accent} icon="💰" sub="March 2026"/>
          <Stat label="Net Payable" value={`₹${Math.round(tNet/1000)}K`} icon="📤" sub="After deductions"/>
          <Stat label="Invoice Total" value={`₹${Math.round(invTotal*1.18/1000)}K`} color={S.warn} icon="🧾" sub="Incl. GST"/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {/* Compliance */}
          <div style={{background:S.card,borderRadius:14,padding:22,border:`1px solid ${S.border}`}}>
            <div style={{fontSize:13,fontWeight:600,color:S.accent,marginBottom:16,fontFamily:"'DM Mono',monospace"}}>⚡ STATUTORY COMPLIANCE</div>
            {[
              {l:"PF ECR Filing",d:"15 Apr 2026",s:"pending",a:fmt(tPfEe+tPfEr)},
              {l:"ESI Challan",d:"15 Apr 2026",s:"pending",a:fmt(tEsiEe+tEsiEr)},
              {l:"Wage Payment",d:"7 Apr 2026",s:"pending",a:fmt(tNet)},
              {l:"CLRA Form XXIV",d:"30 Jul 2026",s:"ok",a:"Half-yearly"},
              {l:"CLRA License Renewal",d:"31 Dec 2026",s:"ok",a:"Annual"},
            ].map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:S.input,borderRadius:10,marginBottom:6,fontSize:12}}>
              <div><div style={{fontWeight:600}}>{x.l}</div><div style={{color:S.dim,fontSize:11}}>Due: {x.d}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontFamily:"'DM Mono',monospace",fontWeight:600}}>{x.a}</div>
              <div style={{color:x.s==="ok"?S.accent:S.warn,fontSize:10,fontWeight:700}}>{x.s==="ok"?"✅ ON TRACK":"⏳ PENDING"}</div></div>
            </div>)}
          </div>

          {/* Worker attendance bars */}
          <div style={{background:S.card,borderRadius:14,padding:22,border:`1px solid ${S.border}`}}>
            <div style={{fontSize:13,fontWeight:600,color:S.accent,marginBottom:16,fontFamily:"'DM Mono',monospace"}}>👷 ATTENDANCE OVERVIEW</div>
            {filtered.map((w,i)=>{
              const wg=fWages[i];const workDays=daysInMonth-wg.wo;const pct=Math.round((wg.pr/workDays)*100);
              return <div key={w.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,fontSize:12}}>
                <div style={{width:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{w.name.split(" ")[0]}</div>
                <div style={{flex:1,height:8,background:S.input,borderRadius:4}}>
                  <div style={{height:"100%",borderRadius:4,width:`${pct}%`,background:pct>80?S.accent:pct>60?S.warn:S.danger,transition:"width .5s"}}/>
                </div>
                <div style={{width:38,textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:600,color:pct>80?S.accent:pct>60?S.warn:S.danger}}>{pct}%</div>
              </div>;
            })}
          </div>
        </div>

        {/* Site-wise summary */}
        <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {SITES.map(s=>{
            const sw=WORKERS.filter(w=>w.site===s);
            const si=sw.map(w=>WORKERS.indexOf(w));
            const swg=si.map(i=>wages[i]);
            const sg=swg.reduce((a,w)=>a+w.gross,0);
            return <div key={s} style={{background:S.card,borderRadius:14,padding:22,border:`1px solid ${S.border}`}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>{s}</div>
              <div style={{display:"flex",gap:20,fontSize:12,color:S.dim}}>
                <div><span style={{color:S.text,fontWeight:600,fontSize:18,fontFamily:"'DM Mono'"}}>{sw.length}</span> workers</div>
                <div><span style={{color:S.accent,fontWeight:600,fontSize:18,fontFamily:"'DM Mono'"}}>{fmt(sg)}</span> gross</div>
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* ── CHAT ── */}
      {tab==="chat"&&<div style={{maxWidth:560,margin:"0 auto"}}>
        <div style={{background:S.card,borderRadius:16,border:`1px solid ${S.border}`,overflow:"hidden",display:"flex",flexDirection:"column",height:"calc(100vh - 160px)"}}>
          {/* Chat header */}
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:10,background:S.card2}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${S.accent},${S.accentDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⚡</div>
            <div>
              <div style={{fontSize:14,fontWeight:600}}>Thekedar AI</div>
              <div style={{fontSize:11,color:S.accent}}>● Online — Hindi / English</div>
            </div>
            <div style={{marginLeft:"auto",fontSize:10,color:S.dim,background:S.input,padding:"4px 10px",borderRadius:20}}>WhatsApp Simulation</div>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflow:"auto",padding:16,display:"flex",flexDirection:"column",gap:8,background:`${S.bg}cc`}}>
            {msgs.map((m,i)=><div key={i} className="fade-up" style={{display:"flex",justifyContent:m.from==="user"?"flex-end":"flex-start",maxWidth:"85%",alignSelf:m.from==="user"?"flex-end":"flex-start"}}>
              <div style={{padding:"10px 14px",borderRadius:14,background:m.from==="user"?S.accent:S.card2,
                color:m.from==="user"?"#000":S.text,fontSize:13,whiteSpace:"pre-wrap",lineHeight:1.6,
                borderBottomRightRadius:m.from==="user"?4:14,borderBottomLeftRadius:m.from==="bot"?4:14,
                boxShadow:"0 1px 3px #0004",position:"relative"}}>
                {m.text}
                <div style={{fontSize:9,color:m.from==="user"?"#0006":S.dim,marginTop:4,textAlign:"right"}}>{m.time}</div>
              </div>
            </div>)}
            {typing&&<div className="fade-up" style={{display:"flex"}}><div style={{padding:"10px 14px",borderRadius:14,borderBottomLeftRadius:4,background:S.card2,fontSize:13}}>
              <span className="typing" style={{color:S.dim}}>typing...</span>
            </div></div>}
            <div ref={chatEnd}/>
          </div>

          {/* Input */}
          <div style={{padding:12,borderTop:`1px solid ${S.border}`,display:"flex",gap:8,background:S.card}}>
            <input value={chatIn} onChange={e=>setChatIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
              placeholder='Type karo... (try: "aaj attendance", "tankhwah", "invoice", "help")'
              style={{flex:1,padding:"11px 16px",background:S.input,border:`1px solid ${S.border}`,borderRadius:24,color:S.text,fontSize:13,outline:"none"}}/>
            <button onClick={send} style={{padding:"10px 22px",background:S.accent,color:"#000",border:"none",borderRadius:24,fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"'DM Sans'"}}>Send</button>
          </div>
        </div>
      </div>}

      {/* ── ATTENDANCE ── */}
      {tab==="attendance"&&<div style={{overflowX:"auto"}}>
        <div style={{fontSize:12,color:S.dim,marginBottom:14}}>Click cells to toggle: P → A → ½ → OT. Sundays auto-locked as Week Off.</div>
        <div style={{minWidth:1100}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}>
            <thead><tr>
              <th style={{padding:"8px 10px",textAlign:"left",color:S.dim,borderBottom:`2px solid ${S.accent}`,position:"sticky",left:0,background:S.bg,zIndex:2,minWidth:150,fontFamily:"'DM Mono',monospace",fontSize:10}}>WORKER</th>
              {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                const dow=new Date(2026,2,d).getDay();
                return <th key={d} style={{padding:"4px 1px",textAlign:"center",color:dow===0?"#ef444480":S.dim,borderBottom:`2px solid ${S.accent}`,fontFamily:"'DM Mono',monospace",fontSize:10,minWidth:34}}>{d}</th>;
              })}
              <th style={{padding:"8px",textAlign:"center",color:S.accent,borderBottom:`2px solid ${S.accent}`,fontFamily:"'DM Mono'",fontSize:10}}>EFF</th>
            </tr></thead>
            <tbody>
              {filtered.map((w,wi)=>{
                const wg=fWages[wi];
                return <tr key={w.id}><td style={{padding:"6px 10px",borderBottom:`1px solid ${S.border}22`,position:"sticky",left:0,background:S.bg,zIndex:1}}>
                  <div style={{fontWeight:600,fontSize:12}}>{w.name}</div>
                  <div style={{color:S.dim,fontSize:10}}>{w.role} • {fmt(w.wage)}/day</div>
                </td>
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=><td key={d} style={{padding:"2px 1px",textAlign:"center",borderBottom:`1px solid ${S.border}22`,cursor:"pointer"}} onClick={()=>toggleAtt(w.id,d)}>
                  <Badge status={att[w.id]?.[d]||"A"}/>
                </td>)}
                <td style={{padding:"6px",textAlign:"center",fontFamily:"'DM Mono'",fontWeight:700,color:S.accent,borderBottom:`1px solid ${S.border}22`}}>{wg.eff}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div style={{display:"flex",gap:18,marginTop:16,fontSize:12,color:S.dim,alignItems:"center"}}>
          {[["P","Present"],["A","Absent"],["HD","Half Day"],["OT","Overtime"],["WO","Week Off"]].map(([s,l])=>
            <span key={s} style={{display:"flex",alignItems:"center",gap:6}}><Badge status={s}/>{l}</span>)}
        </div>
      </div>}

      {/* ── WAGES ── */}
      {tab==="wages"&&<div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"100%",fontSize:12}}>
          <thead><tr>{["Worker","Site","Days","Basic","OT","Gross","PF","ESI","Net Pay"].map((h,i)=>
            <th key={i} style={{padding:"10px 12px",textAlign:i<2?"left":"right",color:S.dim,borderBottom:`2px solid ${S.accent}`,fontFamily:"'DM Mono'",fontSize:10,letterSpacing:1}}>{h}</th>
          )}</tr></thead>
          <tbody>
            {filtered.map((w,i)=>{
              const wg=fWages[i];
              return <tr key={w.id} style={{background:i%2===0?"transparent":`${S.card}44`}}>
                <td style={{padding:"10px 12px",borderBottom:`1px solid ${S.border}33`}}>
                  <div style={{fontWeight:600}}>{w.name}</div>
                  <div style={{fontSize:10,color:S.dim}}>{w.role} • {fmt(w.wage)}/day</div>
                </td>
                <td style={{padding:"10px 12px",fontSize:11,color:S.dim,borderBottom:`1px solid ${S.border}33`}}>{w.site}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontFamily:"'DM Mono'",borderBottom:`1px solid ${S.border}33`}}>
                  <span style={{color:S.accent}}>{wg.pr}P</span>/<span style={{color:S.danger}}>{wg.ab}A</span>/<span style={{color:S.warn}}>{wg.hd}H</span>/<span style={{color:S.info}}>{wg.ot}O</span>
                </td>
                <td style={{padding:"10px 12px",textAlign:"right",fontFamily:"'DM Mono'",borderBottom:`1px solid ${S.border}33`}}>{fmt(wg.basic)}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontFamily:"'DM Mono'",color:wg.otPay?S.info:S.dim,borderBottom:`1px solid ${S.border}33`}}>{fmt(wg.otPay)}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:600,borderBottom:`1px solid ${S.border}33`}}>{fmt(wg.gross)}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontFamily:"'DM Mono'",color:S.dim,borderBottom:`1px solid ${S.border}33`}}>-{fmt(wg.pfEe)}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontFamily:"'DM Mono'",color:S.dim,borderBottom:`1px solid ${S.border}33`}}>-{fmt(wg.esiEe)}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:700,color:S.accent,borderBottom:`1px solid ${S.border}33`}}>{fmt(wg.net)}</td>
              </tr>;
            })}
            <tr style={{background:S.card}}>
              <td colSpan={3} style={{padding:"12px",fontWeight:700,borderTop:`2px solid ${S.accent}`}}>TOTAL ({filtered.length} workers)</td>
              <td style={{padding:"12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:600,borderTop:`2px solid ${S.accent}`}}>{fmt(fWages.reduce((s,w)=>s+w.basic,0))}</td>
              <td style={{padding:"12px",textAlign:"right",fontFamily:"'DM Mono'",borderTop:`2px solid ${S.accent}`,color:S.info}}>{fmt(fWages.reduce((s,w)=>s+w.otPay,0))}</td>
              <td style={{padding:"12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:700,borderTop:`2px solid ${S.accent}`}}>{fmt(tGross)}</td>
              <td style={{padding:"12px",textAlign:"right",fontFamily:"'DM Mono'",borderTop:`2px solid ${S.accent}`}}>-{fmt(tPfEe)}</td>
              <td style={{padding:"12px",textAlign:"right",fontFamily:"'DM Mono'",borderTop:`2px solid ${S.accent}`}}>-{fmt(tEsiEe)}</td>
              <td style={{padding:"12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:700,color:S.accent,fontSize:14,borderTop:`2px solid ${S.accent}`}}>{fmt(tNet)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{marginTop:20,display:"flex",gap:14}}>
          <div style={{background:S.card,borderRadius:12,padding:18,border:`1px solid ${S.border}`,flex:1}}>
            <div style={{fontSize:11,color:S.dim,fontFamily:"'DM Mono'",letterSpacing:1,marginBottom:6}}>PF SUMMARY</div>
            <div style={{fontSize:12}}>Employee (12%): <b style={{fontFamily:"'DM Mono'"}}>{fmt(tPfEe)}</b></div>
            <div style={{fontSize:12}}>Employer (12%): <b style={{fontFamily:"'DM Mono'"}}>{fmt(tPfEr)}</b></div>
            <div style={{fontSize:12,marginTop:4,color:S.accent}}>Total deposit: <b style={{fontFamily:"'DM Mono'"}}>{fmt(tPfEe+tPfEr)}</b></div>
          </div>
          <div style={{background:S.card,borderRadius:12,padding:18,border:`1px solid ${S.border}`,flex:1}}>
            <div style={{fontSize:11,color:S.dim,fontFamily:"'DM Mono'",letterSpacing:1,marginBottom:6}}>ESI SUMMARY</div>
            <div style={{fontSize:12}}>Employee (0.75%): <b style={{fontFamily:"'DM Mono'"}}>{fmt(tEsiEe)}</b></div>
            <div style={{fontSize:12}}>Employer (3.25%): <b style={{fontFamily:"'DM Mono'"}}>{fmt(tEsiEr)}</b></div>
            <div style={{fontSize:12,marginTop:4,color:S.accent}}>Total deposit: <b style={{fontFamily:"'DM Mono'"}}>{fmt(tEsiEe+tEsiEr)}</b></div>
          </div>
        </div>
      </div>}

      {/* ── INVOICE ── */}
      {tab==="invoice"&&<div style={{maxWidth:580,margin:"0 auto"}}>
        <div style={{background:S.card,borderRadius:16,padding:36,border:`1px solid ${S.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:28}}>
            <div>
              <div style={{fontSize:10,color:S.dim,letterSpacing:2,textTransform:"uppercase"}}>Tax Invoice</div>
              <div style={{fontSize:22,fontWeight:700,fontFamily:"'DM Mono'",marginTop:4}}>INV/MAR/2026/001</div>
              <div style={{fontSize:12,color:S.dim,marginTop:4}}>Date: 31-Mar-2026 | Due: 15-Apr-2026</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:600,color:S.accent}}>YOUR COMPANY NAME</div>
              <div style={{fontSize:11,color:S.dim}}>GSTIN: 24XXXXX1234X1Z5</div>
              <div style={{fontSize:11,color:S.dim}}>CLRA: XX/2024/XXXX</div>
            </div>
          </div>

          <div style={{borderTop:`1px solid ${S.border}`,borderBottom:`1px solid ${S.border}`,padding:"14px 0",marginBottom:24}}>
            <div style={{fontSize:10,color:S.dim,letterSpacing:1}}>BILL TO</div>
            <div style={{fontWeight:600,fontSize:14,marginTop:4}}>{site==="All"?"M/s. Client Factory Pvt. Ltd.":`M/s. ${site}`}</div>
            <div style={{fontSize:12,color:S.dim}}>GIDC Industrial Estate, Achhad, Talasari</div>
          </div>

          <div style={{fontSize:12,color:S.dim,marginBottom:14}}>Period: 1-Mar-2026 to 31-Mar-2026 | Workers: {filtered.length} | Sites: {site==="All"?SITES.join(", "):site}</div>

          {[
            {l:"Gross Wages (per muster roll)",v:tGross},
            {l:`PF Employer (12% on ₹15K cap) — ${filtered.length} workers`,v:tPfEr},
            {l:"ESI Employer (3.25% on eligible workers)",v:tEsiEr},
            {l:"Service Charge (10% on Gross)",v:svcCharge},
          ].map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${S.border}33`,fontSize:13}}>
            <span style={{color:S.dim}}>{x.l}</span>
            <span style={{fontFamily:"'DM Mono'",fontWeight:500}}>{fmt(x.v)}</span>
          </div>)}

          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontSize:13,borderBottom:`1px solid ${S.border}33`}}>
            <span style={{fontWeight:600}}>Sub-Total</span>
            <span style={{fontFamily:"'DM Mono'",fontWeight:600}}>{fmt(invTotal)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontSize:13,borderBottom:`1px solid ${S.border}33`}}>
            <span style={{color:S.dim}}>CGST @9%</span>
            <span style={{fontFamily:"'DM Mono'"}}>{fmt(Math.round(invTotal*0.09))}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontSize:13,borderBottom:`1px solid ${S.border}33`}}>
            <span style={{color:S.dim}}>SGST @9%</span>
            <span style={{fontFamily:"'DM Mono'"}}>{fmt(Math.round(invTotal*0.09))}</span>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",padding:"18px 0",marginTop:8,borderTop:`2px solid ${S.accent}`}}>
            <span style={{fontWeight:700,fontSize:16}}>TOTAL PAYABLE</span>
            <span style={{fontFamily:"'DM Mono'",fontWeight:700,color:S.accent,fontSize:24}}>{fmt(Math.round(invTotal*1.18))}</span>
          </div>

          <div style={{marginTop:20,padding:14,background:S.input,borderRadius:10,fontSize:11,color:S.dim}}>
            <b style={{color:S.text}}>Attachments:</b> Muster Roll, PF ECR Copy, ESI Challan Copy, Worker-wise Wage Sheet, Bank Transfer Proof
          </div>

          <div style={{marginTop:16,display:"flex",gap:10}}>
            <button onClick={()=>alert("📄 Invoice PDF generation queued!\n\nIn production, this downloads a signed PDF with muster roll attached.")} style={{flex:1,padding:"12px",background:S.accent,color:"#000",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans'",fontSize:13}}>📄 Download PDF</button>
            <button onClick={()=>alert("📎 WhatsApp message drafted!\n\nIn production, this sends the invoice link to the client via WhatsApp Business API.")} style={{flex:1,padding:"12px",background:"transparent",color:S.accent,border:`1px solid ${S.accent}`,borderRadius:10,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans'",fontSize:13}}>📎 Send via WhatsApp</button>
          </div>
        </div>
      </div>}

      {/* ── WORKERS ── */}
      {tab==="workers"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:14}}>
          {filtered.map((w,i)=>{
            const wg=fWages[i];const pct=Math.round(wg.pr/(daysInMonth-wg.wo)*100);
            return <div key={w.id} className="fade-up" style={{background:S.card,borderRadius:14,padding:20,border:`1px solid ${S.border}`,transition:"border-color .2s",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor=S.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=S.border}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:42,height:42,borderRadius:"50%",background:`${S.accent}20`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:S.accent}}>{w.name.split(" ").map(n=>n[0]).join("")}</div>
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>{w.name}</div>
                  <div style={{fontSize:11,color:S.dim}}>{w.role} • {w.site}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11}}>
                <div style={{background:S.input,padding:"8px 10px",borderRadius:8}}>
                  <div style={{color:S.dim}}>Daily Wage</div><div style={{fontWeight:600,fontFamily:"'DM Mono'"}}>{fmt(w.wage)}</div>
                </div>
                <div style={{background:S.input,padding:"8px 10px",borderRadius:8}}>
                  <div style={{color:S.dim}}>Attendance</div><div style={{fontWeight:600,fontFamily:"'DM Mono'",color:pct>80?S.accent:pct>60?S.warn:S.danger}}>{pct}%</div>
                </div>
                <div style={{background:S.input,padding:"8px 10px",borderRadius:8}}>
                  <div style={{color:S.dim}}>Gross</div><div style={{fontWeight:600,fontFamily:"'DM Mono'"}}>{fmt(wg.gross)}</div>
                </div>
                <div style={{background:S.input,padding:"8px 10px",borderRadius:8}}>
                  <div style={{color:S.dim}}>Net Pay</div><div style={{fontWeight:600,fontFamily:"'DM Mono'",color:S.accent}}>{fmt(wg.net)}</div>
                </div>
              </div>
              <div style={{marginTop:10,fontSize:10,color:S.dim,fontFamily:"'DM Mono'"}}>UAN: {w.uan} | ESI: {w.esi}</div>
            </div>;
          })}
        </div>
      </div>}

      {/* ── COMPLIANCE ── */}
      {tab==="compliance"&&<div style={{maxWidth:700}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:24}}>
          <Stat label="PF Status" value="Active" color={S.accent} icon="🏦" sub="MHBAN0012345000"/>
          <Stat label="ESI Status" value="Active" color={S.accent} icon="🏥" sub="31-12345-678"/>
          <Stat label="CLRA License" value="Valid" color={S.accent} icon="📋" sub="Till 31-Dec-2026"/>
        </div>

        <div style={{background:S.card,borderRadius:14,padding:24,border:`1px solid ${S.border}`,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:18}}>📅 Compliance Calendar — March to July 2026</div>
          {[
            {d:"7 Apr 2026",t:"Wage Payment",s:"pending",cat:"Payment"},
            {d:"15 Apr 2026",t:"PF ECR Filing + Challan",s:"pending",cat:"PF"},
            {d:"15 Apr 2026",t:"ESI Contribution Challan",s:"pending",cat:"ESI"},
            {d:"7 May 2026",t:"April Wage Payment",s:"upcoming",cat:"Payment"},
            {d:"15 May 2026",t:"April PF ECR Filing",s:"upcoming",cat:"PF"},
            {d:"30 Jul 2026",t:"CLRA Half-Yearly Return (Form XXIV, Jan-Jun)",s:"upcoming",cat:"CLRA"},
          ].map((x,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:S.input,borderRadius:10,marginBottom:6}}>
            <div style={{width:90,fontSize:11,fontWeight:600,fontFamily:"'DM Mono'",color:x.s==="pending"?S.warn:S.dim}}>{x.d}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500}}>{x.t}</div>
              <div style={{fontSize:10,color:S.dim}}>{x.cat}</div>
            </div>
            <div style={{padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:700,
              background:x.s==="pending"?`${S.warn}20`:`${S.dim}20`,
              color:x.s==="pending"?S.warn:S.dim
            }}>{x.s==="pending"?"⏳ PENDING":"📅 UPCOMING"}</div>
          </div>)}
        </div>

        <div style={{background:S.card,borderRadius:14,padding:24,border:`1px solid ${S.border}`}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>📝 Required Registers (CLRA Act)</div>
          {[
            {form:"Form A",desc:"Register of Contractors",status:"✅ Digital"},
            {form:"Form B",desc:"Register of Workers Employed",status:"✅ Digital"},
            {form:"Form C",desc:"Muster Roll",status:"✅ Auto-generated"},
            {form:"Form D",desc:"Register of Wages",status:"✅ Auto-generated"},
            {form:"Form XXIV",desc:"Half-Yearly Return",status:"⏳ Due Jul 2026"},
          ].map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${S.border}33`,fontSize:13}}>
            <div><b>{x.form}</b> — {x.desc}</div>
            <div style={{fontSize:12,color:x.status.includes("✅")?S.accent:S.warn}}>{x.status}</div>
          </div>)}
        </div>
      </div>}

      </div>
    </div>
  </div>;
}
