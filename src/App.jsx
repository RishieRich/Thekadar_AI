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

// ── DESIGN TOKENS ──
const C={
  bg:"#0b0f19",
  surface:"#131929",
  surfaceHigh:"#1c2540",
  border:"#1f2d45",
  borderLight:"#263550",
  accent:"#22d3a5",
  accentDim:"#16a97f",
  accentGlow:"rgba(34,211,165,0.15)",
  amber:"#fbbf24",
  amberGlow:"rgba(251,191,36,0.15)",
  danger:"#f87171",
  info:"#60a5fa",
  text:"#e8edf5",
  textMid:"#94a3b8",
  textDim:"#4a6080",
  white:"#fff",
  inputBg:"#0d1422",
};

const css=`
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{height:100%;overflow:hidden;}
  body{background:${C.bg};color:${C.text};font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px;}
  input,textarea,button{font-family:'DM Sans',sans-serif;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
  .fade-up{animation:fadeUp .35s ease both;}
  .typing{animation:pulse 1.2s infinite;}
  .tab-btn{background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 10px;border-radius:12px;transition:all .2s;color:${C.textDim};flex:1;}
  .tab-btn.active{color:${C.accent};}
  .tab-btn span.icon{font-size:20px;line-height:1;}
  .tab-btn span.lbl{font-size:10px;font-weight:600;letter-spacing:0.3px;}
  .sidebar-btn{display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;border-radius:12px;border:none;background:transparent;cursor:pointer;transition:all .2s;text-align:left;color:${C.textMid};font-size:14px;font-weight:500;}
  .sidebar-btn.active{background:${C.accentGlow};color:${C.accent};font-weight:700;}
  .sidebar-btn:hover:not(.active){background:${C.surfaceHigh};}
  .stat-card{background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:18px;flex:1;min-width:0;animation:fadeUp .35s ease both;}
  .card{background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:20px;}
  .badge-p{background:rgba(34,211,165,.15);color:${C.accent};}
  .badge-a{background:rgba(248,113,113,.15);color:${C.danger};}
  .badge-h{background:rgba(251,191,36,.15);color:${C.amber};}
  .badge-o{background:rgba(96,165,250,.15);color:${C.info};}
  .badge-w{background:rgba(74,96,128,.12);color:${C.textDim};}
  .att-cell{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;cursor:pointer;user-select:none;transition:transform .1s;font-family:'DM Mono',monospace;}
  .att-cell:active{transform:scale(.88);}
  .btn-primary{background:linear-gradient(135deg,${C.accent},${C.accentDim});color:#000;border:none;border-radius:12px;padding:12px 20px;font-weight:700;font-size:14px;cursor:pointer;transition:opacity .2s;}
  .btn-primary:active{opacity:.8;}
  .btn-outline{background:transparent;color:${C.accent};border:1.5px solid ${C.accent};border-radius:12px;padding:12px 20px;font-weight:600;font-size:14px;cursor:pointer;transition:all .2s;}
  .btn-outline:active{background:${C.accentGlow};}
  .chip{display:inline-flex;align-items:center;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid transparent;transition:all .2s;}
  .chip.active{background:${C.accentGlow};border-color:${C.accent};color:${C.accent};}
  .chip.inactive{background:transparent;border-color:${C.border};color:${C.textMid};}
  .chip:active{transform:scale(.95);}
  .menu-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:40;backdrop-filter:blur(4px);}
  .drawer{position:fixed;top:0;left:0;bottom:0;width:260px;background:${C.surface};border-right:1px solid ${C.border};z-index:50;display:flex;flex-direction:column;animation:slideIn .25s ease;}
  @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
  @media(max-width:767px){
    .desktop-sidebar{display:none!important;}
    .mobile-topbar{display:flex!important;}
    .mobile-bottom-nav{display:flex!important;}
    .main-scroll{padding-bottom:90px!important;}
  }
  @media(min-width:768px){
    .desktop-sidebar{display:flex!important;}
    .mobile-topbar{display:none!important;}
    .mobile-bottom-nav{display:none!important;}
    .main-scroll{padding-bottom:24px!important;}
  }
  .main-scroll{overflow-y:auto;flex:1;padding:20px 16px 90px;scrollbar-gutter:stable;}
  @media(min-width:768px){.main-scroll{padding:24px 28px;}}
`;

// ── BADGE ──
function Badge({status,onClick}){
  const m={
    P:{cls:"badge-p",l:"P"},
    A:{cls:"badge-a",l:"A"},
    HD:{cls:"badge-h",l:"½"},
    OT:{cls:"badge-o",l:"OT"},
    WO:{cls:"badge-w",l:"W"},
  };
  const s=m[status]||m.A;
  return <div className={`att-cell ${s.cls}`} onClick={onClick}>{s.l}</div>;
}

// ── STAT CARD ──
function Stat({label,value,sub,color,icon,delay=0}){
  return(
    <div className="stat-card" style={{animationDelay:`${delay*0.08}s`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <span style={{fontSize:11,color:C.textDim,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>{label}</span>
        <span style={{fontSize:20,lineHeight:1}}>{icon}</span>
      </div>
      <div style={{fontSize:26,fontWeight:800,color:color||C.text,fontFamily:"'DM Mono',monospace",lineHeight:1.1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:C.textMid,marginTop:6,fontWeight:500}}>{sub}</div>}
    </div>
  );
}

// ── SECTION TITLE ──
function SectionTitle({icon,title,sub}){
  return(
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
        <span style={{fontSize:18}}>{icon}</span>
        <h2 style={{fontSize:18,fontWeight:800,color:C.text,letterSpacing:.2}}>{title}</h2>
      </div>
      {sub&&<p style={{fontSize:12,color:C.textMid,paddingLeft:26}}>{sub}</p>}
    </div>
  );
}

// ── MAIN APP ──
export default function App(){
  const[tab,setTab]=useState("dashboard");
  const[att,setAtt]=useState(()=>seedAtt(WORKERS,3,2026));
  const[msgs,setMsgs]=useState([{from:"bot",text:"🙏 Namaste! Main Thekedar AI hoon — aapka smart contractor assistant.\n\nAttendance, tankhwah, invoice, PF/ESI — sab kuch yahaan hai!\n\n'help' type karo sab commands dekhne ke liye.",time:"9:00 AM"}]);
  const[chatIn,setChatIn]=useState("");
  const[typing,setTyping]=useState(false);
  const[site,setSite]=useState("All");
  const[menuOpen,setMenuOpen]=useState(false);
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

  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:"smooth"});},[msgs,typing]);

  const sendMsg=(text)=>{
    if(!text.trim())return;
    const now=new Date();
    const t=now.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
    setMsgs(p=>[...p,{from:"user",text:text.trim(),time:t}]);
    setChatIn("");setTyping(true);
    setTimeout(()=>{
      setMsgs(p=>[...p,{from:"bot",text:chatResponse(text.trim(),wages,WORKERS),time:new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}]);
      setTyping(false);
    },700+Math.random()*500);
  };
  const send=()=>sendMsg(chatIn);

  const toggleAtt=(wid,d)=>{
    setAtt(p=>{
      const c=p[wid]?.[d];if(c==="WO")return p;
      const cyc=["P","A","HD","OT"];
      return{...p,[wid]:{...p[wid],[d]:cyc[(cyc.indexOf(c)+1)%cyc.length]}};
    });
  };

  const daysInMonth=31;

  const TABS=[
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"chat",icon:"💬",label:"AI Chat"},
    {id:"attendance",icon:"📋",label:"Haziri"},
    {id:"wages",icon:"💰",label:"Tankhwah"},
    {id:"invoice",icon:"🧾",label:"Invoice"},
    {id:"workers",icon:"👷",label:"Workers"},
    {id:"compliance",icon:"🛡️",label:"Compliance"},
  ];

  const navTabs=TABS.slice(0,5); // bottom nav shows 5

  const Logo=()=>(
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${C.accent},${C.accentDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,boxShadow:`0 4px 14px ${C.accentGlow}`}}>⚡</div>
      <div>
        <div style={{fontSize:15,fontWeight:800,letterSpacing:1.5,color:C.accent,fontFamily:"'DM Mono',monospace"}}>THEKEDAR AI</div>
        <div style={{fontSize:9,color:C.textDim,letterSpacing:2,textTransform:"uppercase",marginTop:1}}>ARQ ONE AI LABS</div>
      </div>
    </div>
  );

  return(
    <div style={{height:"100dvh",display:"flex",background:C.bg,overflow:"hidden",position:"relative"}}>
      <style>{css}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      <div className="desktop-sidebar" style={{width:230,background:C.surface,borderRight:`1px solid ${C.border}`,flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.border}`}}>
          <Logo/>
        </div>
        <div style={{padding:"10px 10px",flex:1,overflow:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} className={`sidebar-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
              <span style={{fontSize:17}}>{t.icon}</span>
              <span>{t.label}</span>
              {t.id==="chat"&&<span style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",background:C.accent,display:"inline-block"}}/>}
            </button>
          ))}
        </div>
        <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`}}>
          <div style={{background:C.surfaceHigh,borderRadius:12,padding:"10px 12px"}}>
            <div style={{fontSize:11,color:C.textMid,marginBottom:3,fontWeight:600}}>📅 March 2026</div>
            <div style={{fontSize:11,color:C.textDim}}>{WORKERS.length} Workers • 2 Sites</div>
            <div style={{marginTop:8,display:"inline-flex",padding:"4px 10px",background:`${C.amber}20`,borderRadius:6,color:C.amber,fontSize:10,fontWeight:700,letterSpacing:.5}}>SIMULATION</div>
          </div>
        </div>
      </div>

      {/* ── MOBILE MENU OVERLAY ── */}
      {menuOpen&&<>
        <div className="menu-overlay" onClick={()=>setMenuOpen(false)}/>
        <div className="drawer">
          <div style={{padding:"20px 18px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <Logo/>
            <button onClick={()=>setMenuOpen(false)} style={{background:"none",border:"none",color:C.textMid,fontSize:22,cursor:"pointer",padding:4}}>✕</button>
          </div>
          <div style={{padding:"10px",flex:1,overflow:"auto"}}>
            {TABS.map(t=>(
              <button key={t.id} className={`sidebar-btn${tab===t.id?" active":""}`} onClick={()=>{setTab(t.id);setMenuOpen(false);}}>
                <span style={{fontSize:18}}>{t.icon}</span>
                <span style={{fontSize:15}}>{t.label}</span>
              </button>
            ))}
          </div>
          <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.textDim,textAlign:"center"}}>March 2026 • {WORKERS.length} Workers • 2 Sites</div>
            <div style={{marginTop:6,textAlign:"center",padding:"4px 10px",background:`${C.amber}20`,borderRadius:6,color:C.amber,fontSize:10,fontWeight:700,display:"inline-block",width:"100%"}}>SIMULATION MODE</div>
          </div>
        </div>
      </>}

      {/* ── MAIN AREA ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>

        {/* ── MOBILE TOP BAR ── */}
        <div className="mobile-topbar" style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:C.surface,alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <button onClick={()=>setMenuOpen(true)} style={{background:C.surfaceHigh,border:"none",color:C.text,width:38,height:38,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16}}>☰</button>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:800,color:C.accent,letterSpacing:1.2,fontFamily:"'DM Mono',monospace"}}>THEKEDAR AI</div>
            <div style={{fontSize:10,color:C.textDim,letterSpacing:.5}}>March 2026</div>
          </div>
          <div style={{width:38,height:38,borderRadius:10,background:C.accentGlow,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚡</div>
        </div>

        {/* ── FILTER BAR ── */}
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,background:`${C.surface}99`,display:"flex",alignItems:"center",gap:8,flexWrap:"nowrap",overflow:"auto",flexShrink:0}}>
          {["All",...SITES].map(s=>(
            <button key={s} className={`chip${site===s?" active":" inactive"}`} onClick={()=>setSite(s)}>
              {s==="All"?`All (${WORKERS.length})`:s==="Tema India"?`🏗️ ${s} (${WORKERS.filter(w=>w.site===s).length})`:`🔧 ${s} (${WORKERS.filter(w=>w.site===s).length})`}
            </button>
          ))}
          <div style={{marginLeft:"auto",fontSize:11,color:C.textDim,whiteSpace:"nowrap",fontFamily:"'DM Mono',monospace",flexShrink:0}}>15 Mar 2026</div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="main-scroll">

          {/* ═══ DASHBOARD ═══ */}
          {tab==="dashboard"&&<div>
            <SectionTitle icon="📊" title="Dashboard" sub="March 2026 overview — sabka summary"/>

            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:20}}>
              <Stat label="Workers" value={filtered.length} icon="👷" sub={`${SITES.length} sites`} delay={0}/>
              <Stat label="Gross Wages" value={`₹${Math.round(tGross/1000)}K`} color={C.accent} icon="💰" sub="March 2026" delay={1}/>
              <Stat label="Net Payable" value={`₹${Math.round(tNet/1000)}K`} icon="📤" sub="After PF & ESI" delay={2}/>
              <Stat label="Invoice Total" value={`₹${Math.round(invTotal*1.18/1000)}K`} color={C.amber} icon="🧾" sub="With GST @18%" delay={3}/>
            </div>

            {/* Compliance */}
            <div className="card fade-up" style={{marginBottom:16,animationDelay:"0.3s"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:16,display:"flex",alignItems:"center",gap:6}}>
                <span>⚡</span> Statutory Compliance
              </div>
              {[
                {l:"PF ECR Filing",d:"15 Apr 2026",s:"pending",a:fmt(tPfEe+tPfEr)},
                {l:"ESI Challan",d:"15 Apr 2026",s:"pending",a:fmt(tEsiEe+tEsiEr)},
                {l:"Wage Payment",d:"7 Apr 2026",s:"pending",a:fmt(tNet)},
                {l:"CLRA Form XXIV",d:"30 Jul 2026",s:"ok",a:"Half-yearly"},
                {l:"CLRA License",d:"31 Dec 2026",s:"ok",a:"Annual"},
              ].map((x,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:C.surfaceHigh,borderRadius:10,marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>{x.l}</div>
                    <div style={{color:C.textDim,fontSize:11,marginTop:1}}>Due: {x.d}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:12}}>{x.a}</div>
                    <div style={{fontSize:10,fontWeight:700,marginTop:2,color:x.s==="ok"?C.accent:C.amber}}>
                      {x.s==="ok"?"✅ ON TRACK":"⏳ PENDING"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Attendance bars */}
            <div className="card fade-up" style={{marginBottom:16,animationDelay:"0.38s"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:16,display:"flex",alignItems:"center",gap:6}}>
                <span>👷</span> Attendance Overview
              </div>
              {filtered.map((w,i)=>{
                const wg=fWages[i];
                const workDays=daysInMonth-wg.wo;
                const pct=Math.round((wg.pr/workDays)*100);
                const barColor=pct>80?C.accent:pct>60?C.amber:C.danger;
                return(
                  <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:`${barColor}20`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:barColor,flexShrink:0}}>{w.name.split(" ").map(n=>n[0]).join("")}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{w.name}</div>
                      <div style={{height:6,background:C.inputBg,borderRadius:4}}>
                        <div style={{height:"100%",borderRadius:4,width:`${pct}%`,background:barColor,transition:"width .6s ease"}}/>
                      </div>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:13,color:barColor,flexShrink:0,minWidth:40,textAlign:"right"}}>{pct}%</div>
                  </div>
                );
              })}
            </div>

            {/* Site summaries */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {SITES.map(s=>{
                const sw=WORKERS.filter(w=>w.site===s);
                const si=sw.map(w=>WORKERS.indexOf(w));
                const swg=si.map(i=>wages[i]);
                const sg=swg.reduce((a,w)=>a+w.gross,0);
                return(
                  <div key={s} className="card fade-up" style={{animationDelay:"0.45s"}}>
                    <div style={{fontSize:11,color:C.textDim,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:.8}}>{s}</div>
                    <div style={{fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:C.accent}}>{fmt(sg)}</div>
                    <div style={{fontSize:11,color:C.textMid,marginTop:4}}>{sw.length} workers • gross</div>
                  </div>
                );
              })}
            </div>
          </div>}

          {/* ═══ AI CHAT ═══ */}
          {tab==="chat"&&(
            <div style={{maxWidth:580,margin:"0 auto",display:"flex",flexDirection:"column",height:"calc(100dvh - 200px)"}}>
              {/* Chat header */}
              <div style={{background:C.surface,borderRadius:"16px 16px 0 0",border:`1px solid ${C.border}`,borderBottom:"none",padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:42,height:42,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},${C.accentDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:`0 4px 12px ${C.accentGlow}`}}>⚡</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700}}>Thekedar AI</div>
                  <div style={{fontSize:11,color:C.accent,display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:7,height:7,borderRadius:"50%",background:C.accent,display:"inline-block"}}/>
                    Online — Hindi / English
                  </div>
                </div>
                <div style={{fontSize:10,color:C.textDim,background:C.surfaceHigh,padding:"4px 10px",borderRadius:20,fontWeight:600}}>AI Assistant</div>
              </div>

              {/* Messages */}
              <div style={{flex:1,overflow:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:10,background:`${C.inputBg}`,border:`1px solid ${C.border}`,borderTop:"none",borderBottom:"none"}}>
                {msgs.map((m,i)=>(
                  <div key={i} className="fade-up" style={{display:"flex",justifyContent:m.from==="user"?"flex-end":"flex-start"}}>
                    <div style={{
                      maxWidth:"82%",padding:"11px 15px",
                      borderRadius:16,
                      borderBottomRightRadius:m.from==="user"?4:16,
                      borderBottomLeftRadius:m.from==="bot"?4:16,
                      background:m.from==="user"?`linear-gradient(135deg,${C.accent},${C.accentDim})`:C.surface,
                      color:m.from==="user"?"#000":C.text,
                      fontSize:13,whiteSpace:"pre-wrap",lineHeight:1.65,
                      border:m.from==="bot"?`1px solid ${C.border}`:"none",
                      boxShadow:`0 2px 8px rgba(0,0,0,0.2)`,
                    }}>
                      {m.text}
                      <div style={{fontSize:9,color:m.from==="user"?"rgba(0,0,0,0.45)":C.textDim,marginTop:5,textAlign:"right"}}>{m.time}</div>
                    </div>
                  </div>
                ))}
                {typing&&(
                  <div className="fade-up" style={{display:"flex",gap:6,alignItems:"center"}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:C.accentGlow,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚡</div>
                    <div style={{padding:"10px 16px",borderRadius:"16px 16px 16px 4px",background:C.surface,border:`1px solid ${C.border}`}}>
                      <span className="typing" style={{color:C.textMid,fontSize:12}}>typing…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEnd}/>
              </div>

              {/* Input */}
              <div style={{padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 16px 16px",display:"flex",gap:8}}>
                <input
                  value={chatIn}
                  onChange={e=>setChatIn(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&send()}
                  placeholder='Type karo… "haziri", "tankhwah", "invoice", "help"'
                  style={{flex:1,padding:"11px 16px",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:24,color:C.text,fontSize:13,outline:"none"}}
                />
                <button onClick={send} className="btn-primary" style={{borderRadius:24,padding:"10px 20px",whiteSpace:"nowrap"}}>Send ➤</button>
              </div>

              {/* Quick prompts */}
              <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                {["aaj attendance","tankhwah","invoice","PF","help"].map(q=>(
                  <button key={q} onClick={()=>sendMsg(q)} style={{fontSize:11,padding:"5px 12px",borderRadius:16,background:C.surfaceHigh,border:`1px solid ${C.border}`,color:C.textMid,cursor:"pointer",fontWeight:600}}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ ATTENDANCE ═══ */}
          {tab==="attendance"&&<div>
            <SectionTitle icon="📋" title="Haziri (Attendance)" sub="Cell tap karke toggle karo: P → A → ½ → OT"/>
            <div style={{overflowX:"auto",borderRadius:14,border:`1px solid ${C.border}`,background:C.surface}}>
              <table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}>
                <thead>
                  <tr>
                    <th style={{padding:"10px 12px",textAlign:"left",color:C.textDim,borderBottom:`2px solid ${C.accent}`,position:"sticky",left:0,background:C.surface,zIndex:2,minWidth:130,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>Worker</th>
                    {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                      const dow=new Date(2026,2,d).getDay();
                      return(
                        <th key={d} style={{padding:"6px 2px",textAlign:"center",color:dow===0?"#f8717140":C.textDim,borderBottom:`2px solid ${C.accent}`,fontFamily:"'DM Mono',monospace",fontSize:10,minWidth:36,fontWeight:600}}>{d}</th>
                      );
                    })}
                    <th style={{padding:"8px",textAlign:"center",color:C.accent,borderBottom:`2px solid ${C.accent}`,fontFamily:"'DM Mono'",fontSize:10,minWidth:40,fontWeight:700}}>EFF</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w,wi)=>{
                    const wg=fWages[wi];
                    return(
                      <tr key={w.id}>
                        <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}33`,position:"sticky",left:0,background:C.surface,zIndex:1}}>
                          <div style={{fontWeight:700,fontSize:12,color:C.text}}>{w.name.split(" ")[0]}</div>
                          <div style={{color:C.textDim,fontSize:10,marginTop:1}}>{w.role}</div>
                        </td>
                        {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>(
                          <td key={d} style={{padding:"3px 2px",textAlign:"center",borderBottom:`1px solid ${C.border}22`}}>
                            <Badge status={att[w.id]?.[d]||"A"} onClick={()=>toggleAtt(w.id,d)}/>
                          </td>
                        ))}
                        <td style={{padding:"8px",textAlign:"center",fontFamily:"'DM Mono'",fontWeight:800,color:C.accent,borderBottom:`1px solid ${C.border}22`,fontSize:13}}>{wg.eff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:16}}>
              {[["P","Present — Haazir"],["A","Absent — Gair Haazir"],["HD","Half Day — Aadha Din"],["OT","Overtime — Extra Waqt"],["WO","Week Off — Chutti"]].map(([s,l])=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.textMid}}>
                  <Badge status={s}/>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>}

          {/* ═══ WAGES ═══ */}
          {tab==="wages"&&<div>
            <SectionTitle icon="💰" title="Tankhwah (Wages)" sub="March 2026 — complete wage breakdown"/>

            <div style={{overflowX:"auto",borderRadius:14,border:`1px solid ${C.border}`,background:C.surface,marginBottom:16}}>
              <table style={{borderCollapse:"collapse",width:"100%",fontSize:12}}>
                <thead>
                  <tr>
                    {["Worker","Site","Days P/A/H/O","Basic","OT","Gross","PF","ESI","Net Pay"].map((h,i)=>(
                      <th key={i} style={{padding:"11px 12px",textAlign:i<2?"left":"right",color:C.textDim,borderBottom:`2px solid ${C.accent}`,fontFamily:"'DM Mono'",fontSize:10,letterSpacing:.8,textTransform:"uppercase",whiteSpace:"nowrap",fontWeight:700}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w,i)=>{
                    const wg=fWages[i];
                    return(
                      <tr key={w.id} style={{background:i%2===0?"transparent":`${C.surfaceHigh}60`}}>
                        <td style={{padding:"11px 12px",borderBottom:`1px solid ${C.border}33`}}>
                          <div style={{fontWeight:700,fontSize:13}}>{w.name}</div>
                          <div style={{fontSize:10,color:C.textDim,marginTop:1}}>{w.role} • {fmt(w.wage)}/day</div>
                        </td>
                        <td style={{padding:"11px 12px",fontSize:11,color:C.textMid,borderBottom:`1px solid ${C.border}33`,whiteSpace:"nowrap"}}>{w.site}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontFamily:"'DM Mono'",borderBottom:`1px solid ${C.border}33`,whiteSpace:"nowrap"}}>
                          <span style={{color:C.accent}}>{wg.pr}P</span>/<span style={{color:C.danger}}>{wg.ab}A</span>/<span style={{color:C.amber}}>{wg.hd}H</span>/<span style={{color:C.info}}>{wg.ot}O</span>
                        </td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontFamily:"'DM Mono'",borderBottom:`1px solid ${C.border}33`}}>{fmt(wg.basic)}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontFamily:"'DM Mono'",color:wg.otPay?C.info:C.textDim,borderBottom:`1px solid ${C.border}33`}}>{fmt(wg.otPay)}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:700,borderBottom:`1px solid ${C.border}33`}}>{fmt(wg.gross)}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontFamily:"'DM Mono'",color:C.textMid,borderBottom:`1px solid ${C.border}33`}}>-{fmt(wg.pfEe)}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontFamily:"'DM Mono'",color:C.textMid,borderBottom:`1px solid ${C.border}33`}}>-{fmt(wg.esiEe)}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:800,color:C.accent,borderBottom:`1px solid ${C.border}33`,fontSize:13}}>{fmt(wg.net)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{background:C.surfaceHigh}}>
                    <td colSpan={3} style={{padding:"13px 12px",fontWeight:800,fontSize:13,borderTop:`2px solid ${C.accent}`}}>TOTAL — {filtered.length} Workers</td>
                    <td style={{padding:"13px 12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:700,borderTop:`2px solid ${C.accent}`}}>{fmt(fWages.reduce((s,w)=>s+w.basic,0))}</td>
                    <td style={{padding:"13px 12px",textAlign:"right",fontFamily:"'DM Mono'",borderTop:`2px solid ${C.accent}`,color:C.info}}>{fmt(fWages.reduce((s,w)=>s+w.otPay,0))}</td>
                    <td style={{padding:"13px 12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:800,borderTop:`2px solid ${C.accent}`}}>{fmt(tGross)}</td>
                    <td style={{padding:"13px 12px",textAlign:"right",fontFamily:"'DM Mono'",borderTop:`2px solid ${C.accent}`}}>-{fmt(tPfEe)}</td>
                    <td style={{padding:"13px 12px",textAlign:"right",fontFamily:"'DM Mono'",borderTop:`2px solid ${C.accent}`}}>-{fmt(tEsiEe)}</td>
                    <td style={{padding:"13px 12px",textAlign:"right",fontFamily:"'DM Mono'",fontWeight:800,color:C.accent,fontSize:15,borderTop:`2px solid ${C.accent}`}}>{fmt(tNet)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div className="card">
                <div style={{fontSize:11,color:C.textDim,fontFamily:"'DM Mono'",letterSpacing:1,marginBottom:10,fontWeight:700}}>🏦 PF SUMMARY</div>
                <div style={{fontSize:12,marginBottom:4}}>Employee (12%): <b style={{fontFamily:"'DM Mono'",color:C.text}}>{fmt(tPfEe)}</b></div>
                <div style={{fontSize:12,marginBottom:8}}>Employer (12%): <b style={{fontFamily:"'DM Mono'",color:C.text}}>{fmt(tPfEr)}</b></div>
                <div style={{fontSize:13,color:C.accent,fontWeight:700,fontFamily:"'DM Mono'",borderTop:`1px solid ${C.border}`,paddingTop:8}}>Total: {fmt(tPfEe+tPfEr)}</div>
              </div>
              <div className="card">
                <div style={{fontSize:11,color:C.textDim,fontFamily:"'DM Mono'",letterSpacing:1,marginBottom:10,fontWeight:700}}>🏥 ESI SUMMARY</div>
                <div style={{fontSize:12,marginBottom:4}}>Employee (0.75%): <b style={{fontFamily:"'DM Mono'",color:C.text}}>{fmt(tEsiEe)}</b></div>
                <div style={{fontSize:12,marginBottom:8}}>Employer (3.25%): <b style={{fontFamily:"'DM Mono'",color:C.text}}>{fmt(tEsiEr)}</b></div>
                <div style={{fontSize:13,color:C.accent,fontWeight:700,fontFamily:"'DM Mono'",borderTop:`1px solid ${C.border}`,paddingTop:8}}>Total: {fmt(tEsiEe+tEsiEr)}</div>
              </div>
            </div>
          </div>}

          {/* ═══ INVOICE ═══ */}
          {tab==="invoice"&&(
            <div style={{maxWidth:600,margin:"0 auto"}}>
              <SectionTitle icon="🧾" title="Invoice / Bill" sub="Client ko bhejne ke liye taiyaar bill"/>
              <div className="card fade-up">
                {/* Invoice header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{fontSize:10,color:C.textDim,letterSpacing:2,textTransform:"uppercase",fontWeight:700}}>Tax Invoice</div>
                    <div style={{fontSize:20,fontWeight:800,fontFamily:"'DM Mono'",marginTop:4,color:C.text}}>INV/MAR/2026/001</div>
                    <div style={{fontSize:11,color:C.textMid,marginTop:4}}>Date: 31-Mar-2026 &nbsp;|&nbsp; Due: 15-Apr-2026</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.accent}}>YOUR COMPANY NAME</div>
                    <div style={{fontSize:11,color:C.textDim,marginTop:2}}>GSTIN: 24XXXXX1234X1Z5</div>
                    <div style={{fontSize:11,color:C.textDim}}>CLRA: XX/2024/XXXX</div>
                  </div>
                </div>

                {/* Bill To */}
                <div style={{borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:"14px 0",marginBottom:20}}>
                  <div style={{fontSize:10,color:C.textDim,letterSpacing:1.2,fontWeight:700,textTransform:"uppercase"}}>Bill To</div>
                  <div style={{fontWeight:700,fontSize:15,marginTop:5,color:C.text}}>{site==="All"?"M/s. Client Factory Pvt. Ltd.":`M/s. ${site}`}</div>
                  <div style={{fontSize:12,color:C.textMid,marginTop:2}}>GIDC Industrial Estate, Achhad, Talasari</div>
                </div>

                <div style={{fontSize:11,color:C.textMid,marginBottom:14,padding:"6px 12px",background:C.surfaceHigh,borderRadius:8}}>
                  Period: 1-Mar-2026 to 31-Mar-2026 &nbsp;•&nbsp; Workers: {filtered.length} &nbsp;•&nbsp; Sites: {site==="All"?SITES.join(", "):site}
                </div>

                {/* Line items */}
                {[
                  {l:"Gross Wages (per muster roll)",v:tGross},
                  {l:`PF Employer Contribution (12%)`,v:tPfEr},
                  {l:"ESI Employer Contribution (3.25%)",v:tEsiEr},
                  {l:"Service Charge (10% on Gross)",v:svcCharge},
                ].map((x,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:`1px solid ${C.border}33`,fontSize:13}}>
                    <span style={{color:C.textMid,flex:1,paddingRight:12}}>{x.l}</span>
                    <span style={{fontFamily:"'DM Mono'",fontWeight:600,color:C.text}}>{fmt(x.v)}</span>
                  </div>
                ))}

                <div style={{display:"flex",justifyContent:"space-between",padding:"11px 0",fontSize:13,borderBottom:`1px solid ${C.border}33`}}>
                  <span style={{fontWeight:700}}>Sub-Total</span>
                  <span style={{fontFamily:"'DM Mono'",fontWeight:700}}>{fmt(invTotal)}</span>
                </div>
                {[["CGST @9%",Math.round(invTotal*0.09)],["SGST @9%",Math.round(invTotal*0.09)]].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",fontSize:12,borderBottom:`1px solid ${C.border}22`,color:C.textMid}}>
                    <span>{l}</span>
                    <span style={{fontFamily:"'DM Mono'"}}>{fmt(v)}</span>
                  </div>
                ))}

                {/* Grand total */}
                <div style={{display:"flex",justifyContent:"space-between",padding:"18px 16px",marginTop:10,background:`linear-gradient(135deg,${C.accentGlow},${C.amberGlow})`,borderRadius:12,border:`1px solid ${C.accent}44`}}>
                  <span style={{fontWeight:800,fontSize:16}}>TOTAL PAYABLE</span>
                  <span style={{fontFamily:"'DM Mono'",fontWeight:800,color:C.accent,fontSize:22}}>{fmt(Math.round(invTotal*1.18))}</span>
                </div>

                <div style={{marginTop:16,padding:"12px 14px",background:C.surfaceHigh,borderRadius:10,fontSize:11,color:C.textMid}}>
                  <span style={{color:C.text,fontWeight:700}}>📎 Attachments: </span>Muster Roll, PF ECR Copy, ESI Challan Copy, Wage Sheet, Bank Transfer Proof
                </div>

                <div style={{marginTop:14,display:"flex",gap:10,flexWrap:"wrap"}}>
                  <button onClick={()=>alert("📄 Invoice PDF generation queued!\n\nIn production, this downloads a signed PDF with muster roll attached.")} className="btn-primary" style={{flex:1,minWidth:140,borderRadius:10}}>📄 Download PDF</button>
                  <button onClick={()=>alert("📎 WhatsApp message drafted!\n\nIn production, this sends the invoice link to the client via WhatsApp Business API.")} className="btn-outline" style={{flex:1,minWidth:140,borderRadius:10}}>📲 WhatsApp karo</button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ WORKERS ═══ */}
          {tab==="workers"&&<div>
            <SectionTitle icon="👷" title="Workers / Majdoor" sub={`${filtered.length} workers, March 2026`}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
              {filtered.map((w,i)=>{
                const wg=fWages[i];
                const pct=Math.round(wg.pr/(daysInMonth-wg.wo)*100);
                const barColor=pct>80?C.accent:pct>60?C.amber:C.danger;
                return(
                  <div key={w.id} className="card fade-up" style={{animationDelay:`${i*0.05}s`,cursor:"pointer",transition:"border-color .2s,transform .2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform="translateY(-2px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                      <div style={{width:46,height:46,borderRadius:"50%",background:`${barColor}20`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,color:barColor,flexShrink:0,border:`2px solid ${barColor}40`}}>
                        {w.name.split(" ").map(n=>n[0]).join("")}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{w.name}</div>
                        <div style={{fontSize:11,color:C.textMid,marginTop:2}}>{w.role} &nbsp;•&nbsp; {w.site}</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      {[
                        {l:"Daily Wage",v:fmt(w.wage),c:C.text},
                        {l:"Attendance",v:`${pct}%`,c:barColor},
                        {l:"Gross Pay",v:fmt(wg.gross),c:C.text},
                        {l:"Net Pay",v:fmt(wg.net),c:C.accent},
                      ].map(x=>(
                        <div key={x.l} style={{background:C.surfaceHigh,padding:"9px 11px",borderRadius:10}}>
                          <div style={{fontSize:10,color:C.textDim,marginBottom:3,fontWeight:600}}>{x.l}</div>
                          <div style={{fontWeight:700,fontFamily:"'DM Mono'",fontSize:13,color:x.c}}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{height:4,background:C.inputBg,borderRadius:4}}>
                      <div style={{height:"100%",borderRadius:4,width:`${pct}%`,background:barColor}}/>
                    </div>
                    <div style={{marginTop:8,fontSize:10,color:C.textDim,fontFamily:"'DM Mono'",wordBreak:"break-all"}}>UAN: {w.uan} &nbsp;|&nbsp; ESI: {w.esi}</div>
                  </div>
                );
              })}
            </div>
          </div>}

          {/* ═══ COMPLIANCE ═══ */}
          {tab==="compliance"&&<div>
            <SectionTitle icon="🛡️" title="Compliance" sub="Legal filings — sab kuch track karo"/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:20}}>
              <Stat label="PF Status" value="Active" color={C.accent} icon="🏦" sub="MHBAN0012345000" delay={0}/>
              <Stat label="ESI Status" value="Active" color={C.accent} icon="🏥" sub="31-12345-678" delay={1}/>
              <Stat label="CLRA License" value="Valid" color={C.accent} icon="📋" sub="Till 31-Dec-2026" delay={2}/>
            </div>

            <div className="card fade-up" style={{marginBottom:16,animationDelay:"0.25s"}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:18,display:"flex",alignItems:"center",gap:8}}>
                <span>📅</span> Compliance Calendar — Mar to Jul 2026
              </div>
              {[
                {d:"7 Apr 2026",t:"Wage Payment",s:"pending",cat:"💸 Payment"},
                {d:"15 Apr 2026",t:"PF ECR Filing + Challan",s:"pending",cat:"🏦 PF"},
                {d:"15 Apr 2026",t:"ESI Contribution Challan",s:"pending",cat:"🏥 ESI"},
                {d:"7 May 2026",t:"April Wage Payment",s:"upcoming",cat:"💸 Payment"},
                {d:"15 May 2026",t:"April PF ECR Filing",s:"upcoming",cat:"🏦 PF"},
                {d:"30 Jul 2026",t:"CLRA Half-Yearly Return (Form XXIV)",s:"upcoming",cat:"📋 CLRA"},
              ].map((x,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:C.surfaceHigh,borderRadius:12,marginBottom:8,border:`1px solid ${x.s==="pending"?`${C.amber}30`:C.border}`}}>
                  <div style={{textAlign:"center",minWidth:72}}>
                    <div style={{fontSize:12,fontWeight:800,fontFamily:"'DM Mono'",color:x.s==="pending"?C.amber:C.textMid}}>{x.d.split(" ")[0]+" "+x.d.split(" ")[1]}</div>
                    <div style={{fontSize:10,color:C.textDim}}>{x.d.split(" ")[2]}</div>
                  </div>
                  <div style={{width:1,height:36,background:C.border}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{x.t}</div>
                    <div style={{fontSize:10,color:C.textDim,marginTop:2}}>{x.cat}</div>
                  </div>
                  <div style={{padding:"4px 10px",borderRadius:8,fontSize:10,fontWeight:700,flexShrink:0,
                    background:x.s==="pending"?`${C.amber}20`:`${C.textDim}15`,
                    color:x.s==="pending"?C.amber:C.textDim,
                  }}>{x.s==="pending"?"⏳ PENDING":"📅 SOON"}</div>
                </div>
              ))}
            </div>

            <div className="card fade-up" style={{animationDelay:"0.4s"}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                <span>📝</span> Required Registers (CLRA Act)
              </div>
              {[
                {form:"Form A",desc:"Register of Contractors",status:"✅ Digital"},
                {form:"Form B",desc:"Register of Workers Employed",status:"✅ Digital"},
                {form:"Form C",desc:"Muster Roll",status:"✅ Auto-generated"},
                {form:"Form D",desc:"Register of Wages",status:"✅ Auto-generated"},
                {form:"Form XXIV",desc:"Half-Yearly Return",status:"⏳ Due Jul 2026"},
              ].map((x,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<4?`1px solid ${C.border}33`:"none"}}>
                  <div>
                    <span style={{fontWeight:700,color:C.text,fontSize:13}}>{x.form}</span>
                    <span style={{color:C.textMid,fontSize:12}}> — {x.desc}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:x.status.includes("✅")?C.accent:C.amber,flexShrink:0,marginLeft:8}}>{x.status}</div>
                </div>
              ))}
            </div>
          </div>}

        </div>{/* end main-scroll */}

        {/* ── MOBILE BOTTOM NAV ── */}
        <div className="mobile-bottom-nav" style={{position:"fixed",bottom:0,left:0,right:0,background:C.surface,borderTop:`1px solid ${C.border}`,padding:"8px 4px calc(8px + env(safe-area-inset-bottom))",zIndex:30,alignItems:"center",justifyContent:"space-around"}}>
          {navTabs.map(t=>(
            <button key={t.id} className={`tab-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
              <span className="icon">{t.icon}</span>
              <span className="lbl">{t.label}</span>
              {tab===t.id&&<div style={{position:"absolute",bottom:-8,width:20,height:3,borderRadius:2,background:C.accent,marginTop:2}}/>}
            </button>
          ))}
          <button className={`tab-btn${(tab==="workers"||tab==="compliance")?" active":""}`} onClick={()=>setMenuOpen(true)}>
            <span className="icon">☰</span>
            <span className="lbl">More</span>
          </button>
        </div>

      </div>{/* end main area */}
    </div>
  );
}
