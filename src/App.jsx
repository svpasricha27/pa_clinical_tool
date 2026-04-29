import { useState, useMemo, Component } from "react";

// ─── Supabase Analytics ───
const SUPA_URL="https://mhxsdawogycnlivoaudi.supabase.co";
const SUPA_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oeHNkYXdvZ3ljbmxpdm9hdWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzE4MTQsImV4cCI6MjA5MDU0NzgxNH0.hLBsdrQye8Y7OzNSytHjxAjFR_hb9CgHaeLYU-5Dln4";
function logData(table,data){try{fetch(SUPA_URL+"/rest/v1/"+table,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Prefer":"return=minimal"},body:JSON.stringify(data)});}catch(e){}}


// ─── Error Boundary ───
class ErrorBoundary extends Component {
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return{hasError:true,error};}
  render(){
    if(this.state.hasError) return(
      <div style={{padding:40,textAlign:"center",color:"#E4E6EC",fontFamily:"system-ui",background:"#0d1117",minHeight:"100vh"}}>
        <h2 style={{color:"#E05252",marginBottom:12}}>Something went wrong</h2>
        <p style={{color:"#9298A8",marginBottom:12}}>Please refresh and try again.</p>
        <pre style={{fontSize:11,color:"#555B6A",textAlign:"left",maxWidth:500,margin:"0 auto",whiteSpace:"pre-wrap"}}>{String(this.state.error)}</pre>
        <button onClick={()=>this.setState({hasError:false,error:null})} style={{marginTop:16,padding:"8px 20px",borderRadius:6,border:"none",background:"#58A6FF",color:"#fff",cursor:"pointer",fontSize:13}}>Try Again</button>
      </div>
    );
    return this.props.children;
  }
}

// ─── CKD-EPI 2021 ───
function calcEGFR(cr, age, sex) {
  if (!cr || !age || !sex) return null;
  const c = parseFloat(cr), a = parseFloat(age);
  if (isNaN(c) || isNaN(a) || c <= 0) return null;
  const f = sex === "F";
  const k = f ? 0.7 : 0.9;
  const al = f ? -0.241 : -0.302;
  const r = c / k;
  return Math.round(142 * Math.pow(Math.min(r, 1), al) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, a) * (f ? 1.012 : 1));
}

// ─── Drug DB (from Tables 6 & 7) ───
// risk: "fn" = raises renin / lowers aldo → false negative; "fp" = lowers renin → false positive
const DRUGS = [
  { id: "mra", label: "MRA (e.g. spironolactone, eplerenone, finerenone)", kw: ["spironolactone","eplerenone","finerenone","aldactone","inspra","kerendia","mra"], renin: "↑", aldo: "↑", wo: 4, risk: "fn", strength: "strong" },
  { id: "enac", label: "ENaC inhibitor (e.g. amiloride, triamterene)", kw: ["amiloride","triamterene","midamor","dyrenium","enac"], renin: "↑", aldo: "—", wo: 4, risk: "fn", strength: "strong" },
  { id: "drospirenone", label: "Drospirenone-containing OCP (e.g. Yaz, Yasmin)", kw: ["drospirenone","yaz","yasmin","slynd"], renin: "↑", aldo: "↑", wo: 4, risk: "fn", strength: "strong" },
  { id: "diuretic", label: "Diuretic (e.g. HCTZ, chlorthalidone, furosemide, indapamide)", kw: ["hctz","hydrochlorothiazide","chlorthalidone","indapamide","furosemide","lasix","bumetanide","torsemide","metolazone","thiazide","diuretic"], renin: "↑", aldo: "↑", wo: 4, risk: "fn", strength: "intermediate" },
  { id: "acei", label: "ACE inhibitor (e.g. ramipril, perindopril, enalapril, lisinopril)", kw: ["lisinopril","ramipril","enalapril","perindopril","quinapril","benazepril","captopril","fosinopril","trandolapril","acei","ace inhibitor","zestril","altace","vasotec"], renin: "↑", aldo: "↓", wo: 2, risk: "fn", strength: "weak" },
  { id: "arb", label: "ARB (e.g. valsartan, candesartan, telmisartan, losartan, irbesartan)", kw: ["losartan","valsartan","irbesartan","candesartan","telmisartan","olmesartan","azilsartan","arb","cozaar","diovan","avapro","atacand"], renin: "↑", aldo: "↓", wo: 2, risk: "fn", strength: "weak" },
  { id: "ccb_dhp", label: "DHP calcium-channel blocker (e.g. amlodipine, nifedipine, felodipine)", kw: ["amlodipine","nifedipine","felodipine","norvasc","adalat","plendil","dihydropyridine"], renin: "—", aldo: "—", wo: 2, risk: "fn", strength: "weak" },
  { id: "sglt2", label: "SGLT2 inhibitor (e.g. empagliflozin, dapagliflozin, canagliflozin)", kw: ["empagliflozin","dapagliflozin","canagliflozin","ertugliflozin","jardiance","farxiga","invokana","sglt2"], renin: "↑", aldo: "—", wo: 2, risk: "fn", strength: "weak" },
  { id: "beta", label: "Beta-blocker (e.g. metoprolol, bisoprolol, atenolol, carvedilol)", kw: ["metoprolol","atenolol","bisoprolol","propranolol","carvedilol","nebivolol","nadolol","labetalol","sotalol","beta blocker","lopressor","toprol","coreg","bystolic"], renin: "↓", aldo: "↓", wo: 2, risk: "fp", strength: "fp" },
  { id: "alpha2", label: "Central α₂-agonist (e.g. clonidine, methyldopa)", kw: ["clonidine","methyldopa","catapres","aldomet","alpha2","alpha-2"], renin: "↓", aldo: "↓", wo: 2, risk: "fp", strength: "fp" },
  { id: "nsaid", label: "NSAID — regular use (e.g. ibuprofen, naproxen, celecoxib)", kw: ["ibuprofen","naproxen","diclofenac","indomethacin","celecoxib","meloxicam","nsaid","advil","motrin","celebrex","aleve"], renin: "↓", aldo: "—", wo: 2, woUncertain: true, risk: "fp", strength: "fp" },
  { id: "ocp", label: "Combined OCP / HRT — estrogen + progesterone (complex effect)", kw: ["oral contraceptive","ocp","hrt","estrogen","progesterone","hormone replacement","alesse","marvelon"], renin: "complex", aldo: "↑", wo: 0, risk: "complex", strength: "complex" },
];

function detectDrugs(text) {
  if (!text.trim()) return [];
  const l = text.toLowerCase();
  return DRUGS.filter(d => d.kw.some(k => l.includes(k)));
}

// ─── Renin/Aldo from Table 5 ───
const REN = [
  { id: "drc_ngl", l: "Direct Renin Concentration (ng/L)", sup: 5.2, u: "ng/L", isPRA: false, toStd: 1/5.2 },
  { id: "drc_mu", l: "Direct Renin Concentration (mU/L)", sup: 8.2, u: "mU/L", isPRA: false, toStd: 1/8.2 },
  { id: "pra_ng", l: "Plasma Renin Activity (ng/mL/h)", sup: 1, u: "ng/mL/h", isPRA: true, toStd: 1 },
  { id: "pra_pmol", l: "Plasma Renin Activity (pmol/L/min)", sup: 12.9, u: "pmol/L/min", isPRA: true, toStd: 1/12.9 },
  { id: "pra_ngl", l: "Plasma Renin Activity (ng/L/s)", sup: 0.28, u: "ng/L/s", isPRA: true, toStd: 1/0.28 },
];
const ALD = [
  { id: "ia_pmol", l: "Immunoassay (pmol/L)", u: "pmol/L", isIA: true, min: 277, toNg: 1/27.7 },
  { id: "ia_ngdl", l: "Immunoassay (ng/dL)", u: "ng/dL", isIA: true, min: 10, toNg: 1 },
  { id: "lcms_ngdl", l: "LC-MS/MS (ng/dL)", u: "ng/dL", isIA: false, min: 7.5, toNg: 1 },
  { id: "lcms_pmol", l: "LC-MS/MS (pmol/L)", u: "pmol/L", isIA: false, min: 208, toNg: 1/27.7 },
];
const ARR = {
  pra_ng:   { ia_ngdl: 20, ia_pmol: 555, lcms_ngdl: 15, lcms_pmol: 416 },
  pra_pmol: { ia_ngdl: 1.55, ia_pmol: 43, lcms_ngdl: 1.16, lcms_pmol: 32 },
  pra_ngl:  { ia_ngdl: 71, ia_pmol: 2000, lcms_ngdl: 53, lcms_pmol: 1500 },
  drc_ngl:  { ia_ngdl: 4.0, ia_pmol: 111, lcms_ngdl: 2.8, lcms_pmol: 82 },
  drc_mu:   { ia_ngdl: 2.5, ia_pmol: 70, lcms_ngdl: 1.8, lcms_pmol: 52 },
};

// ─── Colors ───
const C = { bg:"#0B0D11",card:"#13151D",bdr:"#1F2330",acc:"#5B8DEF",accS:"rgba(91,141,239,0.1)",
  w:"#E8A33D",wS:"rgba(232,163,61,0.1)",r:"#E05252",rS:"rgba(224,82,82,0.08)",
  g:"#3BBF6E",gS:"rgba(59,191,110,0.08)",t1:"#E4E6EC",t2:"#9298A8",t3:"#555B6A",wh:"#F5F6F8" };
const F="'Outfit','DM Sans',system-ui,sans-serif";
const M="'JetBrains Mono','SF Mono',monospace";

// ─── Micro-components ───
const Pill=({c:cl,bg,children})=><span style={{display:"inline-block",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700,color:cl,background:bg,letterSpacing:.4,textTransform:"uppercase"}}>{children}</span>;
const Inp=({value,onChange,placeholder,type="text",style:s})=><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"7px 10px",borderRadius:6,border:`1px solid ${C.bdr}`,background:C.bg,color:C.t1,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box",...s}} onFocus={e=>e.target.style.borderColor=C.acc} onBlur={e=>e.target.style.borderColor=C.bdr}/>;
const Sel=({value,onChange,options,ph})=><select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:6,border:`1px solid ${C.bdr}`,background:C.bg,color:value?C.t1:C.t3,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box"}}>{ph&&<option value="">{ph}</option>}{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>;
const Box=({type,title,children})=>{const m={info:[C.acc,C.accS],warn:[C.w,C.wS],red:[C.r,C.rS],green:[C.g,C.gS]};const[bc,bg]=m[type]||m.info;return(<div style={{borderLeft:`3px solid ${bc}`,background:bg,borderRadius:"0 8px 8px 0",padding:"11px 13px",marginBottom:10}}>{title&&<div style={{fontWeight:700,fontSize:13,color:C.wh,marginBottom:3}}>{title}</div>}<div style={{fontSize:12,color:C.t1,lineHeight:1.6}}>{children}</div></div>)};
const Btn=({onClick,children,primary,disabled,small,style:s})=><button onClick={onClick} disabled={disabled} style={{padding:small?"8px 14px":"12px 18px",minHeight:small?36:44,borderRadius:7,border:primary?"none":`1px solid ${C.bdr}`,background:disabled?C.bdr:primary?C.acc:C.card,color:disabled?C.t3:primary?"#fff":C.t2,fontSize:small?12:13,fontWeight:600,fontFamily:F,cursor:disabled?"not-allowed":"pointer",width:small?"auto":"100%",WebkitTapHighlightColor:"transparent",...s}}>{children}</button>;
const Chk=({checked,onChange,label,tag})=><label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",marginBottom:5}}><input type="checkbox" checked={checked} onChange={onChange} style={{accentColor:C.acc,width:14,height:14}}/><span style={{fontSize:12,color:C.t1,flex:1}}>{label}</span>{tag}</label>;

const SectionHead=({number,title,active})=>(
  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,marginTop:16,paddingBottom:8,borderBottom:`2px solid ${active?C.acc:C.bdr}`}}>
    <span style={{width:26,height:26,borderRadius:6,background:active?C.accS:C.bdr,color:active?C.acc:C.t3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,fontFamily:M}}>{number}</span>
    <span style={{fontSize:14,fontWeight:700,color:active?C.wh:C.t3}}>{title}</span>
  </div>
);

function CopyNote({text}){
  const [copied,setCopied]=useState(false);
  const doCopy=()=>{navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>{})};
  return(
    <div style={{background:C.card,border:`1px solid ${C.acc}44`,borderRadius:9,padding:14,marginTop:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:700,color:C.wh}}>📋 Clinical Note (Assessment & Plan)</div>
        <button onClick={doCopy} style={{padding:"4px 12px",borderRadius:5,border:`1px solid ${copied?C.g:C.acc}`,background:copied?C.gS:C.accS,color:copied?C.g:C.acc,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>
          {copied?"✓ Copied":"Copy to Clipboard"}
        </button>
      </div>
      <pre style={{background:C.bg,border:`1px solid ${C.bdr}`,borderRadius:6,padding:10,fontSize:11,fontFamily:M,color:C.t1,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",margin:0,maxHeight:300,overflowY:"auto"}}>{text}</pre>
    </div>
  );
}

// ═══════════════════════════════════════
// ─── Feedback Widget ───
const FEEDBACK_URL="https://script.google.com/macros/s/AKfycbzrwtRrLWy_C2H_dkYAswSpTTwbMFLwpa6hZaQ5zpSbbsa48Lp_ex2y0hozFbiMfTfC/exec"; // Replace with your Google Apps Script web app URL

function FeedbackWidget({currentPage}){
  const [open,setOpen]=useState(false);
  const [text,setText]=useState("");
  const [email,setEmail]=useState("");
  const [status,setStatus]=useState("idle");

  function doSubmit(){
    if(!text.trim()) return;
    setStatus("sending");
    try{
      const params=new URLSearchParams({message:text,email:email||"(not provided)",page:currentPage||"landing"});
      const img=new Image();
      img.onload=img.onerror=()=>{
        setStatus("sent");setText("");setEmail("");setTimeout(()=>{setStatus("idle");setOpen(false);},2500);
      };
      img.src=FEEDBACK_URL+"?"+params.toString();
    }catch(e){setStatus("error");}
  }

  return(<>
    <button onClick={()=>setOpen(!open)} style={{position:"fixed",top:56,right:12,zIndex:999,padding:"6px 14px",borderRadius:20,border:"1px solid "+C.acc,background:C.accS,color:C.acc,fontSize:11,fontWeight:700,fontFamily:F,cursor:"pointer",display:"flex",alignItems:"center",gap:5,boxShadow:"0 2px 12px rgba(0,0,0,0.3)",WebkitTapHighlightColor:"transparent"}}>
      {"💬 Feedback"}
    </button>
    {open&&(<div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",padding:"90px 12px 12px",background:"rgba(0,0,0,0.5)"}} onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
      <div style={{background:C.card,border:"1px solid "+C.bdr,borderRadius:12,padding:18,width:"100%",maxWidth:360,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:700,color:C.wh}}>Send Feedback</div>
          <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:C.t3,fontSize:18,cursor:"pointer",padding:4}}>{"✕"}</button>
        </div>
        <div style={{fontSize:10,color:C.t3,marginBottom:8}}>Page: {currentPage||"Landing"}</div>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Your email (optional)</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1px solid "+C.bdr,background:C.bg,color:C.t1,fontSize:12,fontFamily:F,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Your feedback</div>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} placeholder="What could be improved? Any bugs or suggestions?" style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1px solid "+C.bdr,background:C.bg,color:C.t1,fontSize:12,fontFamily:F,outline:"none",boxSizing:"border-box",resize:"vertical",lineHeight:1.5}}/>
        </div>
        {status==="idle"&&<Btn primary onClick={doSubmit} disabled={!text.trim()}>Submit Feedback</Btn>}
        {status==="sending"&&<div style={{textAlign:"center",fontSize:12,color:C.t2,padding:8}}>Sending...</div>}
        {status==="sent"&&<div style={{textAlign:"center",fontSize:12,color:C.g,padding:8}}>{"✓ Thank you! Feedback submitted."}</div>}
        {status==="error"&&<div style={{textAlign:"center",padding:8}}><div style={{fontSize:12,color:C.r,marginBottom:6}}>Failed to send. Please try again.</div><Btn primary onClick={doSubmit}>Retry</Btn></div>}
      </div>
    </div>)}
  </>);
}

function PAInner(){
  const [view,setView]=useState(null);
  if(!view) return(
    <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 50% 20%, rgba(232,163,61,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(91,141,239,0.06) 0%, transparent 40%), radial-gradient(ellipse at 20% 80%, rgba(224,82,82,0.05) 0%, transparent 40%), ${C.bg}`,fontFamily:F,display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,opacity:0.04,backgroundImage:`url("data:image/svg+xml,%3Csvg width='400' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,100 Q25,100 50,100 T100,100 Q110,100 115,80 Q120,20 125,100 Q130,180 135,120 Q140,100 150,100 T200,100 T250,100 Q260,100 265,80 Q270,20 275,100 Q280,180 285,120 Q290,100 300,100 T400,100' fill='none' stroke='%23E05252' stroke-width='2'/%3E%3C/svg%3E")`,backgroundRepeat:"repeat-x",backgroundPosition:"center",backgroundSize:"400px 200px",pointerEvents:"none"}}/>
      <FeedbackWidget currentPage="Landing"/>
      <div style={{maxWidth:480,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.acc,textTransform:"uppercase",marginBottom:8}}>Adapted from the 2025 Endocrine Society Guidelines</div>
        <h1 style={{color:C.wh,fontSize:26,fontWeight:800,margin:"0 0 4px",lineHeight:1.25}}>Primary Aldosteronism<br/>Clinical Decision Support</h1>
        <p style={{color:C.t2,fontSize:12,margin:"0 0 24px"}}>Select a tool to get started.</p>
        <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:460,margin:"0 auto",textAlign:"left"}}>
          <Btn primary onClick={()=>setView("screen")}>🩺  Primary Care: Should I Screen for Primary Aldosteronism?</Btn>
          <Btn primary onClick={()=>setView("interpret")}>🔬  Primary Care: Interpret Aldosterone & Renin Levels, and Initial Management</Btn>
          <Btn primary onClick={()=>setView("specialist")}>🏥  Specialists: Initial Consultation and Management</Btn>
          <Btn primary onClick={()=>setView("titrate")}>📈  Specialists: Titrate Medical Therapy</Btn>
          <Btn primary onClick={()=>setView("avsprep")}>🔬  Specialists: Prepare for Adrenal Vein Sampling</Btn>
          <Btn primary onClick={()=>setView("surgery")}>⚕️  Specialists: Prepare for Surgery</Btn>
          <Btn primary onClick={()=>setView("postadx")}>📋  Specialists: Post-Adrenalectomy Follow-Up</Btn>
        </div>
        <p style={{fontSize:10,color:C.t3,marginTop:18,lineHeight:1.5}}>Adapted from: Adler GK et al., JCEM 2025. DOI:10.1210/clinem/dgaf284</p>
        <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:8,padding:14,marginTop:14,textAlign:"left"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.w,marginBottom:6}}>⚖️ Medico-Legal Disclaimer</div>
          <div style={{fontSize:10,color:C.t2,lineHeight:1.7}}>
            This tool is intended for <strong style={{color:C.t1}}>educational and clinical decision-support purposes only</strong> and does not constitute medical advice, diagnosis, or treatment. It is designed to assist qualified healthcare professionals in interpreting screening results and considering management options for primary aldosteronism, in accordance with published guidelines.
            <br/><br/>
            Clinical decisions must always be made by a qualified healthcare provider based on the individual patient's clinical context, comorbidities, and preferences. The authors and developers of this tool accept <strong style={{color:C.t1}}>no liability</strong> for clinical outcomes arising from its use. Users are responsible for verifying all recommendations against current guidelines and institutional protocols before applying them to patient care.
            <br/><br/>
            By using this tool, you acknowledge that it is provided <strong style={{color:C.t1}}>"as is"</strong> without warranty, and that all clinical responsibility remains with the treating clinician.
          </div>
        </div>
      </div>
    </div>
  );
  const Header=()=><div style={{background:C.card,borderBottom:`1px solid ${C.bdr}`,padding:"9px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:C.acc,textTransform:"uppercase"}}>PA Tool</span><span style={{color:C.t3}}>·</span><span style={{fontSize:12,color:C.t2}}>{view==="screen"?"Primary Care: Should I Screen?":view==="specialist"?"Specialists: Initial Consultation & Management":view==="titrate"?"Specialists: Titrate Medical Therapy":view==="avsprep"?"Specialists: Prepare for AVS":view==="postadx"?"Specialists: Post-Adrenalectomy":view==="surgery"?"Specialists: Prepare for Surgery":"Primary Care: Interpret & Initial Management"}</span></div>
    <Btn small onClick={()=>setView(null)}>← Menu</Btn>
  </div>;
  const pageName=view==="screen"?"Should I Screen":view==="interpret"?"PCP Interpret & Manage":view==="specialist"?"Specialist Initial Consult":view==="titrate"?"Titrate Medical Therapy":view==="avsprep"?"Prepare for AVS":view==="surgery"?"Prepare for Surgery":view==="postadx"?"Post-Adrenalectomy Follow-Up":"Unknown";
  return(
    <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 50% 0%, rgba(232,163,61,0.04) 0%, transparent 40%), radial-gradient(ellipse at 90% 50%, rgba(91,141,239,0.03) 0%, transparent 30%), ${C.bg}`,fontFamily:F,color:C.t1}}>
      <FeedbackWidget currentPage={pageName}/>
      <Header/>
      <div style={{maxWidth:600,margin:"0 auto",padding:"18px 16px 40px"}}>
        {view==="screen"&&<ScreenTool/>}
        {view==="interpret"&&<InterpretTool mode="pcp"/>}
        {view==="specialist"&&<InterpretTool mode="specialist"/>}
        {view==="titrate"&&<TitrateTool/>}
        {view==="avsprep"&&<AVSPrepTool/>}
        {view==="surgery"&&<PrepSurgeryTool/>}
        {view==="postadx"&&<PostAdxTool/>}
        <div style={{marginTop:24,padding:"10px 12px",background:C.card,border:`1px solid ${C.bdr}`,borderRadius:7,textAlign:"center"}}>
          <div style={{fontSize:9,color:C.t3,lineHeight:1.6}}>⚖️ <strong style={{color:C.t2}}>Disclaimer:</strong> Educational and clinical decision-support tool only — not medical advice. Clinical decisions remain the responsibility of the treating clinician. No liability is accepted for outcomes arising from use. See full disclaimer on the landing page.</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// TOOL 1: SHOULD I SCREEN?
// ═══════════════════════════════════════
function ScreenTool(){
  const [age,setAge]=useState("");
  const [sex,setSex]=useState("");
  const [sbp,setSbp]=useState("");
  const [dbp,setDbp]=useState("");
  const [bpType,setBpType]=useState("office");
  const [numMeds,setNumMeds]=useState("0");
  const [ft,setFt]=useState({});
  const [snap,setSnap]=useState(null);
  const [intent,setIntent]=useState(null);
  const tog=id=>setFt(p=>({...p,[id]:!p[id]}));

  const sN=parseInt(sbp),dN=parseInt(dbp);
  const nm=parseInt(numMeds)||0;

  const canSubmit=age&&sex&&!isNaN(sN)&&!isNaN(dN)&&sN>0&&dN>0;

  const inputsChanged=snap&&(
    snap.age!==age||snap.sex!==sex||snap.sbp!==sbp||snap.dbp!==dbp||
    snap.bpType!==bpType||snap.numMeds!==numMeds||JSON.stringify(snap.ft)!==JSON.stringify(ft)
  );

  function doSubmit(){
    setSnap({age,sex,sbp,dbp,bpType,numMeds,ft:{...ft}});
    setIntent(null);
  }

  const hiFeats=[
    {id:"resistant",l:"Resistant HTN (uncontrolled on ≥3 drugs incl. diuretic)"},
    {id:"hypoK",l:"Spontaneous or diuretic-induced hypokalemia"},
    {id:"adenoma",l:"Adrenal incidentaloma on imaging"},
    {id:"afib",l:"Unexplained atrial fibrillation"},
    {id:"young",l:"Young-onset hypertension (age <40)"},
    {id:"family",l:"Family hx of early-onset HTN or stroke <40"},
  ];
  const modFeats=[
    {id:"osa",l:"Obstructive sleep apnea"},
    {id:"dm2",l:"Type 2 diabetes with hypertension"},
  ];

  function getRec(){
    if(!snap) return null;
    const sv=snap;
    const s=parseInt(sv.sbp),d=parseInt(sv.dbp),nm=parseInt(sv.numMeds)||0;
    const f=sv.ft;
    const hasAdenoma=!!f.adenoma;

    // Estimate unmedicated BP: add ~10/5 mmHg per med (rough clinical heuristic)
    const estSBP=s+(nm*10);
    const estDBP=d+(nm*5);

    // BP thresholds
    const isOffice=sv.bpType==="office";
    const grade2=isOffice?(s>=140||d>=90):(s>=135||d>=85);
    const stage1=isOffice?(s>=130||d>=80):(s>=130||d>=80);
    const estGrade2=isOffice?(estSBP>=140||estDBP>=90):(estSBP>=135||estDBP>=85);
    const estStage1=isOffice?(estSBP>=130||estDBP>=80):(estSBP>=130||estDBP>=80);
    const belowHTN=isOffice?(s<130&&d<80):(s<130&&d<80);

    // Is the patient actually hypertensive? (measured or estimated)
    const isHTN=stage1||(nm>0&&estStage1);

    // Categorize selected features
    const htnImpliedFeats=["resistant","young","dm2"]; // these imply the patient IS hypertensive
    const nonHtnFeats=["hypoK","afib","family","osa"]; // these don't require HTN per se
    const hasHtnImplied=htnImpliedFeats.some(id=>f[id]);
    const hasNonHtn=nonHtnFeats.some(id=>f[id]);
    const hasHi=hiFeats.some(x=>f[x.id]);
    const hasMod=modFeats.some(x=>f[x.id]);

    // ── ADRENAL INCIDENTALOMA: always screen regardless of BP ──
    if(hasAdenoma){
      const reasons=["Adrenal incidentaloma on imaging"];
      if(isHTN){
        // Add other features too
        hiFeats.filter(x=>f[x.id]&&x.id!=="adenoma").forEach(x=>reasons.push(x.l));
      }
      return {lev:"strong",col:C.r,lab:"PURSUE SCREENING — STRONG RECOMMENDATION",em:"🔴",
        txt:belowHTN&&nm===0
          ?"This patient has an adrenal incidentaloma. Screening for primary aldosteronism is specifically recommended for adrenal incidentalomas even in the absence of hypertension."
          :"This patient has an adrenal incidentaloma. Screening for primary aldosteronism is strongly recommended.",
        reasons};
    }

    // ── NOT HYPERTENSIVE (BP <130/80 on 0 meds, or below threshold even with med adjustment) ──
    if(!isHTN){
      // Features that imply HTN but BP doesn't match → ask user to verify
      if(hasHtnImplied){
        const which=htnImpliedFeats.filter(id=>f[id]);
        const labels=which.map(id=>{
          if(id==="resistant") return "resistant hypertension";
          if(id==="young") return "young-onset hypertension";
          if(id==="dm2") return "type 2 diabetes with hypertension";
          return id;
        });
        return {lev:"check",col:C.w,lab:"PLEASE VERIFY BP ENTRY",em:"⚠️",
          txt:`You have indicated ${labels.join(" and ")}, but the entered BP (${s}/${d} mmHg on ${nm} medication${nm!==1?"s":""}) does not meet hypertensive thresholds. Please verify the BP and medication count are entered correctly. If the patient is truly normotensive, these features may not apply.`,
          reasons:[]};
      }
      // Non-HTN features (hypoK, afib, family, OSA) without HTN
      if(hasNonHtn||hasMod){
        const which=[...nonHtnFeats.filter(id=>f[id]),...modFeats.filter(x=>f[x.id]).map(x=>x.id)];
        const labels=which.map(id=>{
          const feat=[...hiFeats,...modFeats].find(x=>x.id===id);
          return feat?feat.l:id;
        });
        return {lev:"none",col:C.t3,lab:"SCREENING NOT SPECIFICALLY INDICATED",em:"—",
          txt:`This patient has notable features (${labels.join("; ")}), but BP (${s}/${d} mmHg on ${nm} medication${nm!==1?"s":""}) does not meet hypertensive thresholds. Primary aldosteronism screening is not specifically suggested in the absence of hypertension. If clinical suspicion remains high, consider specialist consultation.`,
          reasons:[]};
      }
      // No features, not hypertensive
      return {lev:"none",col:C.t3,lab:"SCREENING NOT INDICATED",em:"—",
        txt:"BP is below hypertensive range and the patient is on no antihypertensive medications. Primary aldosteronism screening is not indicated at this time.",
        reasons:[]};
    }

    // ── HYPERTENSIVE PATIENT ──
    const reasons=[];

    // HIGH RISK features (excluding adenoma, handled above)
    if(hasHi){
      const which=hiFeats.filter(x=>f[x.id]).map(x=>x.l);
      return {lev:"strong",col:C.r,lab:"PURSUE SCREENING — STRONG RECOMMENDATION",em:"🔴",
        txt:"This patient has high-risk features with primary aldosteronism prevalence 11–43%.",
        reasons:which};
    }

    // MODERATE: measured BP ≥140/90, OR estimated unmedicated BP ≥140/90, OR moderate risk features
    if(grade2){
      reasons.push(`Measured BP ${s}/${d} mmHg is ≥140/90 (${isOffice?"office":"home"})`);
    } else if(!grade2&&nm>0&&estGrade2){
      reasons.push(`Measured BP is ${s}/${d} mmHg on ${nm} medication${nm>1?"s":""} — estimated unmedicated BP ~${estSBP}/${estDBP} mmHg (≥140/90)`);
    }
    if(hasMod){
      modFeats.filter(x=>f[x.id]).forEach(x=>reasons.push(x.l));
    }
    if(reasons.length>0){
      return {lev:"moderate",col:C.w,lab:"PURSUE SCREENING — MODERATE RECOMMENDATION",em:"🟡",
        txt:"Primary aldosteronism prevalence is 5–14% in primary care hypertensive populations. Screening is recommended.",
        reasons};
    }

    // WEAK: measured BP 130-139/80-89, OR estimated unmedicated BP in that range
    if(stage1){
      reasons.push(`Measured BP ${s}/${d} mmHg is in the 130–139/80–89 range (${isOffice?"office":"home"})`);
    } else if(!stage1&&nm>0&&estStage1){
      reasons.push(`Measured BP is ${s}/${d} mmHg on ${nm} medication${nm>1?"s":""} — estimated unmedicated BP ~${estSBP}/${estDBP} mmHg (130–139/80–89 range)`);
    }
    if(reasons.length>0){
      return {lev:"weak",col:C.t2,lab:"EITHER SCREEN OR DO NOT SCREEN",em:"⚪",
        txt:"While the 2025 Endocrine Society guideline suggests screening all individuals with hypertension for primary aldosteronism, urgency is lower without high-risk features, moderate-risk features, and when BP is below 140/90 mmHg. The decision to screen can be individualized.",
        reasons};
    }

    return {lev:"none",col:C.t3,lab:"SCREENING NOT INDICATED",em:"—",
      txt:"Based on the information provided, primary aldosteronism screening is not indicated at this time.",reasons:[]};
  }

  const rec=snap?getRec():null;

  return (<>
    <h2 style={{fontSize:17,fontWeight:700,color:C.wh,margin:"0 0 12px"}}>Should I Screen for Primary Aldosteronism?</h2>

    {/* Demographics */}
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:8}}>Patient</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Age range</div><Sel value={age} onChange={setAge} ph="Select..." options={[{v:"18-24",l:"18–24"},{v:"25-34",l:"25–34"},{v:"35-49",l:"35–49"},{v:"50-64",l:"50–64"},{v:"65-79",l:"65–79"},{v:"80+",l:"80+"}]}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Sex</div><Sel value={sex} onChange={setSex} ph="Select..." options={[{v:"M",l:"Male"},{v:"F",l:"Female"}]}/></div>
      </div>
    </div>

    {/* BP */}
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:8}}>Blood Pressure</div>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        {["office","home"].map(t=>(<button key={t} onClick={()=>setBpType(t)} style={{flex:1,padding:"5px 0",borderRadius:5,border:`1px solid ${bpType===t?C.acc:C.bdr}`,background:bpType===t?C.accS:"transparent",color:bpType===t?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{t==="office"?"Office BP":"Home BP"}</button>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Systolic (mmHg)</div><Inp value={sbp} onChange={setSbp} placeholder="mmHg" type="number"/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Diastolic (mmHg)</div><Inp value={dbp} onChange={setDbp} placeholder="mmHg" type="number"/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}># BP meds</div><Sel value={numMeds} onChange={setNumMeds} options={[{v:"0",l:"0"},{v:"1",l:"1"},{v:"2",l:"2"},{v:"3",l:"3+"},{v:"4",l:"4+"}]}/></div>
      </div>
    </div>

    {/* Risk features */}
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>High-Risk Features</div>
      {hiFeats.map(f=>(<Chk key={f.id} checked={!!ft[f.id]} onChange={()=>tog(f.id)} label={f.l}/>))}
      <div style={{fontSize:12,fontWeight:700,color:C.wh,margin:"10px 0 6px"}}>Moderate-Risk Features</div>
      {modFeats.map(f=>(<Chk key={f.id} checked={!!ft[f.id]} onChange={()=>tog(f.id)} label={f.l}/>))}
    </div>

    {/* Submit / Re-submit */}
    {!snap&&<Btn primary onClick={doSubmit} disabled={!canSubmit}>Submit</Btn>}
    {snap&&inputsChanged&&(
      <div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:10,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:12,color:C.w}}>⚠ Inputs have changed.</span>
        <Btn small primary onClick={doSubmit} style={{width:"auto"}}>Re-submit</Btn>
      </div>
    )}

    {/* ═══ RESULT ═══ */}
    {rec&&(<div style={{marginTop:12}}>
      <div style={{background:C.card,border:`1px solid ${rec.col}33`,borderRadius:9,padding:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:16}}>{rec.em}</span>
          <Pill c={rec.col} bg={rec.col+"18"}>{rec.lab}</Pill>
        </div>
        <p style={{fontSize:12,color:C.t1,lineHeight:1.6,margin:0}}>{rec.txt}</p>
        {rec.reasons&&rec.reasons.length>0&&(
          <div style={{marginTop:6,fontSize:11,color:C.t2}}>
            <strong style={{color:C.t1}}>Reason{rec.reasons.length>1?"s":""}:</strong>
            <ul style={{paddingLeft:16,margin:"3px 0 0"}}>
              {rec.reasons.map((r,i)=>(<li key={i}>{r}</li>))}
            </ul>
          </div>
        )}
        {(rec.lev==="strong"||rec.lev==="moderate"||rec.lev==="weak")&&(
          <div style={{marginTop:10,background:C.bg,borderRadius:7,padding:10,fontSize:11,color:C.t2,lineHeight:1.6}}>
            <strong style={{color:C.t1}}>Order:</strong> Serum aldosterone, renin (either PRA or DRC), and potassium. Screen <strong>on current medications</strong> — use the <strong>"Interpret Serum Aldosterone & Renin Results"</strong> tool to interpret results accounting for medication effects.
          </div>
        )}
      </div>

      {/* Intent question — only for actual screening recommendations */}
      {(rec.lev==="strong"||rec.lev==="moderate"||rec.lev==="weak")&&(
        <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginTop:10}}>
          <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Do you intend to pursue screening for this patient?</div>
          <div style={{display:"flex",gap:6}}>
            {[{v:"yes",l:"Yes"},{v:"no",l:"No"},{v:"unsure",l:"Unsure"}].map(o=>(<button key={o.v} onClick={()=>setIntent(o.v)} style={{flex:1,padding:"7px 0",borderRadius:6,border:`1px solid ${intent===o.v?C.acc:C.bdr}`,background:intent===o.v?C.accS:"transparent",color:intent===o.v?C.acc:C.t2,fontSize:12,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
          </div>
          {intent==="yes"&&<p style={{fontSize:11,color:C.g,margin:"6px 0 0"}}>Great — order the labs and use the interpretation tool once results are available.</p>}
          {intent==="no"&&<p style={{fontSize:11,color:C.t2,margin:"6px 0 0"}}>Understood. Consider rescreening if the patient develops resistant hypertension, hypokalemia, or unexplained atrial fibrillation in the future.</p>}
          {intent==="unsure"&&<p style={{fontSize:11,color:C.t2,margin:"6px 0 0"}}>That's okay. The screening test is a simple blood draw with low risk. If you'd like to discuss further, consider referral to a specialist.</p>}
        </div>
      )}

      {/* Clinical note */}
      {rec.lev!=="check"&&(()=>{
        const sv=snap;
        const s=parseInt(sv.sbp),d=parseInt(sv.dbp),nm=parseInt(sv.numMeds)||0;
        const screenRec=rec.lev==="strong"||rec.lev==="moderate"||rec.lev==="weak";
        const reasonStr=rec.reasons&&rec.reasons.length>0?rec.reasons.join("; "):"";
        const sexWord=sv.sex==="M"?"male":"female";
        const medPhrase=nm===0?"not currently on antihypertensive therapy":`on ${nm} antihypertensive medication${nm!==1?"s":""}`;
        
        let note=`Assessment:\nThis ${sexWord} patient (age ${sv.age}) presents with a blood pressure of ${s}/${d} mmHg (${sv.bpType}) and is ${medPhrase}. `;
        if(reasonStr) note+=`Notable risk features include: ${reasonStr}. `;
        else note+=`No high-risk or moderate-risk features for primary aldosteronism were identified. `;
        note+=`Based on these findings, the recommendation for primary aldosteronism screening is: ${rec.lab.toLowerCase()}. ${rec.txt}`;
        
        note+=`\n\nPlan:\n`;
        if(screenRec){
          note+=`- Order serum aldosterone, renin (PRA or DRC), and potassium to screen for primary aldosteronism\n`;
          note+=`- Screen on current medications; interpret results accounting for potential medication interference`;
          if(intent==="yes") note+=`\n- Decision to pursue screening confirmed`;
          if(intent==="no") note+=`\n- Screening deferred at this time; will rescreen if patient develops worsening or resistant hypertension, new hypokalemia, or unexplained atrial fibrillation`;
        } else {
          note+=`- Primary aldosteronism screening is not indicated at this time based on the clinical presentation`;
        }
        logData("tool_screen",{age_range:sv.age,sex:sv.sex,bp_sbp:s,bp_dbp:d,bp_meds_count:String(nm),recommendation:rec.lev});
        return <CopyNote text={note}/>;
      })()}
    </div>)}
  </>);
}

// ═══════════════════════════════════════
// TOOL 2: INTERPRET RESULTS
// ═══════════════════════════════════════
function InterpretTool({mode="pcp"}){
  const isSpec=mode==="specialist";
  const [phase,setPhase]=useState("input");
  const [rTid,setRTid]=useState("drc_ngl");
  const [rV,setRV]=useState("");
  const [aTid,setATid]=useState("ia_pmol");
  const [aV,setAV]=useState("");
  const [kV,setKV]=useState("");
  const [mc,setMc]=useState({});
  const [mt,setMt]=useState("");
  const [age,setAge]=useState("");
  const [sex,setSex]=useState("");
  // Lateralization
  const [adnStatus,setAdnStatus]=useState(""); // "yes_uni_r","yes_uni_l","yes_bi","none","no_imaging"
  const [adnSzMain,setAdnSzMain]=useState(""); // size on affected side (unilateral) or right (bilateral)
  const [adnSzLeft,setAdnSzLeft]=useState(""); // left size (bilateral only)
  const [resHTN,setResHTN]=useState(false);
  const [egM,setEgM]=useState("direct");
  const [crUnit,setCrUnit]=useState("mg"); // "mg" = mg/dL (US), "umol" = µmol/L (SI/Canada)
  const [cr,setCr]=useState("");
  const [egD,setEgD]=useState("");
  const [latSnap,setLatSnap]=useState(null); // snapshot for lateralization
  // Specialist-specific state
  const [surgCandidate,setSurgCandidate]=useState(""); // "yes","no"
  const [surgInterest,setSurgInterest]=useState(""); // "yes","no"
  const [specAvsDecision,setSpecAvsDecision]=useState(""); // "avs","medical" — for intermediate lateralization
  const [foregoAvs,setForegoAvs]=useState(""); // "direct_surgery","do_avs" — for young+hypoK+uni adenoma
  // Management snapshot (specialist only — gates next steps + clinical note on surgical decisions)
  const [mgmtSnap,setMgmtSnap]=useState(null);
  function submitMgmt(){setMgmtSnap({surgCandidate,surgInterest,specAvsDecision,foregoAvs});}
  const mgmtInputsChanged=mgmtSnap&&(
    mgmtSnap.surgCandidate!==surgCandidate||mgmtSnap.surgInterest!==surgInterest||
    mgmtSnap.specAvsDecision!==specAvsDecision||mgmtSnap.foregoAvs!==foregoAvs
  );
  // For specialist: use mgmtSnap values for rendering next steps and note
  const ms=mgmtSnap||{};
  const _surgCandidate=isSpec&&mgmtSnap?ms.surgCandidate:surgCandidate;
  const _surgInterest=isSpec&&mgmtSnap?ms.surgInterest:surgInterest;
  const _specAvsDecision=isSpec&&mgmtSnap?ms.specAvsDecision:specAvsDecision;
  const _foregoAvs=isSpec&&mgmtSnap?ms.foregoAvs:foregoAvs;

  // Snapshot: frozen copy of inputs used for current interpretation
  const [snap,setSnap]=useState(null);

  function takeSnap(){
    setSnap({rTid,rV,aTid,aV,kV,mc:{...mc},mt,age,sex,adnStatus,adnSzMain,adnSzLeft,resHTN,egM,crUnit,cr,egD});
    setPhase("result");
  }

  // Live assay refs for input labels (always reflect current selection)
  const liveRen=REN.find(r=>r.id===rTid);
  const liveAld=ALD.find(a=>a.id===aTid);

  const inputsChanged = snap && (
    snap.rTid!==rTid||snap.rV!==rV||snap.aTid!==aTid||snap.aV!==aV||snap.kV!==kV||
    JSON.stringify(snap.mc)!==JSON.stringify(mc)||snap.mt!==mt||snap.age!==age||snap.sex!==sex
  );

  // Use snapshot values for results when in result phase, live values for input phase
  const s = snap || {};
  const _rTid=phase==="result"&&snap?s.rTid:rTid;
  const _aTid=phase==="result"&&snap?s.aTid:aTid;
  const _rV=phase==="result"&&snap?s.rV:rV;
  const _aV=phase==="result"&&snap?s.aV:aV;
  const _kV=phase==="result"&&snap?s.kV:kV;
  const _mc=phase==="result"&&snap?s.mc:mc;
  const _mt=phase==="result"&&snap?s.mt:mt;
  const _age=phase==="result"&&snap?s.age:age;
  const _sex=phase==="result"&&snap?s.sex:sex;
  const ls=latSnap||{};
  const _adn=latSnap?ls.adnStatus:adnStatus;
  const _adnSzMain=latSnap?ls.adnSzMain:adnSzMain;
  const _adnSzLeft=latSnap?ls.adnSzLeft:adnSzLeft;
  const _egM=latSnap?ls.egM:egM;
  const _crUnit=latSnap?ls.crUnit:crUnit;
  const _cr=latSnap?ls.cr:cr;
  const _egD=latSnap?ls.egD:egD;
  const _resHTN=latSnap?ls.resHTN:resHTN;

  const ren=REN.find(r=>r.id===_rTid)||REN[0];
  const ald=ALD.find(a=>a.id===_aTid)||ALD[0];
  const rN=parseFloat(_rV),aN=parseFloat(_aV),kN=parseFloat(_kV);
  const arrTh=ARR[_rTid]?.[_aTid];
  const renSup=!isNaN(rN)&&rN<=ren.sup;
  const aldHi=!isNaN(aN)&&aN>=ald.min;
  const arrVal=(!isNaN(rN)&&!isNaN(aN)&&rN>0)?aN/rN:null;
  const arrHi=arrVal!==null&&arrTh!==null&&arrVal>arrTh;
  const pos=renSup&&aldHi&&arrHi;
  const hypoK=!isNaN(kN)&&kN<3.5;
  const highK=!isNaN(kN)&&kN>4.8;
  const aldNg=!isNaN(aN)?aN*ald.toNg:null;
  const aldIA=ald.isIA?aldNg:(aldNg?aldNg*1.33:null);
  const renVL=ren.isPRA?(!isNaN(rN)&&rN*ren.toStd<0.2):(!isNaN(rN)&&rN*ren.toStd*8.2<2);

  const checked=DRUGS.filter(d=>_mc[d.id]);
  const parsed=useMemo(()=>detectDrugs(_mt),[_mt]);
  const allM=useMemo(()=>{const ids=new Set([...checked.map(d=>d.id),...parsed.map(d=>d.id)]);return DRUGS.filter(d=>ids.has(d.id));},[_mc,_mt]);
  const fp=allM.filter(d=>d.risk==="fp");
  const fn=allM.filter(d=>d.risk==="fn");
  // FP threshold: if aldo is well above this, PA is likely despite FP meds
  const fpHighThresh=ald.min*2;
  const fpStronglyPositive=pos&&!isNaN(aN)&&aN>=fpHighThresh;
  const fpWeaklyPositive=pos&&!isNaN(aN)&&aN<fpHighThresh;
  // Categorize FN meds by strength and proximity to threshold
  const strongFN=fn.filter(d=>d.strength==="strong"||d.strength==="intermediate");
  const weakFN=fn.filter(d=>d.strength==="weak");
  // "Near threshold" means aldo or ARR is within 30% of cutoff (could be masked by FN meds)
  const nearAldo=!isNaN(aN)&&ald.min&&aN>=ald.min*0.7&&aN<ald.min;
  const nearARR=arrVal!==null&&arrTh&&arrVal>=arrTh*0.7&&arrVal<=arrTh;
  const nearThreshold=renSup&&(nearAldo||nearARR);
  const clearlyNegative=!renSup||(aN&&ald.min&&aN<ald.min*0.7)||(arrVal!==null&&arrTh&&arrVal<arrTh*0.7);
  const nearMeds=nearThreshold?fn:[];

  const ageN=parseInt(_age);
  // eGFR: convert SI creatinine (µmol/L) to mg/dL for CKD-EPI
  const crMgDl=_crUnit==="umol"&&_cr?parseFloat(_cr)/88.4:parseFloat(_cr);
  const egC=_egM==="auto"&&_cr&&_age&&_sex?calcEGFR(crMgDl,ageN,_sex):null;
  const egfr=_egM==="direct"?parseFloat(_egD):egC;
  const egOk=egfr!==null&&!isNaN(egfr)&&egfr>=30;

  function latRisk(){
    const hi=[],lo=[];
    if(hypoK) hi.push("Hypokalemia");
    if(aldIA&&aldIA>20) hi.push("Aldo >20 ng/dL (IA equiv)");
    if(renVL) hi.push(`Very low renin (${_rV} ${ren.u})`);
    const isUni=_adn==="yes_uni_r"||_adn==="yes_uni_l";
    const uniSz=parseFloat(_adnSzMain)||0;
    if(isUni&&uniSz>1.0) hi.push(`Unilateral adenoma >1cm (${uniSz} cm)`);
    if(!hypoK) lo.push("Normokalemia");
    if(aldIA&&ald.isIA&&aldIA<11) lo.push("Aldo <11 ng/dL");
    if(aldNg&&!ald.isIA&&aldNg<8) lo.push("Aldo <8 ng/dL LC-MS/MS");
    if(renSup&&!renVL) lo.push(`Renin suppressed but not profoundly (${_rV} ${ren.u}; profoundly suppressed: ${ren.id==="pra_ng"?"<0.2 ng/mL/h":ren.id==="pra_pmol"?"<2.6 pmol/L/min":ren.id==="pra_ngl"?"<0.056 ng/L/s":ren.id==="drc_ngl"?"<1.3 ng/L":"<2 mU/L"})`);
    if(hi.length>=2) return {lev:"high",hi,lo};
    if(hi.length===0&&lo.length>=1) return {lev:"low",hi,lo};
    return {lev:"intermediate",hi,lo};
  }

  // Young patient eligibility for AVS bypass (<35)
  const isUnder35=ageN<=34||parseInt(_age)===21||parseInt(_age)===30;

  const canGo=rV&&aV&&kV&&age&&sex;
  const canLatSubmit=adnStatus&&(egfr!==null&&!isNaN(egfr));
  
  function submitLat(){
    setLatSnap({adnStatus,adnSzMain,adnSzLeft,resHTN,egM,crUnit,cr,egD});
  }
  const latInputsChanged=latSnap&&(
    latSnap.adnStatus!==adnStatus||latSnap.adnSzMain!==adnSzMain||latSnap.adnSzLeft!==adnSzLeft||
    latSnap.resHTN!==resHTN||latSnap.egM!==egM||latSnap.crUnit!==crUnit||latSnap.cr!==cr||latSnap.egD!==egD
  );

  const lat=(pos&&latSnap)?latRisk():null;
  const lCol=lat?.lev==="high"?C.r:lat?.lev==="low"?C.g:C.w;

  return <>
    <h2 style={{fontSize:17,fontWeight:700,color:C.wh,margin:"0 0 4px"}}>{isSpec?"Specialists: Initial Consultation and Management":"Primary Care: Interpret Aldosterone & Renin Levels, and Initial Management"}</h2>
    <p style={{fontSize:11,color:C.t2,margin:"0 0 14px"}}>Enter patient info, labs, and medications to get interpretation and next steps.</p>

    {/* Demographics */}
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:8}}>Patient</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Age range</div><Sel value={age} onChange={setAge} ph="Select..." options={[{v:"21",l:"18–24"},{v:"30",l:"25–34"},{v:"42",l:"35–49"},{v:"57",l:"50–64"},{v:"72",l:"65–79"},{v:"85",l:"80+"}]}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Sex</div><Sel value={sex} onChange={setSex} ph="Select..." options={[{v:"M",l:"Male"},{v:"F",l:"Female"}]}/></div>
      </div>
    </div>

    {/* Labs */}
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:8}}>Lab Values</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Renin assay</div><Sel value={rTid} onChange={setRTid} options={REN.map(r=>({v:r.id,l:r.l}))}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Renin ({liveRen.u})</div><Inp value={rV} onChange={setRV} placeholder="value" type="number"/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Aldosterone assay</div><Sel value={aTid} onChange={setATid} options={ALD.map(a=>({v:a.id,l:a.l}))}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Aldo ({liveAld.u})</div><Inp value={aV} onChange={setAV} placeholder="value" type="number"/></div>
      </div>
      <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Potassium (mmol/L)</div><Inp value={kV} onChange={setKV} placeholder="e.g. 3.8" type="number" style={{maxWidth:140}}/></div>
    </div>

    {/* Meds */}
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:3}}>Medications</div>
      <div style={{fontSize:10,color:C.t3,marginBottom:8}}>Check relevant classes and/or paste the full list below.</div>
      {DRUGS.map(d=><Chk key={d.id} checked={!!mc[d.id]} onChange={()=>setMc(p=>({...p,[d.id]:!p[d.id]}))} label={d.label}
        tag={d.risk==="fp"?<Pill c={C.r} bg={C.rS}>false+</Pill>:d.risk==="fn"&&(d.strength==="strong"||d.strength==="intermediate")?<Pill c={C.w} bg={C.wS}>strong false−</Pill>:d.risk==="fn"?<Pill c={C.t2} bg={C.bdr+"55"}>weak false−</Pill>:null}/>)}
      <div style={{fontSize:10,color:C.t2,marginTop:8,marginBottom:3}}>Or paste full med list (one per line or comma-separated):</div>
      <textarea value={mt} onChange={e=>setMt(e.target.value)} rows={3}
        placeholder={"Paste medication list here..."}
        style={{width:"100%",padding:"7px 9px",borderRadius:6,border:`1px solid ${C.bdr}`,background:C.bg,color:C.t1,fontSize:11,fontFamily:M,outline:"none",boxSizing:"border-box",resize:"vertical",lineHeight:1.5}}
        onFocus={e=>e.target.style.borderColor=C.acc} onBlur={e=>e.target.style.borderColor=C.bdr}/>
      {parsed.length>0&&<div style={{marginTop:4,fontSize:10,color:C.t2}}>Detected: {parsed.map(d=><span key={d.id} style={{color:C.acc,marginRight:5}}>{d.label.split("(")[0].trim()}</span>)}</div>}
    </div>

    {phase==="input"&&<Btn primary onClick={takeSnap} disabled={!canGo}>Interpret Results</Btn>}
    {phase==="result"&&inputsChanged&&(
      <div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:10,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:12,color:C.w}}>⚠ Inputs have changed since last interpretation.</span>
        <Btn small primary onClick={takeSnap} style={{width:"auto"}}>Re-interpret</Btn>
      </div>
    )}

    {/* ═══ RESULTS ═══ */}
    {phase==="result"&&<div style={{marginTop:12}}>
      <SectionHead number={1} title={isSpec?"Aldosterone & Renin Interpretation":"Interpretation of Aldosterone & Renin"} active={true}/>
      {/* Summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:10}}>
        {[
          {lb:"Renin",vl:`${_rV}`,ok:renSup,tg:renSup?"SUPPRESSED":"NOT SUPP.",th:`≤${ren.sup} ${ren.u}`},
          {lb:"Aldo",vl:`${_aV}`,ok:aldHi,tg:aldHi?"ELEVATED":"NOT ELEV.",th:`≥${ald.min} ${ald.u}`},
          {lb:"ARR",vl:arrVal!==null?arrVal.toFixed(1):"—",ok:arrHi,tg:arrHi?"ELEVATED":"NOT ELEV.",th:`>${arrTh}`},
        ].map((x,i)=>(<div key={i} style={{background:C.bg,borderRadius:7,padding:9,textAlign:"center",border:`1px solid ${x.ok?C.acc+"44":C.bdr}`}}>
          <div style={{fontSize:9,color:C.t3,textTransform:"uppercase",letterSpacing:.3}}>{x.lb}</div>
          <div style={{fontSize:16,fontWeight:800,color:C.wh,fontFamily:M,margin:"1px 0"}}>{x.vl}</div>
          <div style={{fontSize:8,color:C.t3,marginBottom:3}}>cutoff: {x.th}</div>
          <Pill c={x.ok?C.g:C.t3} bg={x.ok?C.gS:C.bdr+"55"}>{x.tg}</Pill>
        </div>))}
      </div>

      {/* ══ Results display ══ */}
      {(()=>{
        return (<>
          {/* ── POSITIVE ── */}
          {pos&&(<>
            {/* Primary result — distinct styling */}
            <div style={{background:"rgba(224,82,82,0.12)",border:`2px solid ${C.r}`,borderRadius:9,padding:14,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:16}}>🔴</span>
                <div style={{fontSize:15,fontWeight:800,color:C.wh}}>Screen POSITIVE for Primary Aldosteronism</div>
              </div>
              <div style={{fontSize:12,color:C.t1,lineHeight:1.5}}>All 3 criteria met: suppressed renin, elevated aldosterone, elevated ARR. This patient likely has primary aldosteronism.</div>
            </div>

            {/* Secondary notes — medication & K⁺ — lighter styling */}
            {fp.length > 0 && fpStronglyPositive && (
              <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:8,padding:12,marginBottom:8,fontSize:12,color:C.t1,lineHeight:1.6}}>
                <div style={{fontSize:11,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Medication Note</div>
                This patient is on <strong>{fp.map(d=>d.label.split("(")[0].trim()).join(", ")}</strong>, which lower renin and can cause false-positive results. However, aldosterone is {_aV} {ald.u}, well above {fpHighThresh} {ald.u}. <strong>PA is likely despite these medications.</strong> Retesting off these drugs is not required.
              </div>
            )}
            {fp.length > 0 && fpWeaklyPositive && (
              <div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:12,marginBottom:8,fontSize:12,color:C.t1,lineHeight:1.6}}>
                <div style={{fontSize:11,fontWeight:700,color:C.w,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>⚠ Medication Alert</div>
                This patient is on <strong>{fp.map(d=>d.label.split("(")[0].trim()).join(", ")}</strong>, which lower renin and can cause false-positive results. Aldosterone is {_aV} {ald.u}, which is positive but below {fpHighThresh} {ald.u} — <strong>this could be a false positive</strong>.
                <div style={{marginTop:6}}>
                  <strong>Withdrawal plan:</strong>
                  <ul style={{paddingLeft:16,margin:"4px 0 0"}}>
                    {fp.map(d => (<li key={d.id}>{d.label.split("(")[0].trim()}: withdraw for <strong>{d.woUncertain ? `~${d.wo} weeks (timeline not well-defined)` : `${d.wo} weeks`}</strong>, then retest</li>))}
                  </ul>
                </div>
                <div style={{marginTop:4,fontSize:11,color:C.t2}}>Safe replacement agents: alpha-1 blockers (e.g. doxazosin), non-DHP CCBs (e.g. verapamil SR, diltiazem), hydralazine, moxonidine.</div>
                <div style={{marginTop:6,fontWeight:700,color:C.acc}}>📋 Consider referral to specialist to safely manage medication withdrawal and retesting.</div>
              </div>
            )}

            {/* Lateralization */}
            <SectionHead number={2} title={isSpec?"Lateralization Assessment":"Initial Management Assessment"} active={pos}/>
            <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>

              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Adrenal imaging status</div>
                <Sel value={adnStatus} onChange={setAdnStatus} ph="Select..." options={[
                  {v:"none",l:"CT done — no adenoma/nodule"},
                  {v:"yes_uni_r",l:"CT done — unilateral nodule (RIGHT)"},
                  {v:"yes_uni_l",l:"CT done — unilateral nodule (LEFT)"},
                  {v:"yes_bi",l:"CT done — bilateral nodules"},
                  {v:"no_imaging",l:"No adrenal imaging performed"},
                ]}/>
              </div>

              {(adnStatus==="yes_uni_r"||adnStatus==="yes_uni_l")&&(
                <div style={{marginBottom:6}}>
                  <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Largest nodule size ({adnStatus==="yes_uni_r"?"right":"left"} side, cm)</div>
                  <Inp value={adnSzMain} onChange={setAdnSzMain} placeholder="e.g. 1.5" type="number" style={{maxWidth:140}}/>
                </div>
              )}
              {adnStatus==="yes_bi"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                  <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Largest right nodule (cm)</div><Inp value={adnSzMain} onChange={setAdnSzMain} placeholder="cm" type="number"/></div>
                  <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Largest left nodule (cm)</div><Inp value={adnSzLeft} onChange={setAdnSzLeft} placeholder="cm" type="number"/></div>
                </div>
              )}

              {!isSpec&&<Chk checked={resHTN} onChange={e=>setResHTN(e.target.checked)} label="Resistant hypertension (≥3 drugs incl. diuretic)"/>}

              <div style={{fontSize:12,fontWeight:700,color:C.wh,margin:"8px 0 6px"}}>Kidney Function</div>
              <div style={{display:"flex",gap:5,marginBottom:6}}>
                {["direct","auto"].map(m=>(<button key={m} onClick={()=>setEgM(m)} style={{padding:"4px 10px",borderRadius:5,border:`1px solid ${egM===m?C.acc:C.bdr}`,background:egM===m?C.accS:"transparent",color:egM===m?C.acc:C.t2,fontSize:10,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{m==="direct"?"Enter eGFR":"Calc from Cr"}</button>))}
              </div>
              {egM==="direct"
                ?<div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>eGFR (mL/min/1.73m²)</div><Inp value={egD} onChange={setEgD} placeholder="e.g. 65" type="number" style={{maxWidth:140}}/></div>
                :(<div>
                  <div style={{display:"flex",gap:5,marginBottom:4}}>
                    {[{v:"mg",l:"mg/dL (US)"},{v:"umol",l:"µmol/L (SI)"}].map(u=>(<button key={u.v} onClick={()=>setCrUnit(u.v)} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${crUnit===u.v?C.acc:C.bdr}`,background:crUnit===u.v?C.accS:"transparent",color:crUnit===u.v?C.acc:C.t2,fontSize:10,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{u.l}</button>))}
                  </div>
                  <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Creatinine ({crUnit==="mg"?"mg/dL":"µmol/L"}) {egC&&<span style={{color:C.acc}}>→ eGFR ≈ {egC}</span>}</div>
                  <Inp value={cr} onChange={setCr} placeholder={crUnit==="mg"?"e.g. 1.0":"e.g. 88"} type="number" style={{maxWidth:140}}/>
                </div>)}

              {!latSnap&&<div style={{marginTop:8}}><Btn primary onClick={submitLat} disabled={!canLatSubmit}>Assess Lateralization</Btn></div>}
              {latSnap&&latInputsChanged&&(
                <div style={{marginTop:8,background:C.bg,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,color:C.w}}>⚠ Inputs changed since last assessment.</span>
                  <Btn small primary onClick={submitLat} style={{width:"auto"}}>Re-assess</Btn>
                </div>
              )}
            </div>
            {/* Lateralization result */}
            {lat&&(()=>{
              const noImaging=_adn==="no_imaging";

              return (<div style={{background:C.card,border:`2px solid ${lCol}33`,borderRadius:9,padding:14}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
                <span style={{fontSize:14}}>{lat.lev==="high"?"🔴":lat.lev==="low"?"🟢":"🟡"}</span>
                <Pill c={lCol} bg={lCol+"18"}>{lat.lev} probability of lateralizing primary aldosteronism</Pill>
              </div>
              {lat.hi.length>0&&<div style={{fontSize:11,color:C.t1,marginBottom:4}}><strong>Lateralizing features:</strong> {lat.hi.join(" · ")}</div>}
              {lat.lo.length>0&&<div style={{fontSize:11,color:C.t2,marginBottom:8}}><strong style={{color:C.t1}}>Bilateral features:</strong> {lat.lo.join(" · ")}</div>}

              {noImaging&&lat.lev!=="low"&&<div style={{background:C.bg,borderRadius:6,padding:10,fontSize:11,color:C.w,lineHeight:1.5,border:`1px solid ${C.w}33`,marginBottom:8}}>
                <strong>No adrenal imaging performed.</strong> {isSpec?"Adrenal CT should be arranged first to evaluate for adrenal nodules. Subsequently, adrenal venous sampling can be organized.":"A specialist can arrange adrenal CT and subsequently adrenal venous sampling (AVS) if indicated."}
              </div>}
              {noImaging&&lat.lev==="low"&&<div style={{background:C.bg,borderRadius:6,padding:10,fontSize:11,color:C.t2,lineHeight:1.5,border:`1px solid ${C.bdr}`,marginBottom:8}}>
                No adrenal imaging has been performed. Given the low probability of lateralizing disease, <strong>adrenal CT is not specifically recommended by guidelines</strong> — this patient can be managed medically.
              </div>}

              {egfr<30&&(<Box type="red" title={`eGFR = ${Math.round(egfr)}`}>
                eGFR is below 30 mL/min/1.73m². Neither spironolactone initiation nor surgical intervention is recommended at this time. <strong>Refer to a nephrology centre for evaluation of kidney dysfunction</strong> prior to further primary aldosteronism management.
              </Box>)}

              {lat.lev==="low"&&egOk&&!highK&&(<div style={{marginTop:8,fontSize:10,color:C.t3,lineHeight:1.5,background:C.bg,padding:8,borderRadius:5,border:`1px solid ${C.bdr}`}}>
                <strong style={{color:C.t2}}>Monitoring notes:</strong> Gynecomastia from spironolactone is dose-related (consider ≤50 mg or switch to eplerenone if occurs). GFR may dip early — usually reflects treatment efficacy. High-salt diet is the #1 cause of apparent non-response.
              </div>)}
            </div>);
            })()}

            {/* ═══ Section 3: Initial Management ═══ */}
            {lat&&egfr>=30&&(()=>{
              const noImaging=_adn==="no_imaging";
              const isUni=_adn==="yes_uni_r"||_adn==="yes_uni_l";
              const uniSz=parseFloat(_adnSzMain)||0;
              const canBypassAvs=isSpec&&isUnder35&&hypoK&&isUni&&uniSz>1.0;
              const wantsSurg=_surgCandidate==="yes"&&_surgInterest==="yes";
              const noSurg=_surgCandidate==="no"||_surgInterest==="no";

              return (<>
              {isSpec&&(lat.lev==="high"||lat.lev==="intermediate")&&<SectionHead number={3} title="Initial Management" active={true}/>}

              {isSpec&&(lat.lev==="high"||lat.lev==="intermediate")&&(
                <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Surgical Candidacy</div>
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Is the patient a surgical candidate?</div>
                    <div style={{display:"flex",gap:5}}>
                      {[{v:"yes",l:"Yes"},{v:"no",l:"No"}].map(o=>(<button key={o.v} onClick={()=>{setSurgCandidate(o.v);if(o.v==="no"){setSurgInterest("");setForegoAvs("");}}} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${surgCandidate===o.v?C.acc:C.bdr}`,background:surgCandidate===o.v?C.accS:"transparent",color:surgCandidate===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
                    </div>
                  </div>
                  {surgCandidate==="yes"&&(
                    <div style={{marginBottom:6}}>
                      <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Is the patient interested in surgery for potential cure?</div>
                      <div style={{display:"flex",gap:5}}>
                        {[{v:"yes",l:"Yes"},{v:"no",l:"No"}].map(o=>(<button key={o.v} onClick={()=>{setSurgInterest(o.v);if(o.v==="no")setForegoAvs("");}} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${surgInterest===o.v?C.acc:C.bdr}`,background:surgInterest===o.v?C.accS:"transparent",color:surgInterest===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
                      </div>
                    </div>
                  )}
                  {lat.lev==="intermediate"&&wantsSurg&&(
                    <div style={{marginTop:6}}>
                      <div style={{fontSize:10,color:C.t2,marginBottom:2}}>The probability of lateralization is intermediate. How would you like to proceed?</div>
                      <div style={{display:"flex",gap:5}}>
                        {[{v:"avs",l:noImaging?"Lateralization workup (CT then AVS)":"Lateralization workup (AVS)"},{v:"medical",l:"Treat medically"}].map(o=>(<button key={o.v} onClick={()=>setSpecAvsDecision(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${specAvsDecision===o.v?C.acc:C.bdr}`,background:specAvsDecision===o.v?C.accS:"transparent",color:specAvsDecision===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
                      </div>
                    </div>
                  )}
                  {lat.lev==="high"&&wantsSurg&&canBypassAvs&&(
                    <div style={{marginTop:6,background:C.wS,borderRadius:6,padding:10}}>
                      <div style={{fontSize:11,color:C.w,fontWeight:700,marginBottom:4}}>⚡ AVS Bypass Eligible</div>
                      <div style={{fontSize:11,color:C.t1,marginBottom:6}}>This patient is under 35 years old with hypokalemia and a unilateral adrenal adenoma &gt;1 cm. Per guidelines, adrenal venous sampling may be bypassed and the patient may proceed directly to surgery.</div>
                      <div style={{display:"flex",gap:5}}>
                        {[{v:"direct_surgery",l:"Proceed directly to surgery"},{v:"do_avs",l:"Still perform AVS first"}].map(o=>(<button key={o.v} onClick={()=>setForegoAvs(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${foregoAvs===o.v?C.acc:C.bdr}`,background:foregoAvs===o.v?C.accS:"transparent",color:foregoAvs===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isSpec&&(lat.lev==="high"||lat.lev==="intermediate")&&!mgmtSnap&&(
                <div style={{marginBottom:10}}><Btn primary onClick={submitMgmt} disabled={!surgCandidate||(surgCandidate==="yes"&&!surgInterest)||(lat.lev==="intermediate"&&surgCandidate==="yes"&&surgInterest==="yes"&&!specAvsDecision)||(lat.lev==="high"&&surgCandidate==="yes"&&surgInterest==="yes"&&canBypassAvs&&!foregoAvs)}>Submit Management Plan</Btn></div>
              )}
              {isSpec&&mgmtSnap&&mgmtInputsChanged&&(
                <div style={{marginBottom:10,background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,color:C.w}}>⚠ Management selections changed.</span>
                  <Btn small primary onClick={submitMgmt} style={{width:"auto"}}>Re-submit</Btn>
                </div>
              )}

              {(!isSpec||lat.lev==="low"||mgmtSnap)&&(
              <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14}}>
                <div style={{fontSize:11,fontWeight:800,color:C.acc,textTransform:"uppercase",letterSpacing:.3,marginBottom:6}}>Next Steps</div>

                {lat.lev==="low"&&(<div style={{fontSize:12,color:C.t1,lineHeight:1.7}}>
                  <p style={{margin:"0 0 4px"}}>Low probability of lateralizing disease → likely bilateral primary aldosteronism.</p>
                  {highK?(<div style={{color:C.r,fontSize:12}}>⚠ Potassium is {_kV} mmol/L (&gt;4.8). Starting spironolactone may worsen hyperkalemia. {isSpec?"Consider alternative approaches or close monitoring.":"Refer to specialist to discuss treatment options."}</div>)
                  :(<>
                    <div style={{fontWeight:700,color:C.g}}>✅ Start Spironolactone</div>
                    <ul style={{paddingLeft:16,margin:"3px 0 6px",fontSize:11}}>
                      <li><strong>Start spironolactone 12.5 mg daily</strong></li>
                      <li>Stop potassium supplements at day 2–4 of initiation</li>
                      <li>Counsel on dietary sodium restriction (&lt;2 g/day sodium)</li>
                      <li><strong>Check electrolytes (K⁺) and creatinine at 2 weeks</strong> to ensure potassium is safe</li>
                      <li>Recheck BP, electrolytes, and creatinine at 2–3 months</li>
                      <li>If BP not controlled, increase to spironolactone 25 mg daily → recheck lytes/Cr at 2 weeks</li>
                      <li>Continue titrating in 12.5–25 mg increments every 8–12 weeks as needed, with lytes/Cr 2 weeks after each change</li>
                      <li>Target: BP control. Most patients require 25–50 mg/day.</li>
                    </ul>
                    {!isSpec&&<div style={{color:C.acc,fontSize:11}}>📋 Consider specialist referral for ongoing management</div>}
                    {!isSpec&&_resHTN&&<div style={{fontSize:11,color:C.w,marginBottom:4}}>⚠ Resistant hypertension present — consider concurrent specialist referral given complexity of management.</div>}
                  </>)}
                </div>)}

                {lat.lev==="intermediate"&&(<div style={{fontSize:12,color:C.t1,lineHeight:1.7}}>
                  {isSpec?(<>
                    {noSurg&&(<><div style={{fontWeight:700,color:C.acc}}>📋 Medical Therapy</div><p style={{margin:"3px 0"}}>Patient is not a surgical candidate or does not desire surgery. Proceed with medical management with spironolactone.</p></>)}
                    {wantsSurg&&_specAvsDecision==="avs"&&(<><div style={{fontWeight:700,color:C.w}}>📋 Lateralization Workup</div><p style={{margin:"3px 0"}}>{noImaging?"Adrenal CT will be arranged first to evaluate adrenal anatomy. Subsequently, adrenal":"Adrenal"} venous sampling will then be organized to determine if disease is unilateral and amenable to surgical cure.</p></>)}
                    {wantsSurg&&_specAvsDecision==="medical"&&(<><div style={{fontWeight:700,color:C.acc}}>📋 Medical Therapy Preferred</div><p style={{margin:"3px 0"}}>Despite intermediate lateralization probability, the decision is to proceed with medical management.</p></>)}
                  </>):(<>
                    <div style={{fontWeight:700,color:C.w}}>📋 Refer to Specialist</div>
                    <p style={{margin:"3px 0"}}>Intermediate probability of lateralizing disease. A specialist can determine if{noImaging?" adrenal CT and subsequently":""} adrenal venous sampling is warranted to assess for surgical candidacy.</p>
                  </>)}
                </div>)}

                {lat.lev==="high"&&(<div style={{fontSize:12,color:C.t1,lineHeight:1.7}}>
                  {isSpec?(<>
                    {noSurg&&(<><div style={{fontWeight:700,color:C.acc}}>📋 Medical Therapy</div><p style={{margin:"3px 0"}}>Despite high probability of lateralizing disease, the patient is not a surgical candidate or does not desire surgery. Proceed with lifelong medical management with spironolactone.</p></>)}
                    {wantsSurg&&(<><div style={{fontWeight:700,color:C.r}}>📋 Lateralization Workup</div>
                      {canBypassAvs&&_foregoAvs==="direct_surgery"?<p style={{margin:"3px 0"}}>Given patient age &lt;35, hypokalemia, and unilateral adenoma &gt;1 cm, the decision is to proceed directly to unilateral adrenalectomy without adrenal venous sampling, as permitted by guidelines.</p>
                      :canBypassAvs&&_foregoAvs==="do_avs"?<p style={{margin:"3px 0"}}>Despite eligibility to bypass AVS, the decision is to proceed with adrenal venous sampling to confirm lateralization prior to surgery.</p>
                      :<p style={{margin:"3px 0"}}>High probability of lateralizing disease — potentially curable with adrenalectomy. {noImaging?"Adrenal CT will be arranged first to evaluate adrenal anatomy. Subsequently, adrenal":"Adrenal"} venous sampling will be organized to confirm lateralization prior to surgical planning.</p>}
                    </>)}
                  </>):(<>
                    <div style={{fontWeight:700,color:C.r}}>📋 Refer to Specialist</div>
                    <p style={{margin:"3px 0"}}>High probability of lateralizing primary aldosteronism — potentially curable with surgery. A specialist can arrange {noImaging?"adrenal CT first, followed by ":""}adrenal venous sampling to confirm lateralization.</p>
                    {isUnder35&&isUni&&uniSz>1.0&&hypoK&&<p style={{margin:"3px 0",color:C.w,fontSize:11}}>⚡ Age &lt;35 with hypokalemia and unilateral adenoma &gt;1cm: adrenal venous sampling may be bypassed per guideline.</p>}
                  </>)}
                </div>)}
              </div>
              )}
              </>);
            })()}
          </>)}

          {/* ── NEGATIVE ── */}
          {!pos&&canGo&&(<>
            {/* Primary result — distinct styling */}
            <div style={{background:C.accS,border:`2px solid ${C.acc}`,borderRadius:9,padding:14,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:16}}>🔵</span>
                <div style={{fontSize:15,fontWeight:800,color:C.wh}}>Screen Does Not Meet All Primary Aldosteronism Criteria</div>
              </div>
              <div style={{fontSize:12,color:C.t1,lineHeight:1.5}}>
                {!renSup&&<div>• Renin not suppressed ({_rV} {ren.u}; cutoff ≤{ren.sup} {ren.u})</div>}
                {!aldHi&&<div>• Aldo not elevated ({_aV} {ald.u}; cutoff ≥{ald.min} {ald.u})</div>}
                {!arrHi&&<div>• ARR not elevated ({arrVal?.toFixed(1)??"—"}; cutoff &gt;{arrTh})</div>}
              </div>
            </div>

            {/* Secondary notes — medication & K⁺ — lighter card styling */}
            {hypoK && (
              <div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:12,marginBottom:8,fontSize:12,color:C.t1,lineHeight:1.6}}>
                <div style={{fontSize:11,fontWeight:700,color:C.w,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>⚠ Potassium Note — K⁺ = {_kV} mmol/L</div>
                Hypokalemia can <strong>falsely lower aldosterone</strong>, potentially masking primary aldosteronism. <strong>Correct potassium to normal range and repeat screening.</strong> This is especially important if the patient has other risk factors for primary aldosteronism (resistant HTN, adrenal incidentaloma, etc.).
              </div>
            )}

            {fn.length > 0 && clearlyNegative && (
              <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:8,padding:12,marginBottom:8,fontSize:12,color:C.t1,lineHeight:1.6}}>
                <div style={{fontSize:11,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Medication Note</div>
                This patient is on medications that can cause false-negative primary aldosteronism screening:
                {strongFN.length > 0 && (<div style={{marginTop:4}}>• <strong>Strongly interfering:</strong> {strongFN.map(d=>d.label.split(" (")[0]).join(", ")} — significantly raise renin and/or aldosterone</div>)}
                {weakFN.length > 0 && (<div style={{marginTop:2}}>• <strong>Weakly interfering:</strong> {weakFN.map(d=>d.label.split(" (")[0]).join(", ")} — modest effect on renin/aldosterone</div>)}
                <div style={{marginTop:6}}>However, the results are <strong>well below primary aldosteronism thresholds</strong> (aldosterone {_aV} {ald.u} vs. cutoff {ald.min} {ald.u}; ARR {arrVal?.toFixed(1)??"—"} vs. cutoff {arrTh}). Primary aldosteronism is unlikely even accounting for medication interference. <strong>Withdrawing medications to retest is not warranted</strong> at this time.</div>
              </div>
            )}
            {nearThreshold && nearMeds.length > 0 && (
              <div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:12,marginBottom:8,fontSize:12,color:C.t1,lineHeight:1.6}}>
                <div style={{fontSize:11,fontWeight:700,color:C.w,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>⚠ Medication Alert</div>
                This patient is on interfering medications and the results are <strong>close to primary aldosteronism thresholds</strong> (aldosterone {_aV} {ald.u} vs. cutoff {ald.min} {ald.u}; renin suppressed at {_rV} {ren.u}) — a true positive may be masked.
                {nearMeds.some(d => d.strength === "strong" || d.strength === "intermediate") && (<div style={{marginTop:4}}>• <strong>Strongly interfering:</strong> {nearMeds.filter(d=>d.strength==="strong"||d.strength==="intermediate").map(d=>d.label.split(" (")[0]).join(", ")}</div>)}
                {nearMeds.some(d => d.strength === "weak") && (<div style={{marginTop:2}}>• <strong>Weakly interfering:</strong> {nearMeds.filter(d=>d.strength==="weak").map(d=>d.label.split(" (")[0]).join(", ")}</div>)}
                <div style={{marginTop:6}}>
                  <strong>Withdrawal plan for interfering medications:</strong>
                  <ul style={{paddingLeft:16,margin:"4px 0 0"}}>
                    {nearMeds.map(d => (<li key={d.id}>{d.label.split(" (")[0]} <span style={{color:C.t3}}>({d.strength === "strong" || d.strength === "intermediate" ? "strong" : "weak"} interferor)</span>: withdraw for <strong>{d.woUncertain ? `~${d.wo} weeks (timeline not well-defined)` : `${d.wo} weeks`}</strong> before retesting</li>))}
                  </ul>
                </div>
                <div style={{marginTop:4,fontSize:11,color:C.t2}}>Safe replacement agents during washout: alpha-1 blockers (e.g. doxazosin, prazosin), non-DHP CCBs (e.g. verapamil SR, diltiazem), hydralazine, moxonidine.</div>
                <div style={{marginTop:6,fontWeight:700,color:C.acc}}>📋 Consider referral to specialist to safely manage medication withdrawal and retesting.</div>
              </div>
            )}

            {/* Suppressed renin with borderline aldo, no FN meds */}
            {renSup && aldNg && ((ald.isIA && aldNg >= 5 && aldNg < 10) || (!ald.isIA && aldNg >= 3.75 && aldNg < 7.5)) && fn.length === 0 && !hypoK && (
              <div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:12,marginBottom:8,fontSize:12,color:C.t1,lineHeight:1.6}}>
                <div style={{fontSize:11,fontWeight:700,color:C.w,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>⚠ Borderline Result</div>
                Renin is suppressed ({_rV} {ren.u}) but aldosterone ({_aV} {ald.u}) is below the screening threshold. This pattern warrants <strong>repeat testing on a different day</strong>, especially if pretest probability is moderate to high.
              </div>
            )}

            <div style={{background:C.bg,borderRadius:6,padding:10,fontSize:11,color:C.t2,lineHeight:1.5,border:`1px solid ${C.bdr}`,marginTop:6}}>
              <strong style={{color:C.t1}}>Rescreen if:</strong> worsening/resistant HTN, new hypokalemia, or unexplained AFib.
            </div>
          </>)}
        </>);
      })()}

      {/* Clinical Note — only show when all required sections are submitted */}
      {(()=>{
        // Gate: for positive screen, need latSnap. For specialist intermediate/high, also need mgmtSnap.
        if(pos&&!latSnap) return null;
        if(pos&&latSnap&&isSpec&&lat&&(lat.lev==="high"||lat.lev==="intermediate")&&!mgmtSnap) return null;
        // For negative screen, note always shows after interpret
        const medList=allM.map(d=>d.label.split(" (")[0]).join(", ");
        const sexWord=_sex==="M"?"male":"female";
        const ageLabel=_age==="21"?"18-24":_age==="30"?"25-34":_age==="42"?"35-49":_age==="57"?"50-64":_age==="72"?"65-79":"80+";
        const fpList=fp.map(d=>d.label.split(" (")[0]).join(", ");
        const fnList=fn.map(d=>d.label.split(" (")[0]).join(", ");
        
        let note=`Assessment:\nThis ${sexWord} patient (age ${ageLabel}) was screened for primary aldosteronism. Screening labs showed a renin of ${_rV} ${ren.u} (suppressed ≤${ren.sup}), aldosterone of ${_aV} ${ald.u} (elevated ≥${ald.min}), and an aldosterone-to-renin ratio (ARR) of ${arrVal?.toFixed(1)??"—"} (elevated >${arrTh}). Potassium was ${_kV} mmol/L. `;
        if(medList) note+=`The patient is on the following relevant medications: ${medList}. `;

        if(pos){
          note+=`The screen is positive for primary aldosteronism, meeting all three criteria: suppressed renin, elevated aldosterone, and elevated ARR. `;
          if(fp.length>0){
            note+=`Of note, the patient is taking ${fpList}, which lower renin and could contribute to a false-positive result. `;
            if(aldIA&&aldIA>15) note+=`However, the aldosterone level is well above the threshold where false positives from these agents are expected, making primary aldosteronism likely despite their use. `;
            else note+=`Given the borderline aldosterone level, a false positive cannot be excluded, and retesting after medication withdrawal should be considered. `;
          }
          if(hypoK) note+=`Hypokalemia is present, which is a feature of more severe primary aldosteronism. `;
          
          if(lat){
            const noImg=_adn==="no_imaging";
            const isUniNote=_adn==="yes_uni_r"||_adn==="yes_uni_l";
            const uniSzNote=parseFloat(_adnSzMain)||0;
            const canBypassNote=isUnder35&&hypoK&&isUniNote&&uniSzNote>1.0;
            const wantsSurgNote=_surgCandidate==="yes"&&_surgInterest==="yes";
            const noSurgNote=_surgCandidate==="no"||_surgInterest==="no";

            // eGFR in assessment
            if(egfr&&egfr<30){
              note+=`\n\neGFR is below 30 mL/min/1.73m². Given the degree of kidney dysfunction, neither spironolactone initiation nor surgical intervention is recommended at this time. Referral to nephrology is indicated for evaluation of kidney function prior to further primary aldosteronism management.`;
              note+=`\n\nPlan:\n`;
              note+=`- Refer to nephrology for evaluation of kidney dysfunction\n`;
              note+=`- Defer primary aldosteronism-specific therapy until renal status is clarified`;
            } else if(isSpec){
              // ── SPECIALIST NOTE ──
              note+=`\n\nRegarding lateralization, the probability of unilateral (lateralizing) disease is assessed as ${lat.lev}. `;
              if(lat.hi.length>0) note+=`Features favoring lateralization include: ${lat.hi.join(", ").toLowerCase()}. `;
              if(lat.lo.length>0) note+=`Features arguing against lateralization include: ${lat.lo.join(", ").toLowerCase()}. `;
              if(lat.lev==="low"){
                note+=`Given the low probability of unilateral disease, this patient most likely has bilateral primary aldosteronism. `;
                if(noImg) note+=`Adrenal CT is not specifically recommended by guidelines in this setting. `;
                note+=`Medical management with a mineralocorticoid receptor antagonist is the appropriate first-line approach, and adrenal venous sampling is not indicated.`;
              } else if(lat.lev==="intermediate"){
                note+=`With an intermediate probability, it is uncertain whether the disease is unilateral or bilateral. `;
                if(noImg) note+=`No adrenal imaging has been performed to date. `;
                if(wantsSurgNote&&_specAvsDecision==="avs"){
                  note+=`The patient is a surgical candidate and desires surgery if lateralization is confirmed. ${noImg?"Adrenal CT will be arranged first to evaluate adrenal anatomy. Subsequently, adrenal":"Adrenal"} venous sampling will then be organized to clarify lateralization, acknowledging that the probability of finding unilateral disease is intermediate.`;
                } else if(wantsSurgNote&&_specAvsDecision==="medical"){
                  note+=`Although the patient is a surgical candidate and interested in surgery, the decision has been made to proceed with medical management given the intermediate probability of lateralization.`;
                } else if(noSurgNote){
                  note+=`The patient is not a surgical candidate or does not desire surgery. Medical management is indicated.`;
                }
              } else if(lat.lev==="high"){
                note+=`With a high probability of unilateral disease, this patient may be a candidate for surgical cure via adrenalectomy. `;
                if(noImg) note+=`No adrenal imaging has been performed to date. `;
                if(wantsSurgNote){
                  if(canBypassNote&&_foregoAvs==="direct_surgery"){
                    note+=`The patient is under 35 years old with hypokalemia and a unilateral adenoma greater than 1 cm. Per guidelines, adrenal venous sampling may be bypassed. The decision has been made to proceed directly to unilateral adrenalectomy.`;
                  } else if(canBypassNote&&_foregoAvs==="do_avs"){
                    note+=`The patient is a surgical candidate and desires surgery. Despite eligibility to bypass adrenal venous sampling (age <35, hypokalemia, unilateral adenoma >1 cm), the decision is to proceed with AVS to confirm lateralization prior to surgery.`;
                  } else {
                    note+=`The patient is a surgical candidate and desires surgery. ${noImg?"Adrenal CT will be arranged first to evaluate adrenal anatomy. Subsequently, adrenal":"Adrenal"} venous sampling will be organized to confirm lateralization prior to surgical planning.`;
                  }
                } else if(noSurgNote){
                  note+=`Despite the high probability of lateralization, the patient is not a surgical candidate or does not desire surgery. Lifelong medical management is indicated.`;
                }
              }
              
              note+=`\n\nPlan:\n`;
              if(lat.lev==="low"&&!highK){
                note+=`- Start spironolactone 12.5 mg daily\n`;
                note+=`- Discontinue potassium supplements within 2 to 4 days of initiation\n`;
                note+=`- Dietary sodium restriction (<2 g/day)\n`;
                note+=`- Check electrolytes and creatinine at 2 weeks to ensure potassium is safe\n`;
                note+=`- Full reassessment of blood pressure, electrolytes, and creatinine at 2 to 3 months\n`;
                note+=`- If blood pressure remains uncontrolled, titrate spironolactone upward in 12.5 to 25 mg increments every 8 to 12 weeks, with electrolytes and creatinine rechecked 2 weeks after each dose change`;
              } else if(lat.lev==="low"&&highK){
                note+=`- Potassium is ${_kV} mmol/L (above 4.8) — will need to address hyperkalemia before initiating mineralocorticoid receptor antagonist therapy`;
              } else if(lat.lev==="intermediate"){
                if(wantsSurgNote&&_specAvsDecision==="avs"){
                  if(noImg) note+=`- Arrange adrenal CT first to evaluate adrenal anatomy\n`;
                  note+=`- Arrange adrenal venous sampling to clarify lateralization`;
                } else if(noSurgNote||(wantsSurgNote&&_specAvsDecision==="medical")){
                  note+=`- Start spironolactone 12.5 mg daily\n`;
                  note+=`- Discontinue potassium supplements within 2 to 4 days of initiation\n`;
                  note+=`- Dietary sodium restriction (<2 g/day)\n`;
                  note+=`- Check electrolytes and creatinine at 2 weeks\n`;
                  note+=`- Full reassessment at 2 to 3 months`;
                }
              } else if(lat.lev==="high"){
                if(wantsSurgNote){
                  if(canBypassNote&&_foregoAvs==="direct_surgery"){
                    note+=`- Proceed directly to unilateral adrenalectomy (AVS bypassed per guideline)\n`;
                    note+=`- Surgical planning and pre-operative assessment to be arranged`;
                  } else {
                    if(noImg) note+=`- Arrange adrenal CT first to evaluate adrenal anatomy\n`;
                    note+=`- Arrange adrenal venous sampling to confirm lateralization\n`;
                    note+=`- If lateralization confirmed, proceed with surgical planning for unilateral adrenalectomy`;
                  }
                } else if(noSurgNote){
                  note+=`- Start spironolactone 12.5 mg daily (lifelong medical management)\n`;
                  note+=`- Discontinue potassium supplements within 2 to 4 days of initiation\n`;
                  note+=`- Dietary sodium restriction (<2 g/day)\n`;
                  note+=`- Check electrolytes and creatinine at 2 weeks\n`;
                  note+=`- Full reassessment at 2 to 3 months`;
                }
              }
            } else {
              // ── PCP NOTE ──
              note+=`\n\nBased on the clinical features, the probability of unilateral (lateralizing) disease is assessed as ${lat.lev}. `;
              if(lat.lev==="low"){
                note+=`This patient most likely has bilateral primary aldosteronism and can be managed with medical therapy.`;
              } else {
                note+=`Further evaluation by a specialist is recommended to determine whether the patient may be a candidate for surgical management.`;
              }
              
              note+=`\n\nPlan:\n`;
              if(lat.lev==="low"&&!highK){
                note+=`- Start spironolactone 12.5 mg daily\n`;
                note+=`- Discontinue potassium supplements within 2 to 4 days of initiation\n`;
                note+=`- Dietary sodium restriction (<2 g/day)\n`;
                note+=`- Check electrolytes and creatinine at 2 weeks to ensure potassium is safe\n`;
                note+=`- Full reassessment of blood pressure, electrolytes, and creatinine at 2 to 3 months\n`;
                note+=`- If blood pressure remains uncontrolled, titrate spironolactone upward in 12.5 to 25 mg increments every 8 to 12 weeks, with electrolytes and creatinine rechecked 2 weeks after each dose change\n`;
                note+=`- Specialist referral for ongoing management of primary aldosteronism`;
                if(_resHTN) note+=`\n- Resistant hypertension present — specialist referral particularly important`;
              } else if(lat.lev==="low"&&highK){
                note+=`- Potassium is ${_kV} mmol/L (above 4.8), raising concern for hyperkalemia with mineralocorticoid receptor antagonist therapy\n`;
                note+=`- Refer to specialist to discuss treatment options prior to initiating therapy`;
              } else {
                note+=`- Refer to specialist for further evaluation and management`;
              }
            }
          }
        } else {
          note+=`The screen does not meet all three criteria for primary aldosteronism. `;
          const missing=[];
          if(!renSup) missing.push(`renin is not suppressed (${_rV} ${ren.u})`);
          if(!aldHi) missing.push(`aldosterone is not elevated (${_aV} ${ald.u})`);
          if(!arrHi) missing.push(`ARR is not elevated (${arrVal?.toFixed(1)??"—"})`);
          note+=`Specifically, ${missing.join(", and ")}. `;
          
          if(fn.length>0&&nearThreshold){
            note+=`Importantly, the patient is on ${nearMeds.map(d=>d.label.split(" (")[0]).join(", ")}, which can cause false-negative results by raising renin and/or lowering aldosterone. The results are near the diagnostic threshold, and a true positive may be masked by these medications. `;
          } else if(fn.length>0&&clearlyNegative){
            note+=`The patient is on ${fnList}, which can theoretically cause false-negative results. However, the values are well below the diagnostic thresholds, making primary aldosteronism unlikely even accounting for medication interference. `;
          }
          if(hypoK) note+=`Hypokalemia is present (K⁺ ${_kV} mmol/L), which can falsely lower aldosterone. `;
          
          note+=`\n\nPlan:\n`;
          if(hypoK){
            note+=`- Correct potassium to normal range\n`;
            note+=`- Repeat primary aldosteronism screening once potassium is corrected, as hypokalemia may have masked a true positive result`;
          } else if(nearThreshold&&nearMeds.length>0){
            note+=`- Consider withdrawing interfering medications and retesting\n`;
            note+=`- ${isSpec?"Arrange repeat screening after medication washout":"Refer to specialist if needed to facilitate safe medication withdrawal and repeat screening"}`;
          } else {
            note+=`- No primary aldosteronism-specific treatment indicated at this time\n`;
            note+=`- Rescreen if patient develops worsening or resistant hypertension, new spontaneous or diuretic-induced hypokalemia, or unexplained atrial fibrillation`;
          }
        }
        logData(isSpec?"tool_specialist_consult":"tool_pcp_interpret",{age_range:_age,sex:_sex,renin_suppressed:renSup||false,aldo_elevated:aldHi||false,lateralization:lat?lat.lev:"none"});
        return <CopyNote text={note}/>;
      })()}

      <div style={{textAlign:"center",marginTop:14}}>
        <Btn small onClick={()=>{setPhase("input");setSnap(null);setLatSnap(null);setMgmtSnap(null);setRV("");setAV("");setKV("");setAdnStatus("");setAdnSzMain("");setAdnSzLeft("");setCr("");setEgD("");setAge("");setSex("");setResHTN(false);setSurgCandidate("");setSurgInterest("");setSpecAvsDecision("");setForegoAvs("");}}>🔄 New Patient</Btn>
      </div>
    </div>}

    <p style={{fontSize:9,color:C.t3,textAlign:"center",marginTop:16}}>Adapted from: Adler GK et al., JCEM 2025. DOI:10.1210/clinem/dgaf284. Educational only.</p>
  </>;
}


// ═══════════════════════════════════════
// TOOL 4: TITRATE MEDICAL THERAPY
// ═══════════════════════════════════════

// ─── Antihypertensive Drug Database ───
const ANTI_HTN=[
  // MRAs
  {id:"spiro",name:"Spironolactone",cls:"mra",kw:["spironolactone","aldactone"],steps:[12.5,25,50,75,100],freq:"daily",unit:"mg"},
  {id:"epler",name:"Eplerenone",cls:"mra",kw:["eplerenone","inspra"],steps:[25,50,75,100,150,200],freq:"BID",unit:"mg"},
  // Thiazides
  {id:"chlor",name:"Chlorthalidone",cls:"thiazide",kw:["chlorthalidone","thalitone"],steps:[12.5,25],freq:"daily",unit:"mg"},
  {id:"hctz",name:"HCTZ",cls:"thiazide",kw:["hctz","hydrochlorothiazide"],steps:[12.5,25],freq:"daily",unit:"mg"},
  {id:"indap",name:"Indapamide",cls:"thiazide",kw:["indapamide","lozide","lozol"],steps:[1.25,2.5],freq:"daily",unit:"mg"},
  // Priority 1: vasodilators, nitrates, alpha-blockers
  {id:"hydral",name:"Hydralazine",cls:"p1",kw:["hydralazine","apresoline"],steps:[10,25,50,75,100],freq:"TID",unit:"mg"},
  {id:"isdn",name:"Isosorbide dinitrate",cls:"p1",kw:["isosorbide dinitrate","isdn","isordil"],steps:[10,20,30,40],freq:"TID",unit:"mg"},
  {id:"ismn",name:"Isosorbide mononitrate",cls:"p1",kw:["isosorbide mononitrate","ismn","imdur"],steps:[30,60,120],freq:"daily",unit:"mg"},
  {id:"ntg",name:"Nitroglycerin patch",cls:"p1",kw:["nitroglycerin","ntg","nitro-dur","nitro patch","minitran"],steps:[0.2,0.4,0.6,0.8],freq:"daily",unit:"mg/h"},
  {id:"doxaz",name:"Doxazosin",cls:"p1",kw:["doxazosin","cardura"],steps:[1,2,4,8,16],freq:"daily",unit:"mg"},
  {id:"praz",name:"Prazosin",cls:"p1",kw:["prazosin","minipress"],steps:[1,2,5,10],freq:"BID-TID",unit:"mg"},
  {id:"teraz",name:"Terazosin",cls:"p1",kw:["terazosin","hytrin"],steps:[1,2,5,10,20],freq:"daily",unit:"mg"},
  // Priority 2: beta-blockers
  {id:"metop",name:"Metoprolol",cls:"bb",kw:["metoprolol","lopressor","toprol","betaloc"],steps:[12.5,25,50,100,200],freq:"daily-BID",unit:"mg"},
  {id:"aten",name:"Atenolol",cls:"bb",kw:["atenolol","tenormin"],steps:[25,50,100],freq:"daily",unit:"mg"},
  {id:"bisop",name:"Bisoprolol",cls:"bb",kw:["bisoprolol","monocor"],steps:[1.25,2.5,5,10],freq:"daily",unit:"mg"},
  {id:"carv",name:"Carvedilol",cls:"bb",kw:["carvedilol","coreg"],steps:[3.125,6.25,12.5,25],freq:"BID",unit:"mg"},
  {id:"prop",name:"Propranolol",cls:"bb",kw:["propranolol","inderal"],steps:[10,20,40,80,120,160],freq:"BID-TID",unit:"mg"},
  {id:"neb",name:"Nebivolol",cls:"bb",kw:["nebivolol","bystolic"],steps:[1.25,2.5,5,10,20],freq:"daily",unit:"mg"},
  {id:"lab",name:"Labetalol",cls:"bb",kw:["labetalol","trandate"],steps:[100,200,300,400,600],freq:"BID",unit:"mg"},
  // Priority 3: DHP-CCBs
  {id:"amlod",name:"Amlodipine",cls:"dhp_ccb",kw:["amlodipine","norvasc"],steps:[2.5,5,10],freq:"daily",unit:"mg"},
  {id:"nifed",name:"Nifedipine XL",cls:"dhp_ccb",kw:["nifedipine","adalat","procardia"],steps:[20,30,60,90],freq:"daily",unit:"mg"},
  {id:"felod",name:"Felodipine",cls:"dhp_ccb",kw:["felodipine","plendil"],steps:[2.5,5,10],freq:"daily",unit:"mg"},
  // Priority 4a: ACEi
  {id:"lisin",name:"Lisinopril",cls:"acei",kw:["lisinopril","zestril","prinivil"],steps:[2.5,5,10,20,40],freq:"daily",unit:"mg"},
  {id:"rami",name:"Ramipril",cls:"acei",kw:["ramipril","altace"],steps:[1.25,2.5,5,10],freq:"daily",unit:"mg"},
  {id:"enal",name:"Enalapril",cls:"acei",kw:["enalapril","vasotec"],steps:[2.5,5,10,20],freq:"daily-BID",unit:"mg"},
  {id:"perin",name:"Perindopril",cls:"acei",kw:["perindopril","coversyl"],steps:[2,4,8],freq:"daily",unit:"mg"},
  {id:"quin",name:"Quinapril",cls:"acei",kw:["quinapril","accupril"],steps:[5,10,20,40],freq:"daily",unit:"mg"},
  // Priority 4b: ARBs
  {id:"vals",name:"Valsartan",cls:"arb",kw:["valsartan","diovan"],steps:[40,80,160,320],freq:"daily",unit:"mg"},
  {id:"cand",name:"Candesartan",cls:"arb",kw:["candesartan","atacand"],steps:[4,8,16,32],freq:"daily",unit:"mg"},
  {id:"telm",name:"Telmisartan",cls:"arb",kw:["telmisartan","micardis"],steps:[20,40,80],freq:"daily",unit:"mg"},
  {id:"losa",name:"Losartan",cls:"arb",kw:["losartan","cozaar"],steps:[25,50,100],freq:"daily",unit:"mg"},
  {id:"irbe",name:"Irbesartan",cls:"arb",kw:["irbesartan","avapro"],steps:[75,150,300],freq:"daily",unit:"mg"},
  {id:"olme",name:"Olmesartan",cls:"arb",kw:["olmesartan","benicar","olmetec"],steps:[5,20,40],freq:"daily",unit:"mg"},
  // Other
  {id:"cloni",name:"Clonidine",cls:"other",kw:["clonidine","catapres"],steps:[0.1,0.2,0.3],freq:"BID",unit:"mg"},
  {id:"verap",name:"Verapamil",cls:"nondhp_ccb",kw:["verapamil","isoptin","calan"],steps:[120,180,240,360],freq:"daily-BID",unit:"mg"},
  {id:"dilt",name:"Diltiazem",cls:"nondhp_ccb",kw:["diltiazem","cardizem","tiazac"],steps:[120,180,240,360],freq:"daily",unit:"mg"},
  {id:"furos",name:"Furosemide",cls:"loop",kw:["furosemide","lasix"],steps:[20,40,80,120],freq:"daily-BID",unit:"mg"},
  {id:"bumet",name:"Bumetanide",cls:"loop",kw:["bumetanide","bumex"],steps:[0.5,1,2],freq:"daily-BID",unit:"mg"},
  {id:"empa",name:"Empagliflozin",cls:"sglt2",kw:["empagliflozin","jardiance"],steps:[10,25],freq:"daily",unit:"mg"},
  {id:"dapa",name:"Dapagliflozin",cls:"sglt2",kw:["dapagliflozin","farxiga","forxiga"],steps:[5,10],freq:"daily",unit:"mg"},
  {id:"cana",name:"Canagliflozin",cls:"sglt2",kw:["canagliflozin","invokana"],steps:[100,300],freq:"daily",unit:"mg"},
  {id:"minox",name:"Minoxidil",cls:"p1",kw:["minoxidil","loniten"],steps:[2.5,5,10,20,40],freq:"daily-BID",unit:"mg"},
];

const CLS_LABEL={mra:"MRA",thiazide:"Thiazide Diuretic",p1:"Vasodilator / Alpha-blocker / Nitrate",bb:"Beta-blocker",dhp_ccb:"DHP Calcium Channel Blocker",acei:"ACE Inhibitor",arb:"ARB",loop:"Loop Diuretic",nondhp_ccb:"Non-DHP CCB",sglt2:"SGLT2 Inhibitor",other:"Other"};
const CLS_COLOR={mra:C.acc,thiazide:C.w,p1:C.t2,bb:C.r,dhp_ccb:C.g,acei:C.t1,arb:C.t1,loop:C.w,nondhp_ccb:C.t2,sglt2:C.g,other:C.t3};

function parseMedList(text){
  if(!text.trim()) return [];
  const lines=text.split(/[\n,;]+/).map(l=>l.trim()).filter(Boolean);
  const results=[];
  const seen=new Set();
  for(const line of lines){
    const lower=line.toLowerCase();
    for(const drug of ANTI_HTN){
      if(seen.has(drug.id)) continue;
      if(drug.kw.some(k=>lower.includes(k))){
        const doseMatch=line.match(/(\d+\.?\d*)\s*(mg|mcg)/i);
        const dose=doseMatch?parseFloat(doseMatch[1]):null;
        const freqMatch=lower.match(/\b(daily|once daily|od|qd|qhs|bid|twice daily|b\.i\.d|tid|three times|t\.i\.d|qid)\b/i);
        let freq=freqMatch?freqMatch[0].toUpperCase():null;
        if(freq==="OD"||freq==="QD"||freq==="ONCE DAILY"||freq==="QHS") freq="daily";
        if(freq==="TWICE DAILY"||freq==="B.I.D") freq="BID";
        if(freq==="THREE TIMES"||freq==="T.I.D") freq="TID";
        results.push({...drug,detectedDose:dose,detectedFreq:freq,rawLine:line});
        seen.add(drug.id);
        break;
      }
    }
  }
  return results;
}

function getNextMRADose(drug,currentDose){
  const d=ANTI_HTN.find(x=>x.id===drug);
  if(!d) return null;
  const idx=d.steps.findIndex(s=>s>=currentDose);
  if(idx<0||idx>=d.steps.length-1) return null;
  return d.steps[idx+1];
}

function getNextThiazideDose(drug,currentDose){
  return getNextMRADose(drug,currentDose); // same logic
}

function getDoseAction(med){
  if(!med||!med.detectedDose) return {action:"stop",text:`Discontinue ${med?.name||"medication"}`};
  const drug=ANTI_HTN.find(d=>d.id===med.id);
  if(!drug) return {action:"stop",text:`Discontinue ${med.name}`};
  const idx=drug.steps.findIndex(s=>s>=med.detectedDose);
  if(idx<=1) return {action:"stop",text:`Discontinue ${med.name} (currently ${med.detectedDose} ${drug.unit} ${med.detectedFreq||drug.freq})`};
  const lowerDose=drug.steps[idx-1];
  return {action:"reduce",text:`Reduce ${med.name} from ${med.detectedDose} ${drug.unit} to ${lowerDose} ${drug.unit} ${med.detectedFreq||drug.freq}`,newDose:lowerDose};
}

// ─── Shared UI for lab inputs & med list ───
const REN_OPTS=REN.map(r=>({v:r.id,l:r.l}));
const ALD_OPTS=ALD.map(a=>({v:a.id,l:a.l}));

function LabInputs({rTid,setRTid,rV,setRV,aTid,setATid,aV,setAV,kV,setKV}){
  const lr=REN.find(r=>r.id===rTid)||REN[0];
  const la=ALD.find(a=>a.id===aTid)||ALD[0];
  return(<>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}>
      <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>Renin assay</div><Sel value={rTid} onChange={setRTid} options={REN_OPTS}/></div>
      <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>Renin ({lr.u})</div><Inp value={rV} onChange={setRV} placeholder="value" type="number"/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}>
      <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>Aldo assay</div><Sel value={aTid} onChange={setATid} options={ALD_OPTS}/></div>
      <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>Aldo ({la.u})</div><Inp value={aV} onChange={setAV} placeholder="value" type="number"/></div>
    </div>
    <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>K⁺ (mmol/L)</div><Inp value={kV} onChange={setKV} placeholder="e.g. 3.8" type="number" style={{maxWidth:120}}/></div>
  </>);
}

function MedBox({text,onChange,parsed,label}){
  return(
    <div style={{marginTop:6}}>
      <div style={{fontSize:9,color:C.t2,marginBottom:2}}>{label}</div>
      <textarea value={text} onChange={e=>onChange(e.target.value)} rows={3} placeholder="Paste med list..." style={{width:"100%",padding:"6px",borderRadius:5,border:`1px solid ${C.bdr}`,background:C.bg,color:C.t1,fontSize:10,fontFamily:M,outline:"none",boxSizing:"border-box",resize:"vertical",lineHeight:1.5}}/>
      {parsed.length>0&&<div style={{marginTop:4}}>{parsed.map(m=><div key={m.id} style={{fontSize:10,color:C.t1,padding:"2px 0"}}><Pill c={CLS_COLOR[m.cls]||C.t2} bg={(CLS_COLOR[m.cls]||C.t2)+"18"}>{CLS_LABEL[m.cls]||m.cls}</Pill> {m.name} {m.detectedDose||"?"}{m.unit} {m.detectedFreq||m.freq}</div>)}</div>}
    </div>
  );
}

function TitrateTool(){
  // ─── Demographics ───
  const [age,setAge]=useState("");
  const [sex,setSex]=useState("");
  const [demoSnap,setDemoSnap]=useState(null);
  function submitDemo(){setDemoSnap({age,sex});}

  // ─── Baseline (optional, left side) ───
  const [bMo,setBMo]=useState("");
  const [bYr,setBYr]=useState("");
  const [bSbp,setBSbp]=useState("");
  const [bDbp,setBDbp]=useState("");
  const [bRTid,setBRTid]=useState("drc_ngl");
  const [bRV,setBRV]=useState("");
  const [bATid,setBATid]=useState("ia_pmol");
  const [bAV,setBAV]=useState("");
  const [bKV,setBKV]=useState("");
  const [bMedText,setBMedText]=useState("");

  // ─── Current (mandatory, right side) ───
  const [cSbp,setCSbp]=useState("");
  const [cDbp,setCDbp]=useState("");
  const [cBpType,setCBpType]=useState("office");
  const [cRTid,setCRTid]=useState("drc_ngl");
  const [cRV,setCRV]=useState("");
  const [cATid,setCATid]=useState("ia_pmol");
  const [cAV,setCAV]=useState("");
  const [cKV,setCKV]=useState("");
  const [cEgM,setCEgM]=useState("direct");
  const [cCrUnit,setCCrUnit]=useState("mg");
  const [cCr,setCCr]=useState("");
  const [cEgD,setCEgD]=useState("");
  const [cMedText,setCMedText]=useState("");
  const [dataSnap,setDataSnap]=useState(null);

  // ─── Symptom & Titration ───
  const [presyncope,setPresyncope]=useState("");
  const [symptomSnap,setSymptomSnap]=useState(null);
  const [priorMRASE,setPriorMRASE]=useState("");
  const [currentMRASE,setCurrentMRASE]=useState("");
  const [bbCardiac,setBbCardiac]=useState("");
  const [thiazChoice,setThiazChoice]=useState("");
  const [thiazSE,setThiazSE]=useState("");
  const [acceptChange,setAcceptChange]=useState("");
  const [titSnap,setTitSnap]=useState(null);

  // Cascading reset helpers
  function clearTitAnswers(){setPriorMRASE("");setCurrentMRASE("");setBbCardiac("");setThiazChoice("");setThiazSE("");setAcceptChange("");setTitSnap(null);}
  function clearFromSymptoms(){setPresyncope("");setSymptomSnap(null);clearTitAnswers();}
  function clearFromData(){setDataSnap(null);setSnapFingerprint("");clearFromSymptoms();}
  function clearFromDemo(){setDemoSnap(null);clearFromData();}

  // ─── Computed ───
  const cSN=parseInt(cSbp),cDN=parseInt(cDbp),cKN=parseFloat(cKV);
  const ageN=parseInt(age);
  const cCrMg=cCrUnit==="umol"&&cCr?parseFloat(cCr)/88.4:parseFloat(cCr);
  const cEgC=cEgM==="auto"&&cCr&&age&&sex?calcEGFR(cCrMg,ageN,sex):null;
  const egfr=cEgM==="direct"?parseFloat(cEgD):cEgC;
  const egOk=egfr!==null&&!isNaN(egfr)&&egfr>=30;

  const cParsed=useMemo(()=>parseMedList(cMedText),[cMedText]);
  const bParsed=useMemo(()=>parseMedList(bMedText),[bMedText]);

  const hasBaseline=bSbp&&bKV;
  const canSubmitData=!isNaN(cSN)&&cSN>0&&!isNaN(cDN)&&cDN>0&&!isNaN(cKN)&&(egfr!==null&&!isNaN(egfr));

  // Track all inputs for change detection
  const dataFingerprint=[cSbp,cDbp,cBpType,cRTid,cRV,cATid,cAV,cKV,cEgM,cCr,cCrUnit,cEgD,cMedText,bSbp,bDbp,bRTid,bRV,bATid,bAV,bKV,bMedText,bMo,bYr].join("|");
  const [snapFingerprint,setSnapFingerprint]=useState("");
  function submitData(){
    const bRen=REN.find(r=>r.id===bRTid)||REN[0];
    setSnapFingerprint(dataFingerprint);
    setDataSnap({
      b:hasBaseline?{mo:bMo,yr:bYr,sbp:parseInt(bSbp),dbp:parseInt(bDbp),rTid:bRTid,rV:parseFloat(bRV),aTid:bATid,aV:parseFloat(bAV),kV:parseFloat(bKV),meds:[...bParsed],renSup:parseFloat(bRV)<=bRen.sup}:null,
      c:{sbp:cSN,dbp:cDN,bpType:cBpType,rTid:cRTid,rV:parseFloat(cRV),aTid:cATid,aV:parseFloat(cAV),kV:cKN,egfr,meds:[...cParsed]}
    });
  }
  const dataChanged=dataSnap&&dataFingerprint!==snapFingerprint;

  // Snapshot-derived
  const ds=dataSnap||{};
  const cs=ds.c||{};
  const bs=ds.b||null;
  const meds=dataSnap?cs.meds:cParsed;

  // Renin check
  const cRen=REN.find(r=>r.id===(dataSnap?cs.rTid:cRTid))||REN[0];
  const cRenSup=dataSnap&&cs.rV<=cRen.sup;

  // K supplement detection
  const kSupp=meds.some(m=>m.name.toLowerCase().includes("potassium")||m.kw?.some(k=>k.includes("kcl")||k.includes("k-dur")||k.includes("slow-k")||k.includes("potassium")));

  // MRA / thiazide / other med classes
  const currentMRA=meds.find(m=>m.cls==="mra");
  const onMRA=!!currentMRA;
  const mraDose=currentMRA?.detectedDose;
  const mraNextDose=onMRA&&mraDose?getNextMRADose(currentMRA.id,mraDose):null;
  const mraMaxed=onMRA&&mraDose&&!mraNextDose;
  const currentTZ=meds.find(m=>m.cls==="thiazide");
  const onTZ=!!currentTZ;
  const tzDose=currentTZ?.detectedDose;
  const tzNextDose=onTZ&&tzDose?getNextThiazideDose(currentTZ.id,tzDose):null;
  const tzMaxed=onTZ&&tzDose&&!tzNextDose;

  const p1Meds=meds.filter(m=>m.cls==="p1");
  const bbMeds=meds.filter(m=>m.cls==="bb");
  const ccbMeds=meds.filter(m=>m.cls==="dhp_ccb");
  const aceiMeds=meds.filter(m=>m.cls==="acei");
  const arbMeds=meds.filter(m=>m.cls==="arb");
  const rasiMeds=[...aceiMeds,...arbMeds];

  // ─── PAMO ───
  function computePAMO(){
    if(!bs) return null;
    const bKOk=!isNaN(bs.kV)&&bs.kV<3.5; // baseline had hypoK
    const cKOk=cs.kV>=3.5;
    const kCorrected=bKOk?cKOk:true; // if no baseline hypoK, K criterion is met
    const kWithoutSupp=kCorrected&&!kSupp;
    const reninNorm=!cRenSup; // renin no longer suppressed

    let biochem="absent";
    if(kWithoutSupp&&reninNorm) biochem="complete";
    else if(kWithoutSupp||reninNorm) biochem="partial";
    // absent = neither corrected OR no change

    // Clinical: count non-MRA anti-HTN meds
    const bNonMRA=bs.meds.filter(m=>m.cls!=="mra").length;
    const cNonMRA=meds.filter(m=>m.cls!=="mra").length;
    const bpNorm=cs.sbp<130&&cs.dbp<80;
    const sbpDrop=bs.sbp-cs.sbp;
    const bpImproved=sbpDrop>=20; // ≥20 mmHg SBP drop required for partial clinical
    const onlyMRA=onMRA&&cNonMRA===0; // currently on MRA with no other anti-HTN

    let clinical="absent";
    if(bpNorm&&onlyMRA) clinical="complete";
    else if(bpImproved||bpNorm||(bNonMRA>0&&cNonMRA<bNonMRA)) clinical="partial";

    return {biochem,clinical,kWithoutSupp,reninNorm,bpNorm,onlyMRA,bpImproved,sbpDrop,bNonMRA,cNonMRA,bKOk,kCorrected};
  }
  const pamo=dataSnap&&bs&&onMRA?computePAMO():null;
  const pamoCols={complete:C.g,partial:C.w,absent:C.r};

  // BP & K status
  const sp=symptomSnap?.presyncope||"";
  const bpHigh=cs.sbp>=130;
  const kLow=cs.kV<4.8;
  const kHigh=cs.kV>=4.8;
  const effectiveBpHigh=sp==="significant"?false:bpHigh;
  const holdSteady=sp==="mild";

  function getDeprescribeTarget(){
    if(p1Meds.length>0) return {med:p1Meds[0],priority:1,label:"vasodilator/alpha-blocker/nitrate"};
    if(bbMeds.length>0&&bbCardiac==="no") return {med:bbMeds[0],priority:2,label:"beta-blocker"};
    if(ccbMeds.length>0) return {med:ccbMeds[0],priority:3,label:"DHP calcium channel blocker"};
    if(rasiMeds.length>0||onTZ){
      if(cs.kV>4.0&&rasiMeds.length>0) return {med:rasiMeds[0],priority:4,label:rasiMeds[0].cls==="acei"?"ACE inhibitor":"ARB"};
      if(cs.kV<=4.0&&onTZ) return {med:currentTZ,priority:4,label:"thiazide diuretic"};
      if(rasiMeds.length>0) return {med:rasiMeds[0],priority:4,label:rasiMeds[0].cls==="acei"?"ACE inhibitor":"ARB"};
    }
    return null;
  }

  const depTarget=dataSnap&&symptomSnap&&!effectiveBpHigh&&!holdSteady&&egOk&&kLow?getDeprescribeTarget():null;
  const depAction=depTarget?getDoseAction(depTarget.med):null;
  const sbpRange=cs.sbp>=120&&cs.sbp<130?"120-129":cs.sbp<120?"<120":"high";

  function submitSymptoms(){setSymptomSnap({presyncope});}
  const symptomChanged=symptomSnap&&symptomSnap.presyncope!==presyncope;
  function submitTit(){setTitSnap({priorMRASE,currentMRASE,bbCardiac,thiazChoice,thiazSE,acceptChange,presyncope});}
  const titChanged=titSnap&&(titSnap.acceptChange!==acceptChange||titSnap.priorMRASE!==priorMRASE||titSnap.currentMRASE!==currentMRASE||titSnap.bbCardiac!==bbCardiac||titSnap.thiazChoice!==thiazChoice||titSnap.thiazSE!==thiazSE);

  // ─── RENDER ───
  return <>
    <h2 style={{fontSize:17,fontWeight:700,color:C.wh,margin:"0 0 4px"}}>Specialists: Titrate Medical Therapy</h2>
    <p style={{fontSize:11,color:C.t2,margin:"0 0 14px"}}>Optimize antihypertensive regimen with PAMO outcome tracking.</p>

    {/* Section 1: Demographics */}
    <SectionHead number={1} title="Patient Demographics" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Age range</div><Sel value={age} onChange={setAge} ph="Select..." options={[{v:"21",l:"18–24"},{v:"30",l:"25–34"},{v:"42",l:"35–49"},{v:"57",l:"50–64"},{v:"72",l:"65–79"},{v:"85",l:"80+"}]}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Sex</div><Sel value={sex} onChange={setSex} ph="Select..." options={[{v:"M",l:"Male"},{v:"F",l:"Female"}]}/></div>
      </div>
    </div>
    {!demoSnap&&<Btn primary onClick={submitDemo} disabled={!age||!sex}>Continue</Btn>}

    {/* Section 2: Side-by-side data entry */}
    {demoSnap&&(<>
    <SectionHead number={2} title="Baseline & Current Data" active={true}/>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
      {/* ── LEFT: Baseline (optional) ── */}
      <div style={{flex:"1 1 260px",background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:C.wh}}>Baseline (Pre-Treatment)</div>
          <Pill c={C.t2} bg={C.bdr+"55"}>optional</Pill>
        </div>
        <div style={{fontSize:10,color:C.t3,marginBottom:8}}>Fill to evaluate PAMO outcomes. Leave blank to skip.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>Month</div><Sel value={bMo} onChange={setBMo} ph="Month" options={["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m,i)=>({v:String(i+1),l:m}))}/></div>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>Year</div><Inp value={bYr} onChange={setBYr} placeholder="e.g. 2024" type="number"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>SBP (mmHg)</div><Inp value={bSbp} onChange={setBSbp} placeholder="mmHg" type="number"/></div>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>DBP (mmHg)</div><Inp value={bDbp} onChange={setBDbp} placeholder="mmHg" type="number"/></div>
        </div>
        <LabInputs rTid={bRTid} setRTid={setBRTid} rV={bRV} setRV={setBRV} aTid={bATid} setATid={setBATid} aV={bAV} setAV={setBAV} kV={bKV} setKV={setBKV}/>
        <MedBox text={bMedText} onChange={setBMedText} parsed={bParsed} label="Baseline medications"/>
      </div>

      {/* ── RIGHT: Current (mandatory) ── */}
      <div style={{flex:"1 1 260px",background:C.card,border:`1px solid ${C.acc}22`,borderRadius:9,padding:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:C.wh}}>Current Visit</div>
          <Pill c={C.acc} bg={C.accS}>required</Pill>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          {["office","home"].map(t=>(<button key={t} onClick={()=>setCBpType(t)} style={{flex:1,padding:"4px 0",borderRadius:4,border:`1px solid ${cBpType===t?C.acc:C.bdr}`,background:cBpType===t?C.accS:"transparent",color:cBpType===t?C.acc:C.t2,fontSize:10,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{t==="office"?"Office":"Home"}</button>))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>SBP (mmHg)</div><Inp value={cSbp} onChange={setCSbp} placeholder="mmHg" type="number"/></div>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>DBP (mmHg)</div><Inp value={cDbp} onChange={setCDbp} placeholder="mmHg" type="number"/></div>
        </div>
        <LabInputs rTid={cRTid} setRTid={setCRTid} rV={cRV} setRV={setCRV} aTid={cATid} setATid={setCATid} aV={cAV} setAV={setCAV} kV={cKV} setKV={setCKV}/>
        <div style={{marginTop:6}}>
          <div style={{fontSize:9,color:C.t2,marginBottom:1}}>eGFR</div>
          <div style={{display:"flex",gap:3,marginBottom:3}}>
            {["direct","auto"].map(m=>(<button key={m} onClick={()=>setCEgM(m)} style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${cEgM===m?C.acc:C.bdr}`,background:cEgM===m?C.accS:"transparent",color:cEgM===m?C.acc:C.t2,fontSize:9,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{m==="direct"?"eGFR":"From Cr"}</button>))}
          </div>
          {cEgM==="direct"?<Inp value={cEgD} onChange={setCEgD} placeholder="eGFR" type="number"/>:<>
            <div style={{display:"flex",gap:3,marginBottom:2}}>
              {[{v:"mg",l:"mg/dL"},{v:"umol",l:"µmol/L"}].map(u=>(<button key={u.v} onClick={()=>setCCrUnit(u.v)} style={{padding:"2px 5px",borderRadius:3,border:`1px solid ${cCrUnit===u.v?C.acc:C.bdr}`,background:cCrUnit===u.v?C.accS:"transparent",color:cCrUnit===u.v?C.acc:C.t2,fontSize:8,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{u.l}</button>))}
            </div>
            <Inp value={cCr} onChange={setCCr} placeholder={cCrUnit==="mg"?"Cr":"µmol/L"} type="number"/>
            {cEgC&&<div style={{fontSize:9,color:C.acc,marginTop:1}}>→ eGFR ≈ {cEgC}</div>}
          </>}
        </div>
        <MedBox text={cMedText} onChange={setCMedText} parsed={cParsed} label="Current medications"/>
      </div>
    </div>
    {!dataSnap&&<Btn primary onClick={submitData} disabled={!canSubmitData}>Submit & Assess</Btn>}
    {dataSnap&&dataChanged&&<div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.w}}>⚠ Data changed.</span><Btn small primary onClick={()=>{clearFromSymptoms();submitData();}} style={{width:"auto"}}>Re-submit</Btn></div>}
    </>)}

    {/* Section 3: PAMO Assessment */}
    {dataSnap&&pamo&&(<>
    <SectionHead number={3} title="PAMO Treatment Outcome" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:10,color:C.t3,marginBottom:8}}>Based on PAMO criteria (Yang et al., Lancet Diabetes Endocrinol 2025). Clinical success uses modified BP target of &lt;130/80 mmHg.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:C.bg,borderRadius:7,padding:10,border:`1px solid ${pamoCols[pamo.biochem]}33`}}>
          <div style={{fontSize:10,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Biochemical</div>
          <Pill c={pamoCols[pamo.biochem]} bg={pamoCols[pamo.biochem]+"18"}>{pamo.biochem}</Pill>
          <div style={{marginTop:6,fontSize:10,color:C.t2,lineHeight:1.5}}>
            <div>{pamo.reninNorm?"✅":"❌"} Renin normalized (no longer suppressed)</div>
            <div>{pamo.kWithoutSupp?"✅":"❌"} K⁺ corrected without supplements</div>
          </div>
        </div>
        <div style={{background:C.bg,borderRadius:7,padding:10,border:`1px solid ${pamoCols[pamo.clinical]}33`}}>
          <div style={{fontSize:10,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Clinical</div>
          <Pill c={pamoCols[pamo.clinical]} bg={pamoCols[pamo.clinical]+"18"}>{pamo.clinical}</Pill>
          <div style={{marginTop:6,fontSize:10,color:C.t2,lineHeight:1.5}}>
            <div>{pamo.bpNorm?"✅":"❌"} BP &lt;130/80 (modified target)</div>
            <div>{pamo.onlyMRA?"✅":"❌"} MRA monotherapy (no other anti-HTN)</div>
            {pamo.clinical==="partial"&&<div style={{color:C.t3,marginTop:2}}>{pamo.bpImproved?`SBP dropped ${pamo.sbpDrop} mmHg (≥20)`:pamo.bpNorm?"BP <130/80 but not on MRA monotherapy":`Fewer non-MRA meds (${pamo.bNonMRA}→${pamo.cNonMRA})`}</div>}
          </div>
        </div>
      </div>
    </div>
    </>)}

    {/* Section 4: Symptom Assessment */}
    {dataSnap&&(<>
    <SectionHead number={pamo?4:3} title="Symptom Assessment" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Does the patient have symptoms of pre-syncope or hypotension?</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {[
          {v:"significant",l:"Significant pre-syncope — back off medications",col:C.r},
          {v:"mild",l:"Mild pre-syncope — hesitant to increase further",col:C.w},
          {v:"none",l:"No pre-syncope — target SBP < 130 mmHg",col:C.g},
        ].map(o=>(<button key={o.v} onClick={()=>setPresyncope(o.v)} style={{padding:"10px 12px",borderRadius:6,border:`1px solid ${presyncope===o.v?o.col:C.bdr}`,background:presyncope===o.v?o.col+"15":"transparent",color:presyncope===o.v?o.col:C.t2,fontSize:12,fontWeight:600,fontFamily:F,cursor:"pointer",textAlign:"left"}}>{o.l}</button>))}
      </div>
    </div>
    {!symptomSnap&&<Btn primary onClick={submitSymptoms} disabled={!presyncope}>Continue</Btn>}
    {symptomSnap&&symptomChanged&&<div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.w}}>⚠ Changed.</span><Btn small primary onClick={()=>{clearTitAnswers();submitSymptoms();}} style={{width:"auto"}}>Re-submit</Btn></div>}
    </>)}

    {/* Section 5: Titration */}
    {dataSnap&&symptomSnap&&(<>
    <SectionHead number={pamo?5:4} title="Titration Assessment" active={true}/>

    <div style={{background:effectiveBpHigh?C.rS:holdSteady?C.wS:C.gS,border:`1px solid ${effectiveBpHigh?C.r:holdSteady?C.w:C.g}44`,borderRadius:9,padding:12,marginBottom:10}}>
      <div style={{fontSize:13,fontWeight:700,color:C.wh}}>{sp==="significant"?`BP ${cs.sbp}/${cs.dbp} — Significant Pre-syncope`:sp==="mild"?`BP ${cs.sbp}/${cs.dbp} — Mild Pre-syncope (Hold)`:effectiveBpHigh?`BP ${cs.sbp}/${cs.dbp} — Above Target`:`BP ${cs.sbp}/${cs.dbp} — At/Below Target`}</div>
      <div style={{fontSize:11,color:C.t2}}>K⁺ {cs.kV} · eGFR {cs.egfr?Math.round(cs.egfr):""} · {onMRA?`${currentMRA.name} ${mraDose||"?"} mg`:"No MRA"}</div>
    </div>

    {!egOk&&<Box type="red" title="eGFR < 30">Refer to nephrology. MRA and thiazide adjustments should be deferred.</Box>}

    {egOk&&holdSteady&&<Box type="warn" title="Hold Current Regimen">Mild pre-syncope — no medication changes. Reassess at next visit.</Box>}

    {/* BP HIGH */}
    {egOk&&effectiveBpHigh&&!holdSteady&&(<div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      {kLow&&(<div style={{fontSize:12,color:C.t1,lineHeight:1.7}}>
        <div style={{fontWeight:700,color:C.wh,marginBottom:6}}>BP above target, K⁺ &lt;4.8, eGFR ≥30 — optimize MRA.</div>
        {!onMRA&&(<><div style={{fontWeight:700,color:C.acc,marginBottom:4}}>Start an MRA</div>
          <div style={{marginBottom:8}}><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Prior MRA side effects?</div><div style={{display:"flex",gap:5}}>{[{v:"no",l:"No"},{v:"yes",l:"Yes"}].map(o=>(<button key={o.v} onClick={()=>setPriorMRASE(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${priorMRASE===o.v?C.acc:C.bdr}`,background:priorMRASE===o.v?C.accS:"transparent",color:priorMRASE===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}</div></div>
          {priorMRASE==="no"&&<Box type="green" title="Start Spironolactone 12.5 mg daily">Check lytes/Cr at 2 weeks.</Box>}
          {priorMRASE==="yes"&&<Box type="info" title="Start Eplerenone 25 mg BID">Lower sexual side effect risk. Check lytes/Cr at 2 weeks.</Box>}
        </>)}
        {onMRA&&!mraMaxed&&(<><div style={{fontWeight:700,color:C.acc,marginBottom:4}}>Increase {currentMRA.name} to {mraNextDose} mg {currentMRA.freq}</div>
          <div style={{marginBottom:8}}><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Side effects at current/proposed dose?</div><div style={{display:"flex",gap:5}}>{[{v:"no",l:"No"},{v:"yes",l:"Yes"}].map(o=>(<button key={o.v} onClick={()=>setCurrentMRASE(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${currentMRASE===o.v?C.acc:C.bdr}`,background:currentMRASE===o.v?C.accS:"transparent",color:currentMRASE===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}</div></div>
          {currentMRASE==="no"&&<Box type="green" title={`Increase to ${mraNextDose} mg ${currentMRA.freq}`}>Check lytes/Cr at 2 weeks.</Box>}
          {currentMRASE==="yes"&&currentMRA.id==="spiro"&&<Box type="info" title="Consider switching to Eplerenone">Start eplerenone 25 mg BID.</Box>}
          {currentMRASE==="yes"&&currentMRA.id!=="spiro"&&<Box type="warn" title="Side effects limiting uptitration">Consider specialist discussion.</Box>}
        </>)}
        {onMRA&&mraMaxed&&<Box type="warn" title={`${currentMRA.name} at max (${mraDose} mg)`}>Reinforce sodium &lt;2 g/day and adherence.</Box>}
      </div>)}
      {kHigh&&(<div style={{fontSize:12,color:C.t1,lineHeight:1.7}}>
        <div style={{fontWeight:700,color:C.w,marginBottom:6}}>K⁺ ≥4.8 — address before MRA titration.</div>
        {!onTZ&&(<><div style={{fontWeight:700,color:C.acc,marginBottom:4}}>Start a thiazide</div>
          <div style={{display:"flex",gap:4,marginBottom:6}}>{[{v:"chlor",l:"Chlorthalidone 12.5"},{v:"indap",l:"Indapamide 1.25"},{v:"hctz",l:"HCTZ 12.5"}].map(o=>(<button key={o.v} onClick={()=>setThiazChoice(o.v)} style={{flex:1,padding:"5px 3px",borderRadius:4,border:`1px solid ${thiazChoice===o.v?C.acc:C.bdr}`,background:thiazChoice===o.v?C.accS:"transparent",color:thiazChoice===o.v?C.acc:C.t2,fontSize:10,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}</div>
          {thiazChoice&&<div style={{marginBottom:6}}><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Prior thiazide side effects?</div><div style={{display:"flex",gap:5}}>{[{v:"no",l:"No"},{v:"yes",l:"Yes"}].map(o=>(<button key={o.v} onClick={()=>setThiazSE(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${thiazSE===o.v?C.acc:C.bdr}`,background:thiazSE===o.v?C.accS:"transparent",color:thiazSE===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}</div></div>}
          {thiazChoice&&thiazSE==="no"&&<Box type="green" title={`Start ${thiazChoice==="chlor"?"Chlorthalidone 12.5 mg":thiazChoice==="indap"?"Indapamide 1.25 mg":"HCTZ 12.5 mg"} daily`}>Check lytes/Cr at 2 weeks.</Box>}
          {thiazChoice&&thiazSE==="yes"&&<Box type="warn" title="Prior side effects">Try alternative class or consult nephrology.</Box>}
        </>)}
        {onTZ&&!tzMaxed&&(<><div style={{fontWeight:700,color:C.acc,marginBottom:4}}>Increase {currentTZ.name} to {tzNextDose} mg</div>
          <div style={{marginBottom:6}}><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Side effects?</div><div style={{display:"flex",gap:5}}>{[{v:"no",l:"No"},{v:"yes",l:"Yes"}].map(o=>(<button key={o.v} onClick={()=>setThiazSE(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${thiazSE===o.v?C.acc:C.bdr}`,background:thiazSE===o.v?C.accS:"transparent",color:thiazSE===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}</div></div>
          {thiazSE==="no"&&<Box type="green" title={`Increase to ${tzNextDose} mg daily`}>Check lytes/Cr at 2 weeks.</Box>}
          {thiazSE==="yes"&&<Box type="warn" title="Side effects">Consult nephrology.</Box>}
        </>)}
        {onTZ&&tzMaxed&&<Box type="red" title="Thiazide maxed, K⁺ still high">Refer to nephrology.</Box>}
      </div>)}
    </div>)}

    {/* BP CONTROLLED / SIGNIFICANT PRESYNCOPE */}
    {egOk&&!effectiveBpHigh&&!holdSteady&&(<div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,color:C.t1,lineHeight:1.7}}>
        {kLow&&(<>
          <div style={{fontWeight:700,color:C.g,marginBottom:6}}>{sp==="significant"?"Reduce non-essential agents":"Optimize aldosterone blockade"}</div>
          <div style={{fontSize:11,color:C.t2,marginBottom:8}}>The goal is targeted MRA therapy rather than non-specific antihypertensives.</div>
          {p1Meds.length>0&&(()=>{const da=getDoseAction(p1Meds[0]);return <Box type="info" title={da.text}>{p1Meds[0].name} is non-essential for primary aldosteronism.</Box>;})()}
          {p1Meds.length===0&&bbMeds.length>0&&(<>
            {(()=>{const da=getDoseAction(bbMeds[0]);return <Box type="info" title={da.text}>Beta-blockers are not targeted therapy.</Box>;})()}
            <div style={{marginBottom:6}}><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Cardiac indication for beta-blocker?</div><div style={{display:"flex",gap:5}}>{[{v:"no",l:"No"},{v:"yes",l:"Yes — cardiac"}].map(o=>(<button key={o.v} onClick={()=>setBbCardiac(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${bbCardiac===o.v?C.acc:C.bdr}`,background:bbCardiac===o.v?C.accS:"transparent",color:bbCardiac===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}</div></div>
            {bbCardiac==="yes"&&<div style={{fontSize:11,color:C.t2,marginBottom:6}}>Beta-blocker continued for cardiac indication.</div>}
          </>)}
          {p1Meds.length===0&&(bbMeds.length===0||bbCardiac==="yes")&&ccbMeds.length>0&&(()=>{const da=getDoseAction(ccbMeds[0]);return <Box type="info" title={da.text}>DHP-CCBs are not targeted therapy.</Box>;})()}
          {p1Meds.length===0&&(bbMeds.length===0||bbCardiac==="yes")&&ccbMeds.length===0&&(rasiMeds.length>0||onTZ)&&(()=>{
            const target=cs.kV>4.0&&rasiMeds.length>0?rasiMeds[0]:onTZ&&cs.kV<=4.0?currentTZ:rasiMeds.length>0?rasiMeds[0]:null;
            if(!target) return null;
            const da=getDoseAction(target);
            return <Box type="info" title={da.text}>{cs.kV>4.0?"K⁺ >4.0 — prefer reducing RASi over thiazide.":"K⁺ ≤4.0 — prefer reducing thiazide to preserve RAS blockade."}</Box>;
          })()}
          {p1Meds.length===0&&(bbMeds.length===0||bbCardiac==="yes")&&ccbMeds.length===0&&rasiMeds.length===0&&!onTZ&&<Box type="green" title="No non-essential agents">Primarily on targeted therapy. {onMRA&&!mraMaxed?"Consider increasing MRA at next visit.":"Continue current regimen."}</Box>}
          {depTarget&&sp!=="significant"&&(<div style={{marginTop:8,background:C.bg,borderRadius:7,padding:10,border:`1px solid ${C.bdr}`}}>
            {sbpRange==="120-129"&&<div style={{fontSize:11,color:C.t1}}>SBP 120–129: can simultaneously {depAction?.action==="stop"?"discontinue":"reduce"} the above and {onMRA&&mraNextDose?`increase ${currentMRA.name} to ${mraNextDose} mg`:!onMRA?"start spironolactone 12.5 mg":"optimize MRA"}. Check lytes/Cr at 2 weeks for MRA changes.</div>}
            {sbpRange==="<120"&&<div style={{fontSize:11,color:C.w}}>SBP &lt;120: reduce agent first, reassess in 4 weeks before MRA uptitration.</div>}
          </div>)}
        </>)}
        {kHigh&&<div style={{fontWeight:700,color:C.w}}>K⁺ ≥4.8 — cannot uptitrate MRA. Consider thiazide or nephrology referral.</div>}
      </div>
    </div>)}

    {/* Accept */}
    {egOk&&(holdSteady||(effectiveBpHigh&&!holdSteady&&(kLow?(priorMRASE||currentMRASE||mraMaxed):(thiazSE||thiazChoice||(onTZ&&tzMaxed))))||(!effectiveBpHigh&&!holdSteady&&kLow))&&(
      <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Accept Proposed Changes?</div>
        <div style={{display:"flex",gap:5}}>
          {[{v:"yes",l:"Yes — accept"},{v:"no",l:"No — defer"}].map(o=>(<button key={o.v} onClick={()=>setAcceptChange(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${acceptChange===o.v?C.acc:C.bdr}`,background:acceptChange===o.v?C.accS:"transparent",color:acceptChange===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
        </div>
        {acceptChange==="yes"&&(()=>{const renalCls=new Set(["mra","thiazide","acei","arb","loop"]);const needsLytes=(effectiveBpHigh&&kLow&&(priorMRASE||currentMRASE))||(effectiveBpHigh&&kHigh&&(thiazChoice||thiazSE))||(depTarget&&renalCls.has(depTarget.med.cls))||(!effectiveBpHigh&&kLow&&sbpRange==="120-129");return <div style={{marginTop:6,fontSize:11,color:C.g}}>✅ Accepted.{needsLytes?" Check lytes/Cr at 2 weeks.":""} Follow up in 1–2 months.</div>;})()}
        {acceptChange==="no"&&<div style={{marginTop:6,fontSize:11,color:C.t2}}>Deferred. Follow up in 4–6 months.</div>}
      </div>
    )}

    {egOk&&acceptChange&&!titSnap&&<Btn primary onClick={submitTit}>Generate Clinical Note</Btn>}
    {titSnap&&titChanged&&<div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.w}}>⚠ Changed.</span><Btn small primary onClick={submitTit} style={{width:"auto"}}>Re-generate</Btn></div>}

    {/* Clinical Note */}
    {titSnap&&(()=>{
      const sexWord=sex==="M"?"male":"female";
      const ageLabel=age==="21"?"18-24":age==="30"?"25-34":age==="42"?"35-49":age==="57"?"50-64":age==="72"?"65-79":"80+";
      const medSummary=meds.map(m=>`${m.name} ${m.detectedDose||"?"} ${m.unit} ${m.detectedFreq||m.freq}`).join(", ");
      const renalCls=new Set(["mra","thiazide","acei","arb","loop"]);
      let needsLytes=false;

      let note=`Assessment:\nThis ${sexWord} patient (age ${ageLabel}) with primary aldosteronism is being seen for antihypertensive titration. Current BP is ${cs.sbp}/${cs.dbp} mmHg (${cs.bpType}). K⁺ is ${cs.kV} mmol/L. eGFR is ${Math.round(cs.egfr)} mL/min/1.73m². Current medications: ${medSummary}. `;

      if(pamo){
        const bDate=bs.mo?["","January","February","March","April","May","June","July","August","September","October","November","December"][parseInt(bs.mo)]||"":"";
        note+=`\n\nCompared to baseline${bDate||bs.yr?` (${bDate}${bs.yr?" "+bs.yr:""})`:""}`;
        // Biochemical narrative
        if(pamo.biochem==="complete") note+=`, the patient has achieved a complete biochemical response per PAMO criteria. Renin has normalized, indicating adequate mineralocorticoid receptor blockade, and potassium has corrected without the need for supplementation.`;
        else if(pamo.biochem==="partial"){
          note+=`, the patient has achieved a partial biochemical response per PAMO criteria. `;
          if(pamo.reninNorm&&!pamo.kWithoutSupp) note+=`Renin has normalized, but potassium has not fully corrected${kSupp?" and the patient remains on potassium supplementation":""}.`;
          else if(!pamo.reninNorm&&pamo.kWithoutSupp) note+=`Potassium has corrected without supplementation, but renin remains suppressed, suggesting that MRA therapy may not yet be at an adequate dose to fully block aldosterone activity.`;
          else note+=`Some improvement has occurred, but neither renin normalization nor full potassium correction has been achieved.`;
        }
        else note+=`, the patient has not achieved a meaningful biochemical response per PAMO criteria. Renin remains suppressed and potassium has not been corrected, indicating that current targeted therapy is insufficient.`;
        // Clinical narrative
        if(pamo.clinical==="complete") note+=` Clinically, the response is complete — blood pressure is below 130/80 mmHg on MRA ${pamo.bNonMRA>0?"monotherapy, with all prior non-targeted antihypertensives discontinued.":"therapy alone."}`;
        else if(pamo.clinical==="partial"){
          note+=` Clinically, the response is partial — `;
          if(pamo.bpImproved&&pamo.bNonMRA>0&&pamo.cNonMRA<pamo.bNonMRA) note+=`systolic blood pressure has dropped by ${pamo.sbpDrop} mmHg and the number of non-MRA antihypertensives has been reduced from ${pamo.bNonMRA} to ${pamo.cNonMRA}.`;
          else if(pamo.bpImproved&&pamo.cNonMRA===0) note+=`systolic blood pressure has dropped by ${pamo.sbpDrop} mmHg and the patient is on MRA ${pamo.bNonMRA===0?"therapy":"monotherapy"}.`;
          else if(pamo.bpImproved) note+=`systolic blood pressure has dropped by ${pamo.sbpDrop} mmHg, though the patient remains on ${pamo.cNonMRA} non-MRA antihypertensive${pamo.cNonMRA!==1?"s":""}.`;
          else if(pamo.bpNorm) note+=`blood pressure has reached target (<130/80 mmHg), though the patient requires ${pamo.cNonMRA} non-MRA antihypertensive${pamo.cNonMRA!==1?"s":""} in addition to MRA therapy to achieve this.`;
          else note+=`the number of non-MRA antihypertensives has been reduced from ${pamo.bNonMRA} to ${pamo.cNonMRA}, though blood pressure has not yet improved.`;
        }
        else note+=` Clinically, there has been no improvement — blood pressure ${pamo.bNonMRA===0?"has not reached target despite initiation of targeted therapy.":"is the same or higher on the same or more antihypertensive medications."}`;
        note+=` (Note: clinical success assessed using a modified BP target of <130/80 mmHg rather than the original PAMO threshold of <140/90 mmHg.)`;
      }

      if(sp==="significant") note+=`\n\nThe patient has significant pre-syncope. Priority is reducing antihypertensive burden.`;
      else if(sp==="mild") note+=`\n\nThe patient has mild pre-syncope. Current regimen and BP are acceptable.`;
      else if(effectiveBpHigh) note+=`\n\nBP remains above target of 130 mmHg systolic.`;
      else note+=`\n\nBP is at or below target. The goal is to optimize aldosterone blockade with targeted MRA therapy.`;

      if(!holdSteady&&effectiveBpHigh&&kLow){
        if(!onMRA){
          if(titSnap.priorMRASE==="no"){note+=` Spironolactone 12.5 mg daily will be started.`;needsLytes=true;}
          else{note+=` Eplerenone 25 mg BID will be started (prior MRA side effects).`;needsLytes=true;}
        } else if(!mraMaxed&&titSnap.currentMRASE==="no"){note+=` ${currentMRA.name} will be increased to ${mraNextDose} mg ${currentMRA.freq}.`;needsLytes=true;}
        else if(!mraMaxed&&titSnap.currentMRASE==="yes"&&currentMRA.id==="spiro"){note+=` The patient has experienced side effects with spironolactone. A switch to eplerenone 25 mg BID will be considered.`;needsLytes=true;}
        else if(!mraMaxed&&titSnap.currentMRASE==="yes"){note+=` The patient has experienced side effects limiting further uptitration of ${currentMRA.name}. Further specialist discussion is recommended.`;}
        else if(mraMaxed){note+=` ${currentMRA.name} is at maximum dose (${mraDose} mg). Dietary sodium adherence (<2 g/day) and medication compliance will be reinforced.`;}
      } else if(!holdSteady&&effectiveBpHigh&&kHigh){
        if(!onTZ&&thiazChoice){const tzn={chlor:"chlorthalidone 12.5 mg",indap:"indapamide 1.25 mg",hctz:"HCTZ 12.5 mg"};note+=` ${tzn[thiazChoice]} daily will be started.`;needsLytes=true;}
        else if(onTZ&&!tzMaxed){note+=` ${currentTZ.name} will be increased to ${tzNextDose} mg daily.`;needsLytes=true;}
        else if(onTZ&&tzMaxed) note+=` Thiazide maxed, K⁺ still high — nephrology referral indicated.`;
      } else if(!holdSteady&&!effectiveBpHigh&&kLow&&depTarget&&depAction){
        note+=` ${depAction.text}.`;
        if(renalCls.has(depTarget.med.cls)) needsLytes=true;
        if(sp!=="significant"&&sbpRange==="120-129"){
          if(onMRA&&mraNextDose){note+=` Simultaneously increase ${currentMRA.name} to ${mraNextDose} mg.`;needsLytes=true;}
          else if(!onMRA){note+=` Simultaneously start spironolactone 12.5 mg daily.`;needsLytes=true;}
        }
      }

      if(acceptChange==="yes"&&!holdSteady){
        note+=`\n\nPlan:\n`;
        if(effectiveBpHigh&&kLow&&!onMRA&&titSnap.priorMRASE==="no"){note+=`- Start spironolactone 12.5 mg daily\n`;needsLytes=true;}
        else if(effectiveBpHigh&&kLow&&!onMRA&&titSnap.priorMRASE==="yes"){note+=`- Start eplerenone 25 mg BID\n`;needsLytes=true;}
        else if(effectiveBpHigh&&kLow&&onMRA&&!mraMaxed&&titSnap.currentMRASE==="no"){note+=`- Increase ${currentMRA.name} to ${mraNextDose} mg ${currentMRA.freq}\n`;needsLytes=true;}
        else if(effectiveBpHigh&&kLow&&onMRA&&!mraMaxed&&titSnap.currentMRASE==="yes"&&currentMRA.id==="spiro"){note+=`- Discontinue spironolactone\n- Start eplerenone 25 mg BID\n`;needsLytes=true;}
        else if(effectiveBpHigh&&kLow&&onMRA&&!mraMaxed&&titSnap.currentMRASE==="yes"){note+=`- MRA uptitration limited by side effects — discuss further management options\n`;}
        else if(effectiveBpHigh&&kLow&&onMRA&&mraMaxed){note+=`- ${currentMRA.name} at maximum dose — reinforce dietary sodium restriction (<2 g/day) and medication adherence\n`;}
        else if(effectiveBpHigh&&kHigh&&!onTZ&&thiazChoice){const tzn={chlor:"chlorthalidone 12.5 mg",indap:"indapamide 1.25 mg",hctz:"HCTZ 12.5 mg"};note+=`- Start ${tzn[thiazChoice]} daily\n`;needsLytes=true;}
        else if(effectiveBpHigh&&kHigh&&onTZ&&!tzMaxed){note+=`- Increase ${currentTZ.name} to ${tzNextDose} mg daily\n`;needsLytes=true;}
        else if(effectiveBpHigh&&kHigh&&onTZ&&tzMaxed) note+=`- Refer to nephrology\n`;
        else if(!effectiveBpHigh&&kLow&&depTarget&&depAction){
          note+=`- ${depAction.text}\n`;
          if(renalCls.has(depTarget.med.cls)) needsLytes=true;
          if(sp!=="significant"&&sbpRange==="120-129"&&onMRA&&mraNextDose){note+=`- Simultaneously increase ${currentMRA.name} to ${mraNextDose} mg\n`;needsLytes=true;}
          if(sp!=="significant"&&sbpRange==="120-129"&&!onMRA){note+=`- Simultaneously start spironolactone 12.5 mg daily\n`;needsLytes=true;}
          if(sp!=="significant"&&sbpRange==="<120") note+=`- Reassess in 4 weeks for MRA uptitration\n`;
        }
        if(needsLytes) note+=`- Check electrolytes and creatinine at 2 weeks\n`;
        note+=`- Follow up in 1–2 months`;
      } else if(holdSteady){
        note+=`\n\nPlan:\n- Hold current regimen\n- Reassess at next visit once pre-syncope resolves\n- Follow up in 4–6 months`;
      } else {
        note+=`\n\nPlan:\n- Proposed changes deferred\n- Continue current regimen\n- Follow up in 4–6 months`;
      }
      logData("tool_titrate",{age_range:age,sex:sex,current_sbp:cs.sbp,current_k:cs.kV,current_egfr:cs.egfr?Math.round(cs.egfr):null,on_mra:onMRA,med_count:meds.length,pamo_biochem:pamo?pamo.biochem:null,pamo_clinical:pamo?pamo.clinical:null,presyncope:sp,accepted:acceptChange});
      return <CopyNote text={note}/>;
    })()}
    </>)}

    <div style={{textAlign:"center",marginTop:14}}>
      <Btn small onClick={()=>{clearFromDemo();setAge("");setSex("");setBMo("");setBYr("");setBSbp("");setBDbp("");setBRTid("pra_ng");setBRV("");setBATid("ia_ngdl");setBAV("");setBKV("");setBMedText("");setCSbp("");setCDbp("");setCRTid("pra_ng");setCRV("");setCATid("ia_ngdl");setCAV("");setCKV("");setCEgD("");setCCr("");setCMedText("");}}>🔄 New Patient</Btn>
    </div>
    <p style={{fontSize:9,color:C.t3,textAlign:"center",marginTop:16}}>Adapted from: Adler GK et al., JCEM 2025; Yang J et al., Lancet Diabetes Endocrinol 2025. Educational only.</p>
  </>;
}



// ═══════════════════════════════════════
// TOOL 5: PREPARE FOR AVS
// ═══════════════════════════════════════

function AVSPrepTool(){
  // ─── Section 1: Patient Info ───
  const [age,setAge]=useState("");
  const [sex,setSex]=useState("");
  const [sbp,setSbp]=useState("");
  const [dbp,setDbp]=useState("");
  const [bpType,setBpType]=useState("office");
  const [patK,setPatK]=useState("");
  const [patSnap,setPatSnap]=useState(null);

  // ─── Section 2: Medications ───
  const [medText,setMedText]=useState("");
  const [medsSnap,setMedsSnap]=useState(null);

  // ─── Section 3: Labs ───
  const [rTid,setRTid]=useState("drc_ngl");
  const [rV,setRV]=useState("");
  const [aTid,setATid]=useState("ia_pmol");
  const [aV,setAV]=useState("");
  const [kV,setKV]=useState("");
  const [egM,setEgM]=useState("direct");
  const [crUnit,setCrUnit]=useState("mg");
  const [cr,setCr]=useState("");
  const [egD,setEgD]=useState("");
  const [labSnap,setLabSnap]=useState(null);

  // ─── Section 4: Withdrawal decisions ───
  const [highBPProceed,setHighBPProceed]=useState(""); // for SBP>=160: "yes_proceed","no_withdraw"
  const [withdrawSnap,setWithdrawSnap]=useState(null);

  // ─── Section 5: CT/DST ───
  const [hasAdenoma,setHasAdenoma]=useState(""); // "yes","no"
  const [dstDone,setDstDone]=useState(""); // "yes","no"
  const [dstUnit,setDstUnit]=useState("nmol"); // "nmol" or "ugdl"
  const [dstValue,setDstValue]=useState("");
  const [ctSnap,setCtSnap]=useState(null);

  // ─── Computed ───
  const sN=parseInt(sbp),dN=parseInt(dbp),patKN=parseFloat(patK);
  const canSubmitPat=age&&sex&&!isNaN(sN)&&sN>0&&!isNaN(dN)&&dN>0&&!isNaN(patKN);
  function submitPat(){setPatSnap({age,sex,sbp:sN,dbp:dN,bpType,kV:patKN});}
  const patChanged=patSnap&&(patSnap.sbp!==sN||patSnap.dbp!==dN||patSnap.kV!==patKN);

  const parsedMeds=useMemo(()=>parseMedList(medText),[medText]);
  function submitMeds(){setMedsSnap({meds:[...parsedMeds],medText});}
  const medsChanged=medsSnap&&medsSnap.medText!==medText;

  const liveRen=REN.find(r=>r.id===rTid)||REN[0];
  const liveAld=ALD.find(a=>a.id===aTid)||ALD[0];
  const rN=parseFloat(rV),aN=parseFloat(aV),kN=parseFloat(kV);
  const ageN=parseInt(age);
  const crMgDl=crUnit==="umol"&&cr?parseFloat(cr)/88.4:parseFloat(cr);
  const egC=egM==="auto"&&cr&&age&&sex?calcEGFR(crMgDl,ageN,sex):null;
  const egfr=egM==="direct"?parseFloat(egD):egC;
  const canSubmitLabs=!isNaN(rN)&&!isNaN(aN)&&!isNaN(kN)&&(egfr!==null&&!isNaN(egfr));

  function submitLabs(){setLabSnap({rTid,rV:rN,aTid,aV:aN,kV:kN,egfr});}
  const labChanged=labSnap&&(labSnap.rV!==rN||labSnap.aV!==aN||labSnap.kV!==kN);

  // Use snapshot values
  const ps=patSnap||{};
  const ls=labSnap||{};
  const meds=medsSnap?medsSnap.meds:parsedMeds;

  // Renin suppression check
  const ren=REN.find(r=>r.id===(labSnap?ls.rTid:rTid))||REN[0];
  const renSup=labSnap&&ls.rV<=ren.sup;

  // Interfering meds analysis — same classification as initial consult tool
  const strongFN=meds.filter(m=>{const d=DRUGS.find(x=>x.kw.some(k=>m.kw?.some(mk=>mk===k)));return d&&d.risk==="fn"&&(d.strength==="strong"||d.strength==="intermediate");});
  const weakFN=meds.filter(m=>{const d=DRUGS.find(x=>x.kw.some(k=>m.kw?.some(mk=>mk===k)));return d&&d.risk==="fn"&&d.strength==="weak";});
  // Better approach: cross-reference with DRUGS DB by keyword match
  const interferingMeds=useMemo(()=>{
    const result=[];
    for(const med of meds){
      const drugMatch=DRUGS.find(d=>d.kw.some(k=>med.kw?.some(mk=>mk===k)||med.name.toLowerCase().includes(k)));
      if(drugMatch&&drugMatch.risk==="fn"){
        result.push({...med,interferenceStrength:drugMatch.strength,drugRef:drugMatch});
      }
    }
    return result;
  },[meds]);

  const strongInterferors=interferingMeds.filter(m=>m.interferenceStrength==="strong"||m.interferenceStrength==="intermediate");
  const weakInterferors=interferingMeds.filter(m=>m.interferenceStrength==="weak");
  const allInterferors=[...strongInterferors,...weakInterferors];
  const fpMeds=useMemo(()=>{
    const result=[];
    for(const med of meds){
      const drugMatch=DRUGS.find(d=>d.kw.some(k=>med.kw?.some(mk=>mk===k)||med.name.toLowerCase().includes(k)));
      if(drugMatch&&drugMatch.risk==="fp") result.push({...med,drugRef:drugMatch});
    }
    return result;
  },[meds]);

  // Non-interfering replacement meds for withdrawal
  const replacementMeds=[
    {name:"Doxazosin",low:"2 mg daily",high:"4–8 mg daily",freq:"daily"},
    {name:"Terazosin",low:"2 mg daily",high:"5–10 mg daily",freq:"daily"},
    {name:"Hydralazine",low:"25 mg TID",high:"50–75 mg TID",freq:"TID"},
    {name:"Diltiazem CD",low:"120 mg daily",high:"240–360 mg daily",freq:"daily"},
    {name:"Verapamil SR",low:"120 mg daily",high:"240–360 mg daily",freq:"daily"},
  ];

  // BP-based replacement guidance
  function getReplacementGuidance(){
    const s=ps.sbp;
    if(s>=100&&s<=119) return {level:"none",text:"SBP is 100–119 mmHg. No replacement antihypertensive is needed during the withdrawal period."};
    if(s>=120&&s<=139) return {level:"low",text:"SBP is 120–139 mmHg. Consider adding a low-dose non-interfering antihypertensive during withdrawal to maintain BP control.",meds:replacementMeds.map(m=>({name:m.name,dose:m.low}))};
    if(s>=140&&s<=159) return {level:"high",text:"SBP is 140–159 mmHg. Add a higher-dose non-interfering antihypertensive during withdrawal.",meds:replacementMeds.map(m=>({name:m.name,dose:m.high}))};
    if(s>=160) return {level:"very_high",text:"SBP is ≥160 mmHg. Withdrawing interfering medications may not be safe. Consider whether proceeding with AVS on current medications is preferable, acknowledging the possibility of inaccurate results due to unsuppressed renin."};
    return {level:"unknown",text:""};
  }

  function submitWithdraw(){setWithdrawSnap({highBPProceed});}

  // DST assessment
  const dstN=parseFloat(dstValue);
  const dstPositive=dstUnit==="nmol"?(!isNaN(dstN)&&dstN>=50):(!isNaN(dstN)&&dstN>=1.8);
  const dstNeg=dstUnit==="nmol"?(!isNaN(dstN)&&dstN<50):(!isNaN(dstN)&&dstN<1.8);

  function submitCT(){setCtSnap({hasAdenoma,dstDone,dstUnit,dstValue:dstN,dstPositive,dstNeg});}
  const ctChanged=ctSnap&&(ctSnap.hasAdenoma!==hasAdenoma||ctSnap.dstDone!==dstDone||ctSnap.dstValue!==dstN||ctSnap.dstUnit!==dstUnit);

  // ─── RENDER ───
  return <>
    <h2 style={{fontSize:17,fontWeight:700,color:C.wh,margin:"0 0 4px"}}>Specialists: Prepare for Adrenal Vein Sampling</h2>
    <p style={{fontSize:11,color:C.t2,margin:"0 0 14px"}}>Ideally begin this preparation 12 weeks prior to scheduled AVS.</p>

    {/* ═══ Section 1: Patient Info ═══ */}
    <SectionHead number={1} title="Patient Information" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Age range</div><Sel value={age} onChange={setAge} ph="Select..." options={[{v:"21",l:"18–24"},{v:"30",l:"25–34"},{v:"42",l:"35–49"},{v:"57",l:"50–64"},{v:"72",l:"65–79"},{v:"85",l:"80+"}]}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Sex</div><Sel value={sex} onChange={setSex} ph="Select..." options={[{v:"M",l:"Male"},{v:"F",l:"Female"}]}/></div>
      </div>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Blood Pressure</div>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        {["office","home"].map(t=>(<button key={t} onClick={()=>setBpType(t)} style={{flex:1,padding:"5px 0",borderRadius:5,border:`1px solid ${bpType===t?C.acc:C.bdr}`,background:bpType===t?C.accS:"transparent",color:bpType===t?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{t==="office"?"Office BP":"Home BP"}</button>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Systolic (mmHg)</div><Inp value={sbp} onChange={setSbp} placeholder="mmHg" type="number"/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Diastolic (mmHg)</div><Inp value={dbp} onChange={setDbp} placeholder="mmHg" type="number"/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Potassium (mmol/L)</div><Inp value={patK} onChange={setPatK} placeholder="e.g. 3.8" type="number"/></div>
      </div>
    </div>
    {!patSnap&&<Btn primary onClick={submitPat} disabled={!canSubmitPat}>Submit Patient Info</Btn>}
    {patSnap&&patChanged&&<div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.w}}>⚠ Patient info changed.</span><Btn small primary onClick={()=>{submitPat();setMedsSnap(null);setLabSnap(null);setWithdrawSnap(null);setCtSnap(null);}} style={{width:"auto"}}>Re-submit</Btn></div>}

    {/* ═══ Section 2: Medications ═══ */}
    {patSnap&&(<>
    <SectionHead number={2} title="Current Medications" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:11,color:C.t2,marginBottom:6}}>Paste the patient's full medication list below.</div>
      <textarea value={medText} onChange={e=>setMedText(e.target.value)} rows={5}
        placeholder={"e.g.\nSpironolactone 25mg daily\nRamipril 10mg daily\nAmlodipine 5mg daily"}
        style={{width:"100%",padding:"9px",borderRadius:6,border:`1px solid ${C.bdr}`,background:C.bg,color:C.t1,fontSize:12,fontFamily:M,outline:"none",boxSizing:"border-box",resize:"vertical",lineHeight:1.6}}
        onFocus={e=>e.target.style.borderColor=C.acc} onBlur={e=>e.target.style.borderColor=C.bdr}/>
      {parsedMeds.length>0&&(<div style={{marginTop:10}}>
        <div style={{fontSize:11,fontWeight:700,color:C.wh,marginBottom:6}}>Detected Antihypertensives ({parsedMeds.length})</div>
        {parsedMeds.map(m=>(
          <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${C.bdr}22`}}>
            <Pill c={CLS_COLOR[m.cls]||C.t2} bg={(CLS_COLOR[m.cls]||C.t2)+"18"}>{CLS_LABEL[m.cls]||m.cls}</Pill>
            <span style={{fontSize:12,color:C.wh,fontWeight:600,flex:1}}>{m.name}</span>
            <span style={{fontSize:11,color:C.t2,fontFamily:M}}>{m.detectedDose?`${m.detectedDose} ${m.unit}`:"dose ?"} {m.detectedFreq||m.freq}</span>
          </div>
        ))}
      </div>)}
    </div>
    {!medsSnap&&<Btn primary onClick={submitMeds} disabled={parsedMeds.length===0}>Confirm Medication List</Btn>}
    {medsSnap&&medsChanged&&<div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.w}}>⚠ Medication list changed.</span><Btn small primary onClick={()=>{submitMeds();setLabSnap(null);setWithdrawSnap(null);setCtSnap(null);}} style={{width:"auto"}}>Re-confirm</Btn></div>}
    </>)}

    {/* ═══ Section 3: Labs ═══ */}
    {patSnap&&medsSnap&&(<>
    <SectionHead number={3} title="Current Labs" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Renin assay</div><Sel value={rTid} onChange={setRTid} options={REN.map(r=>({v:r.id,l:r.l}))}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Renin ({liveRen.u})</div><Inp value={rV} onChange={setRV} placeholder="value" type="number"/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Aldosterone assay</div><Sel value={aTid} onChange={setATid} options={ALD.map(a=>({v:a.id,l:a.l}))}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Aldo ({liveAld.u})</div><Inp value={aV} onChange={setAV} placeholder="value" type="number"/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Potassium (mmol/L)</div><Inp value={kV} onChange={setKV} placeholder="e.g. 4.2" type="number"/></div>
        <div>
          <div style={{fontSize:10,color:C.t2,marginBottom:2}}>eGFR</div>
          <div style={{display:"flex",gap:4,marginBottom:4}}>
            {["direct","auto"].map(m=>(<button key={m} onClick={()=>setEgM(m)} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${egM===m?C.acc:C.bdr}`,background:egM===m?C.accS:"transparent",color:egM===m?C.acc:C.t2,fontSize:9,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{m==="direct"?"eGFR":"From Cr"}</button>))}
          </div>
          {egM==="direct"?<Inp value={egD} onChange={setEgD} placeholder="eGFR" type="number"/>:<>
            <div style={{display:"flex",gap:3,marginBottom:3}}>
              {[{v:"mg",l:"mg/dL"},{v:"umol",l:"µmol/L"}].map(u=>(<button key={u.v} onClick={()=>setCrUnit(u.v)} style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${crUnit===u.v?C.acc:C.bdr}`,background:crUnit===u.v?C.accS:"transparent",color:crUnit===u.v?C.acc:C.t2,fontSize:9,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{u.l}</button>))}
            </div>
            <Inp value={cr} onChange={setCr} placeholder={crUnit==="mg"?"Cr":"Cr µmol/L"} type="number"/>
            {egC&&<div style={{fontSize:10,color:C.acc,marginTop:2}}>→ eGFR ≈ {egC}</div>}
          </>}
        </div>
      </div>
    </div>
    {!labSnap&&<Btn primary onClick={submitLabs} disabled={!canSubmitLabs}>Submit Labs</Btn>}
    {labSnap&&labChanged&&<div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.w}}>⚠ Labs changed.</span><Btn small primary onClick={()=>{submitLabs();setWithdrawSnap(null);setCtSnap(null);}} style={{width:"auto"}}>Re-submit</Btn></div>}
    </>)}

    {/* ═══ Section 4: Renin Assessment & Medication Management ═══ */}
    {labSnap&&(<>
    <SectionHead number={4} title="Renin Assessment & Medication Preparation" active={true}/>

    {renSup?(<>
      {/* Renin suppressed — can proceed */}
      <div style={{background:C.gS,border:`1px solid ${C.g}44`,borderRadius:9,padding:14,marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:14}}>✅</span>
          <div style={{fontSize:13,fontWeight:700,color:C.wh}}>Renin is Suppressed — AVS Can Proceed on Current Medications</div>
        </div>
        <div style={{fontSize:12,color:C.t1,lineHeight:1.6}}>
          Renin is {ls.rV} {ren.u} (suppressed ≤{ren.sup} {ren.u}). AVS can be performed on the patient's current medication regimen as renin suppression confirms ongoing autonomous aldosterone production.
        </div>
      </div>

      {/* Note interfering meds */}
      {allInterferors.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:8,padding:12,marginBottom:10,fontSize:12,color:C.t1,lineHeight:1.6}}>
          <div style={{fontSize:11,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Medication Note</div>
          The patient is on the following medications that can interfere with aldosterone-renin testing:
          {strongInterferors.length>0&&<div style={{marginTop:4}}>• <strong>Strong interferors:</strong> {strongInterferors.map(m=>m.name).join(", ")}</div>}
          {weakInterferors.length>0&&<div style={{marginTop:2}}>• <strong>Weak interferors:</strong> {weakInterferors.map(m=>m.name).join(", ")}</div>}
          {fpMeds.length>0&&<div style={{marginTop:2}}>• <strong>False-positive risk:</strong> {fpMeds.map(m=>m.name).join(", ")}</div>}
          <div style={{marginTop:6,fontWeight:600,color:C.g}}>However, renin remains suppressed, confirming that AVS can proceed reliably on these medications.</div>
        </div>
      )}

    </>):(<>
      {/* Renin NOT suppressed — need to withdraw */}
      <div style={{background:C.rS,border:`1px solid ${C.r}44`,borderRadius:9,padding:14,marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:14}}>⚠️</span>
          <div style={{fontSize:13,fontWeight:700,color:C.wh}}>Renin is NOT Suppressed — Medication Withdrawal Needed</div>
        </div>
        <div style={{fontSize:12,color:C.t1,lineHeight:1.6}}>
          Renin is {ls.rV} {ren.u} (not suppressed; threshold ≤{ren.sup} {ren.u}). Interfering medications should be withdrawn and aldosterone/renin repeated in 2–4 weeks before proceeding to AVS.
        </div>
      </div>

      {/* Withdrawal plan */}
      <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:8}}>Medication Withdrawal Plan</div>

        {/* Strong interferors first */}
        {strongInterferors.length>0&&(<div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.w,marginBottom:4}}>Priority 1: Withdraw strong interferors (4-week washout)</div>
          {strongInterferors.map(m=>{
            const da=getDoseAction(m);
            return <div key={m.id} style={{fontSize:12,color:C.t1,padding:"4px 0",borderBottom:`1px solid ${C.bdr}22`}}>
              • <strong>{da.action==="stop"?"Discontinue":"Reduce"}</strong> {m.name} {m.detectedDose?`(currently ${m.detectedDose} ${m.unit} ${m.detectedFreq||m.freq})`:""}
              {da.action==="reduce"&&<span> → {da.newDose} {m.unit} {m.detectedFreq||m.freq}</span>}
              <span style={{color:C.t3,fontSize:10}}> — washout: {m.drugRef?.wo||4} weeks</span>
            </div>;
          })}
        </div>)}

        {/* Weak interferors second */}
        {strongInterferors.length===0&&weakInterferors.length>0&&(<div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.t2,marginBottom:4}}>Withdraw weak interferors (2-week washout)</div>
          {weakInterferors.map(m=>{
            const da=getDoseAction(m);
            return <div key={m.id} style={{fontSize:12,color:C.t1,padding:"4px 0",borderBottom:`1px solid ${C.bdr}22`}}>
              • <strong>{da.action==="stop"?"Discontinue":"Reduce"}</strong> {m.name} {m.detectedDose?`(currently ${m.detectedDose} ${m.unit} ${m.detectedFreq||m.freq})`:""}
              {da.action==="reduce"&&<span> → {da.newDose} {m.unit} {m.detectedFreq||m.freq}</span>}
              <span style={{color:C.t3,fontSize:10}}> — washout: {m.drugRef?.wo||2} weeks</span>
            </div>;
          })}
        </div>)}

        {strongInterferors.length>0&&weakInterferors.length>0&&(<div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:C.t2,marginBottom:4}}>If renin remains unsuppressed after withdrawing the above, also withdraw:</div>
          {weakInterferors.map(m=>(<div key={m.id} style={{fontSize:12,color:C.t2,padding:"3px 0"}}>
            • {m.name} {m.detectedDose?`(${m.detectedDose} ${m.unit})`:""}
            <span style={{fontSize:10}}> — washout: {m.drugRef?.wo||2} weeks</span>
          </div>))}
        </div>)}

        {allInterferors.length===0&&(<div style={{fontSize:12,color:C.w,marginBottom:8}}>
          No known interfering medications were detected. Consider reviewing the medication list or repeating labs. If renin remains unsuppressed, the diagnosis of primary aldosteronism should be reconsidered.
        </div>)}

        {/* BP-based replacement guidance */}
        {(()=>{
          const g=getReplacementGuidance();
          if(g.level==="none") return <Box type="green" title="No BP replacement needed">{g.text}</Box>;
          if(g.level==="low"||g.level==="high") return (<div style={{marginTop:6}}>
            <Box type="info" title={g.level==="low"?"Add low-dose replacement":"Add higher-dose replacement"}>
              {g.text}
              <div style={{marginTop:6}}>
                {g.meds.map((m,i)=>(<div key={i} style={{fontSize:11,color:C.t1,padding:"2px 0"}}>• {m.name} {m.dose}</div>))}
              </div>
              <div style={{marginTop:4,fontSize:10,color:C.t2}}>These agents do not significantly interfere with aldosterone-renin dynamics or AVS interpretation.</div>
            </Box>
          </div>);
          if(g.level==="very_high") return (<div style={{marginTop:6}}>
            <Box type="red" title="SBP ≥160 mmHg — Withdrawal May Not Be Safe">{g.text}</Box>
            <div style={{marginTop:6,marginBottom:6}}>
              <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Would you like to proceed with AVS on current medications despite unsuppressed renin?</div>
              <div style={{display:"flex",gap:5}}>
                {[{v:"yes_proceed",l:"Yes — proceed with AVS"},{v:"no_withdraw",l:"No — attempt withdrawal"}].map(o=>(<button key={o.v} onClick={()=>setHighBPProceed(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${highBPProceed===o.v?C.acc:C.bdr}`,background:highBPProceed===o.v?C.accS:"transparent",color:highBPProceed===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
              </div>
            </div>
            {highBPProceed==="yes_proceed"&&<div style={{fontSize:11,color:C.w,marginBottom:6}}>Proceeding with AVS on current medications. Results should be interpreted with caution as unsuppressed renin increases the risk of inaccurate lateralization.</div>}
            {highBPProceed==="no_withdraw"&&<div style={{fontSize:11,color:C.t1,marginBottom:6}}>Will attempt medication withdrawal with close BP monitoring. Use the replacement agents above as needed.</div>}
          </div>);
          return null;
        })()}

        {/* Potassium supplementation warning */}
        {(()=>{
          const kSparingWithdraw=strongInterferors.some(m=>m.cls==="mra"||m.name.toLowerCase().includes("amiloride")||m.name.toLowerCase().includes("triamterene"));
          if(kSparingWithdraw&&ps.kV<3.7) return(
            <Box type="warn" title={`K⁺ is ${ps.kV} mmol/L — Start Potassium Supplementation`}>
              Withdrawing MRA or potassium-sparing diuretics may worsen hypokalemia. Start low-dose potassium supplementation (e.g. KCl 20 mEq daily) when discontinuing these agents, and monitor potassium closely.
            </Box>
          );
          return null;
        })()}

        <div style={{marginTop:8,fontSize:11,color:C.t2,lineHeight:1.5}}>
          <strong>After withdrawal:</strong> Repeat serum aldosterone, renin, and potassium in 2–4 weeks. If renin becomes suppressed, proceed to AVS.
        </div>
      </div>

    </>)}
    </>)}

    {/* ═══ Section 5: CT & Dexamethasone Suppression Test ═══ */}
    {labSnap&&(<>
    <SectionHead number={5} title="Hypercortisolism Assessment" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Is there an adrenal adenoma &gt;1 cm on CT imaging?</div>
        <div style={{display:"flex",gap:5}}>
          {[{v:"yes",l:"Yes — adenoma >1 cm"},{v:"no",l:"No"}].map(o=>(<button key={o.v} onClick={()=>{setHasAdenoma(o.v);if(o.v==="no"){setDstDone("");setDstValue("");}}} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${hasAdenoma===o.v?C.acc:C.bdr}`,background:hasAdenoma===o.v?C.accS:"transparent",color:hasAdenoma===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
        </div>
      </div>

      {hasAdenoma==="yes"&&(<>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Has a 1 mg overnight dexamethasone suppression test (DST) been performed to rule out hypercortisolism?</div>
          <div style={{display:"flex",gap:5}}>
            {[{v:"yes",l:"Yes — DST done"},{v:"no",l:"No — not yet done"}].map(o=>(<button key={o.v} onClick={()=>setDstDone(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${dstDone===o.v?C.acc:C.bdr}`,background:dstDone===o.v?C.accS:"transparent",color:dstDone===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
          </div>
        </div>

        {dstDone==="no"&&(<>
          <Box type="warn" title="1 mg Dexamethasone Suppression Test Required">
            Per guidelines, adrenal adenomas &gt;1 cm should be screened for autonomous cortisol secretion before AVS. Please arrange a 1 mg overnight DST.
          </Box>
          <div style={{background:C.bg,border:`1px solid ${C.acc}44`,borderRadius:8,padding:12,marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:C.acc,marginBottom:6}}>📋 Patient Instructions for 1 mg Dexamethasone Suppression Test</div>
            <div style={{fontSize:12,color:C.t1,lineHeight:1.7}}>
              <p style={{margin:"0 0 6px"}}><strong>Purpose:</strong> This test checks whether your adrenal gland is producing too much cortisol.</p>
              <p style={{margin:"0 0 6px"}}><strong>What you need:</strong> One dexamethasone 1 mg tablet (your doctor will provide a prescription).</p>
              <p style={{margin:"0 0 6px"}}><strong>Instructions:</strong></p>
              <p style={{margin:"0 0 4px"}}>1. The night before your blood test, take the dexamethasone 1 mg tablet at <strong>11:00 PM</strong> with a small amount of water.</p>
              <p style={{margin:"0 0 4px"}}>2. Go to the lab the next morning between <strong>8:00 AM and 9:00 AM</strong> for a fasting blood draw (cortisol level).</p>
              <p style={{margin:"0 0 4px"}}>3. You may drink water but avoid eating or drinking anything else before the blood test.</p>
              <p style={{margin:"0 0 6px"}}>4. No other special preparation is needed.</p>
              <p style={{margin:0,fontSize:11,color:C.t2}}>Bring these instructions to the lab so they know to draw a <strong>morning serum cortisol</strong>.</p>
            </div>
          </div>
        </>)}

        {dstDone==="yes"&&(<>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Morning cortisol result after 1 mg dexamethasone:</div>
            <div style={{display:"flex",gap:5,marginBottom:4}}>
              {[{v:"nmol",l:"nmol/L"},{v:"ugdl",l:"µg/dL"}].map(u=>(<button key={u.v} onClick={()=>setDstUnit(u.v)} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${dstUnit===u.v?C.acc:C.bdr}`,background:dstUnit===u.v?C.accS:"transparent",color:dstUnit===u.v?C.acc:C.t2,fontSize:10,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{u.l}</button>))}
            </div>
            <Inp value={dstValue} onChange={setDstValue} placeholder={dstUnit==="nmol"?"e.g. 35":"e.g. 1.2"} type="number" style={{maxWidth:160}}/>
          </div>

          {!isNaN(dstN)&&dstN>0&&(<>
            {dstPositive&&(
              <Box type="red" title={`Cortisol ${dstN} ${dstUnit==="nmol"?"nmol/L":"µg/dL"} — Positive (≥${dstUnit==="nmol"?"50 nmol/L":"1.8 µg/dL"})`}>
                The dexamethasone suppression test is positive, suggesting possible autonomous cortisol secretion (Cushing syndrome or cortisol co-secretion). <strong>AVS should use both cortisol and metanephrines as reference hormones</strong> to ensure accurate lateralization, as cortisol alone may be unreliable if the adenoma co-secretes cortisol.
              </Box>
            )}
            {dstNeg&&(
              <Box type="green" title={`Cortisol ${dstN} ${dstUnit==="nmol"?"nmol/L":"µg/dL"} — Negative (<${dstUnit==="nmol"?"50 nmol/L":"1.8 µg/dL"})`}>
                The dexamethasone suppression test is appropriately suppressed, ruling out significant autonomous cortisol secretion. <strong>AVS can proceed with routine cortisol as the reference hormone</strong> for lateralization assessment.
              </Box>
            )}
          </>)}
        </>)}
      </>)}

      {hasAdenoma==="no"&&(
        <div style={{fontSize:12,color:C.t2,lineHeight:1.6,marginTop:4}}>
          No adrenal adenoma &gt;1 cm. A dexamethasone suppression test is not specifically required by guidelines in this setting. AVS can proceed with routine cortisol as the reference hormone.
        </div>
      )}
    </div>

    {/* Submit and combined clinical note */}
    {hasAdenoma&&(hasAdenoma==="no"||dstDone)&&!ctSnap&&<Btn primary onClick={submitCT} disabled={hasAdenoma==="yes"&&dstDone==="yes"&&(isNaN(dstN)||dstN<=0)}>Generate Clinical Note</Btn>}
    {ctSnap&&ctChanged&&<div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.w}}>⚠ Selections changed.</span><Btn small primary onClick={submitCT} style={{width:"auto"}}>Re-generate</Btn></div>}

    {/* ═══ Combined Clinical Note ═══ */}
    {ctSnap&&(()=>{
      const medSummary=meds.map(m=>`${m.name} ${m.detectedDose||"?"} ${m.unit} ${m.detectedFreq||m.freq}`).join(", ");
      const sexWord=sex==="M"?"male":"female";
      const ageLabel=age==="21"?"18-24":age==="30"?"25-34":age==="42"?"35-49":age==="57"?"50-64":age==="72"?"65-79":"80+";
      const g=getReplacementGuidance();
      const kSparingWithdraw=strongInterferors.some(m=>m.cls==="mra"||m.name.toLowerCase().includes("amiloride")||m.name.toLowerCase().includes("triamterene"));

      let note=`Assessment:\nThis ${sexWord} patient (age ${ageLabel}) with primary aldosteronism is being prepared for adrenal venous sampling. `;
      note+=`Current BP is ${ps.sbp}/${ps.dbp} mmHg (${ps.bpType}). Potassium is ${ps.kV} mmol/L. `;
      note+=`Current medications include: ${medSummary}. `;
      note+=`Renin is ${ls.rV} ${ren.u} (${renSup?"suppressed":"not suppressed"}; threshold ≤${ren.sup}). `;

      if(renSup){
        if(allInterferors.length>0){
          note+=`The patient is on medications that can interfere with aldosterone-renin dynamics (${allInterferors.map(m=>m.name).join(", ")}). However, renin remains suppressed, confirming ongoing autonomous aldosterone production. `;
        }
        note+=`AVS can proceed on the current medication regimen without medication withdrawal.`;
      } else {
        note+=`Renin is not suppressed, likely due to interfering medications. `;
        if(ps.sbp>=160&&highBPProceed==="yes_proceed"){
          note+=`Given severe hypertension (SBP ≥160), the decision is to proceed with AVS on current medications, acknowledging the higher risk of inaccurate lateralization results.`;
        } else {
          note+=`Interfering medications will be withdrawn prior to AVS to achieve renin suppression.`;
        }
      }

      // Hypercortisolism assessment
      note+=`\n\n`;
      if(ctSnap.hasAdenoma==="yes"){
        note+=`Adrenal CT shows an adenoma greater than 1 cm. `;
        if(ctSnap.dstDone==="no"){
          note+=`A 1 mg overnight dexamethasone suppression test has not yet been performed and has been arranged to rule out autonomous cortisol secretion prior to AVS.`;
        } else if(ctSnap.dstPositive){
          note+=`The 1 mg dexamethasone suppression test showed a cortisol of ${ctSnap.dstValue} ${ctSnap.dstUnit==="nmol"?"nmol/L":"µg/dL"}, which is positive (≥${ctSnap.dstUnit==="nmol"?"50 nmol/L":"1.8 µg/dL"}), raising concern for autonomous cortisol secretion. AVS will use both cortisol and metanephrines as reference hormones for lateralization.`;
        } else if(ctSnap.dstNeg){
          note+=`The 1 mg dexamethasone suppression test showed a cortisol of ${ctSnap.dstValue} ${ctSnap.dstUnit==="nmol"?"nmol/L":"µg/dL"}, which is appropriately suppressed, ruling out significant autonomous cortisol secretion. AVS will proceed with routine cortisol as the reference hormone.`;
        }
      } else {
        note+=`No adrenal adenoma greater than 1 cm on CT imaging. Dexamethasone suppression testing is not specifically indicated. AVS will proceed with routine cortisol as the reference hormone.`;
      }

      // Plan
      note+=`\n\nPlan:\n`;
      if(renSup){
        note+=`- Proceed with adrenal venous sampling on current medications\n`;
      } else if(ps.sbp>=160&&highBPProceed==="yes_proceed"){
        note+=`- Proceed with AVS on current medications (renin not suppressed — interpret with caution)\n`;
      } else {
        const toWithdraw=strongInterferors.length>0?strongInterferors:weakInterferors;
        for(const m of toWithdraw){
          const da=getDoseAction(m);
          note+=`- ${da.text} (washout: ${m.drugRef?.wo||4} weeks)\n`;
        }
        if(kSparingWithdraw&&ps.kV<3.7){
          note+=`- Start potassium supplementation (e.g. KCl 20 mEq daily) given K⁺ ${ps.kV} mmol/L and withdrawal of potassium-sparing agent\n`;
        }
        if(g.level==="low"||g.level==="high"){
          note+=`- Add non-interfering antihypertensive for BP control during washout (e.g. ${g.meds.slice(0,2).map(m=>m.name+" "+m.dose).join(" or ")})\n`;
        }
        note+=`- Repeat aldosterone, renin, and potassium in 2–4 weeks after washout\n`;
        note+=`- If renin is suppressed on repeat testing, proceed with AVS\n`;
      }
      if(ctSnap.hasAdenoma==="yes"&&ctSnap.dstDone==="no"){
        note+=`- Arrange 1 mg overnight dexamethasone suppression test (dexamethasone 1 mg at 11 PM, fasting cortisol draw at 8–9 AM)\n`;
        note+=`- Review DST result before proceeding with AVS\n`;
      }
      if(ctSnap.hasAdenoma==="yes"&&ctSnap.dstPositive){
        note+=`- AVS to use both cortisol and metanephrines as reference hormones\n`;
      }
      if((ctSnap.hasAdenoma==="no")||(ctSnap.hasAdenoma==="yes"&&ctSnap.dstNeg)){
        note+=`- AVS to use routine cortisol as reference hormone\n`;
      }
      note+=`- Follow up in 1–2 months`;

      logData("tool_avs_prep",{age_range:age,sex:sex,sbp:ps.sbp,potassium:ps.kV,renin_suppressed:renSup,med_count:meds.length,withdrawal_needed:!renSup,has_adenoma:ctSnap.hasAdenoma,dst_done:ctSnap.dstDone||null,dst_positive:ctSnap.dstPositive||null});
      return <CopyNote text={note}/>;
    })()}
    </>)}

    {/* Reset */}
    <div style={{textAlign:"center",marginTop:14}}>
      <Btn small onClick={()=>{setPatSnap(null);setMedsSnap(null);setLabSnap(null);setWithdrawSnap(null);setCtSnap(null);setSbp("");setDbp("");setAge("");setSex("");setPatK("");setMedText("");setRV("");setAV("");setKV("");setEgD("");setCr("");setHasAdenoma("");setDstDone("");setDstValue("");setHighBPProceed("");}}>🔄 New Patient</Btn>
    </div>
    <p style={{fontSize:9,color:C.t3,textAlign:"center",marginTop:16}}>Adapted from: Adler GK et al., JCEM 2025. DOI:10.1210/clinem/dgaf284. Educational only.</p>
  </>;
}


// ═══════════════════════════════════════
// TOOL 7: POST-ADRENALECTOMY FOLLOW-UP
// ═══════════════════════════════════════


// ═══════════════════════════════════════
// TOOL 6: PREPARE FOR SURGERY
// ═══════════════════════════════════════

// WHO DDD (mg/day) for PASO score calculation
const WHO_DDD={
  spironolactone:75,eplerenone:50,amlodipine:5,nifedipine:30,felodipine:5,diltiazem:240,verapamil:240,
  lisinopril:10,enalapril:10,ramipril:2.5,perindopril:4,quinapril:15,captopril:50,trandolapril:2,benazepril:10,fosinopril:15,
  losartan:50,valsartan:80,irbesartan:150,candesartan:8,telmisartan:40,olmesartan:20,azilsartan:40,
  hydrochlorothiazide:25,chlorthalidone:25,indapamide:2.5,furosemide:40,bumetanide:1,torsemide:15,
  metoprolol:150,atenolol:75,bisoprolol:10,carvedilol:37.5,propranolol:160,nebivolol:5,labetalol:600,nadolol:160,
  doxazosin:4,prazosin:6,terazosin:5,clonidine:0.45,methyldopa:1000,hydralazine:100,minoxidil:10,
  empagliflozin:17.5,dapagliflozin:10,canagliflozin:200,amiloride:5,triamterene:100
};

function calcDDD(meds){
  let total=0;
  for(const m of meds){
    if(!m.detectedDose) continue;
    const key=Object.keys(WHO_DDD).find(k=>m.name.toLowerCase().includes(k));
    if(!key) continue;
    const freqMult=m.detectedFreq==="BID"?2:m.detectedFreq==="TID"?3:m.detectedFreq==="QID"?4:1;
    const dailyDose=m.detectedDose*freqMult;
    total+=dailyDose/WHO_DDD[key];
  }
  return Math.round(total*100)/100;
}

function calcPASO(htnYrs,sex,bmi,totalDDD,tod,noduleMm){
  const months=(parseFloat(htnYrs)||0)*12;
  const pts={};
  pts.htn=months<120?7.5:months<240?3.5:0;
  pts.sex=sex==="F"?3:0;
  const b=parseFloat(bmi)||0;
  pts.bmi=b>0&&b<24?1.5:b>=24&&b<30?0.5:0;
  pts.meds=totalDDD<3?6:totalDDD<9?3:0;
  pts.tod=tod==="no"?3:0;
  const n=parseFloat(noduleMm)||0;
  pts.nodule=n>=20?4:n>=13?2:0;
  const total=Object.values(pts).reduce((a,b)=>a+b,0);
  return {pts,total};
}

function calcARS(htnYrs,sex,bmi,medCount){
  const pts={};
  pts.meds=medCount<=2?2:0;
  pts.bmi=(parseFloat(bmi)||99)<=25?1:0;
  pts.htn=(parseFloat(htnYrs)||99)<=6?1:0;
  pts.sex=sex==="F"?1:0;
  const total=Object.values(pts).reduce((a,b)=>a+b,0);
  const level=total>=4?"High":total>=2?"Medium":"Low";
  return {pts,total,level};
}

function subDays(dateStr,n){
  if(!dateStr) return null;
  const d=new Date(dateStr+"T12:00:00");
  d.setDate(d.getDate()-n);
  return d;
}
function fmtD(d){
  if(!d) return "";
  return d.toLocaleDateString("en-US",{weekday:"short",year:"numeric",month:"short",day:"numeric"});
}

function PrepSurgeryTool(){
  // Section 1: Patient & Surgery Info
  const [age,setAge]=useState("");
  const [sex,setSex]=useState("");
  const [side,setSide]=useState("");
  const [surgDate,setSurgDate]=useState("");
  const [htnYrs,setHtnYrs]=useState("");
  const [bmi,setBmi]=useState("");
  const [tod,setTod]=useState("");
  const [noduleMm,setNoduleMm]=useState("");
  const [patSnap,setPatSnap]=useState(null);

  // Section 2: Clinical Data
  const [sbp,setSbp]=useState("");
  const [dbp,setDbp]=useState("");
  const [kV,setKV]=useState("");
  const [egfr,setEgfr]=useState("");
  const [medText,setMedText]=useState("");
  const [dataSnap,setDataSnap]=useState(null);

  // Section 3: Score mode
  const [useARS,setUseARS]=useState(false);

  // Section 5: Checklist + accept
  const [chkMRA,setChkMRA]=useState(false);
  const [chkK,setChkK]=useState(false);
  const [chkLabs,setChkLabs]=useState(false);
  const [chkConsent,setChkConsent]=useState(false);
  const [chkAnesthesia,setChkAnesthesia]=useState(false);
  const [acceptChange,setAcceptChange]=useState("");
  const [noteSnap,setNoteSnap]=useState(null);

  // Computed
  const sN=parseInt(sbp),dN=parseInt(dbp),kN=parseFloat(kV),egN=parseFloat(egfr);
  const cParsed=useMemo(()=>parseMedList(medText),[medText]);
  const canSubmitPat=age&&sex&&side&&htnYrs&&bmi&&tod&&noduleMm;
  const canSubmitData=!isNaN(sN)&&sN>0&&!isNaN(dN)&&dN>0&&!isNaN(kN)&&!isNaN(egN);

  function clearChecklist(){setChkMRA(false);setChkK(false);setChkLabs(false);setChkConsent(false);setChkAnesthesia(false);setAcceptChange("");setNoteSnap(null);}
  function clearFromData(){setDataSnap(null);clearChecklist();}
  function submitPat(){setPatSnap({age,sex,side,surgDate,htnYrs,bmi,tod,noduleMm});clearFromData();}

  const dataFP=[sbp,dbp,kV,egfr,medText].join("|");
  const [snapFP,setSnapFP]=useState("");
  function submitData(){setSnapFP(dataFP);setDataSnap({sbp:sN,dbp:dN,kV:kN,egfr:egN,meds:[...cParsed]});clearChecklist();}
  const dataChanged=dataSnap&&dataFP!==snapFP;

  const ps=patSnap||{};
  const ds=dataSnap||{};
  const meds=dataSnap?ds.meds:cParsed;

  const totalDDD=useMemo(()=>calcDDD(meds),[meds]);
  const medCount=meds.length;
  const hasMRA=meds.some(m=>m.cls==="mra");

  const paso=useMemo(()=>patSnap?calcPASO(ps.htnYrs,ps.sex,ps.bmi,totalDDD,ps.tod,ps.noduleMm):null,[patSnap,totalDDD]);
  const ars=useMemo(()=>patSnap?calcARS(ps.htnYrs,ps.sex,ps.bmi,medCount):null,[patSnap,medCount]);
  const mraStopDate=useMemo(()=>subDays(ps.surgDate,2),[ps.surgDate]);

  const pasoInterp=paso?(paso.total>20?{l:"High likelihood of complete clinical cure",c:C.g}:paso.total>16?{l:"Favorable — above cutoff for complete clinical success",c:C.g}:paso.total>10?{l:"Intermediate — below cutoff, partial/absent more likely",c:C.w}:{l:"Low likelihood of complete clinical cure",c:C.r}):null;
  const arsInterp=ars?{l:`${ars.level} likelihood of cure (${ars.level==="High"?"~75%":ars.level==="Medium"?"~46%":"~27%"})`,c:ars.level==="High"?C.g:ars.level==="Medium"?C.w:C.r}:null;

  // Render
  return <>
    <h2 style={{fontSize:17,fontWeight:700,color:C.wh,margin:"0 0 4px"}}>Specialists: Prepare for Surgery</h2>
    <p style={{fontSize:11,color:C.t2,margin:"0 0 14px"}}>Pre-operative planning with PASO prediction score and surgical counseling.</p>

    {/* Section 1: Patient & Surgery Info */}
    <SectionHead number={1} title="Patient & Surgery Information" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Age (years)</div><Inp value={age} onChange={setAge} placeholder="e.g. 52" type="number"/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Sex</div><Sel value={sex} onChange={setSex} ph="Select" options={[{v:"F",l:"Female"},{v:"M",l:"Male"}]}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Planned side</div><Sel value={side} onChange={setSide} ph="Select" options={[{v:"Left",l:"Left"},{v:"Right",l:"Right"}]}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Surgery date</div><input type="date" value={surgDate} onChange={e=>setSurgDate(e.target.value)} style={{width:"100%",padding:"7px",borderRadius:6,border:`1px solid ${C.bdr}`,background:C.bg,color:C.t1,fontSize:12,fontFamily:F,outline:"none",boxSizing:"border-box"}}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>HTN duration (years)</div><Inp value={htnYrs} onChange={setHtnYrs} placeholder="e.g. 8" type="number"/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>BMI (kg/m²)</div><Inp value={bmi} onChange={setBmi} placeholder="e.g. 27" type="number"/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Target organ damage (LVH / microalbuminuria)?</div>
          <div style={{display:"flex",gap:5}}>{[{v:"no",l:"No — absent"},{v:"yes",l:"Yes — present"}].map(o=>(<button key={o.v} onClick={()=>setTod(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${tod===o.v?C.acc:C.bdr}`,background:tod===o.v?C.accS:"transparent",color:tod===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}</div>
        </div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Largest nodule at imaging (mm)</div><Inp value={noduleMm} onChange={setNoduleMm} placeholder="e.g. 15" type="number"/></div>
      </div>
    </div>
    {!patSnap&&<Btn primary onClick={submitPat} disabled={!canSubmitPat}>Continue</Btn>}
    {patSnap&&<div style={{marginBottom:10}}><Btn small onClick={()=>{setPatSnap(null);clearFromData();}}>Edit Patient Info</Btn></div>}

    {/* Section 2: Clinical Data & Medications */}
    {patSnap&&(<>
    <SectionHead number={2} title="Current Clinical Data & Medications" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:8}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>SBP (mmHg)</div><Inp value={sbp} onChange={setSbp} placeholder="140" type="number"/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>DBP (mmHg)</div><Inp value={dbp} onChange={setDbp} placeholder="90" type="number"/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>K⁺ (mmol/L)</div><Inp value={kV} onChange={setKV} placeholder="3.8" type="number"/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>eGFR</div><Inp value={egfr} onChange={setEgfr} placeholder="85" type="number"/></div>
      </div>
      {kN<3.5&&!isNaN(kN)&&<Box type="warn" title={`K⁺ ${kV} mmol/L — Below Target`}>Correct hypokalemia to ≥3.5 mmol/L before surgery.</Box>}
      {egN<30&&!isNaN(egN)&&<Box type="red" title="eGFR < 30">Refer to nephrology prior to surgery. MRA therapy should be deferred.</Box>}
      <MedBox text={medText} onChange={setMedText} parsed={cParsed} label="Current antihypertensive medications"/>
      {cParsed.length>0&&<div style={{marginTop:6,fontSize:10,color:C.acc}}>Total DDD: {calcDDD(cParsed).toFixed(2)} · {cParsed.length} agent{cParsed.length!==1?"s":""}{cParsed.some(m=>m.cls==="mra")?" · MRA detected":""}</div>}
    </div>
    {!dataSnap&&<Btn primary onClick={submitData} disabled={!canSubmitData}>Submit Clinical Data</Btn>}
    {dataSnap&&dataChanged&&<div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.w}}>⚠ Data changed.</span><Btn small primary onClick={()=>{submitData();}} style={{width:"auto"}}>Re-submit</Btn></div>}
    </>)}

    {/* Section 3: Prediction Score */}
    {dataSnap&&(<>
    <SectionHead number={3} title="Surgical Outcome Prediction" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{display:"flex",gap:5,marginBottom:10}}>
        {[{v:false,l:"PASO Score (default)"},{v:true,l:"ARS (simplified)"}].map(o=>(<button key={String(o.v)} onClick={()=>setUseARS(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${useARS===o.v?C.acc:C.bdr}`,background:useARS===o.v?C.accS:"transparent",color:useARS===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
      </div>

      {!useARS&&paso&&(<>
        <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>PASO Prediction Score</div>
        <div style={{fontSize:10,color:C.t3,marginBottom:8}}>Burrello et al., Ann Surg 2020. AUC 0.839, accuracy 79.2%.</div>
        {/* Score bar */}
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontSize:11,color:C.t2}}>Score</span>
            <span style={{fontSize:14,fontWeight:800,color:pasoInterp?.c||C.t1,fontFamily:M}}>{paso.total} <span style={{fontSize:10,fontWeight:500,color:C.t3}}>/ 25</span></span>
          </div>
          <div style={{position:"relative",height:14,background:C.bg,borderRadius:7,overflow:"hidden"}}>
            <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${(paso.total/25)*100}%`,background:pasoInterp?.c||C.acc,borderRadius:7,transition:"width 0.3s"}}/>
            <div style={{position:"absolute",left:`${(16/25)*100}%`,top:-1,bottom:-1,width:2,background:C.t3}}/>
          </div>
          <div style={{fontSize:9,color:C.t3,marginTop:2,textAlign:"right"}}>Cutoff: &gt;16</div>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:pasoInterp?.c||C.t1,marginBottom:8}}>{pasoInterp?.l}</div>
        {/* Point breakdown */}
        <div style={{background:C.bg,borderRadius:7,padding:10,border:`1px solid ${C.bdr}`}}>
          {[
            {l:"HTN Duration",v:`${Math.round((parseFloat(ps.htnYrs)||0)*12)} mo`,p:paso.pts.htn,max:7.5},
            {l:"Sex",v:ps.sex==="F"?"Female":"Male",p:paso.pts.sex,max:3},
            {l:"BMI",v:`${ps.bmi} kg/m²`,p:paso.pts.bmi,max:1.5},
            {l:"Anti-HTN meds",v:`${totalDDD.toFixed(1)} DDD`,p:paso.pts.meds,max:6},
            {l:"Target organ damage",v:ps.tod==="no"?"Absent":"Present",p:paso.pts.tod,max:3},
            {l:"Nodule size",v:`${ps.noduleMm} mm`,p:paso.pts.nodule,max:4},
          ].map((r,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",borderBottom:i<5?`1px solid ${C.bdr}22`:"none"}}>
            <span style={{fontSize:10,color:C.t2}}>{r.l} <span style={{color:C.t3}}>({r.v})</span></span>
            <span style={{fontSize:11,fontWeight:700,color:r.p>0?C.acc:C.t3,fontFamily:M}}>{r.p} <span style={{fontSize:9,fontWeight:400,color:C.t3}}>/ {r.max}</span></span>
          </div>))}
        </div>
      </>)}

      {useARS&&ars&&(<>
        <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Aldosteronoma Resolution Score</div>
        <div style={{fontSize:10,color:C.t3,marginBottom:8}}>Zarnegar et al., Ann Surg 2008.</div>
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontSize:11,color:C.t2}}>Score</span>
            <span style={{fontSize:14,fontWeight:800,color:arsInterp?.c||C.t1,fontFamily:M}}>{ars.total} <span style={{fontSize:10,fontWeight:500,color:C.t3}}>/ 5</span></span>
          </div>
          <div style={{position:"relative",height:14,background:C.bg,borderRadius:7,overflow:"hidden"}}>
            <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${(ars.total/5)*100}%`,background:arsInterp?.c||C.acc,borderRadius:7,transition:"width 0.3s"}}/>
          </div>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:arsInterp?.c||C.t1,marginBottom:8}}>{arsInterp?.l}</div>
        <div style={{background:C.bg,borderRadius:7,padding:10,border:`1px solid ${C.bdr}`}}>
          {[
            {l:"≤2 medications",v:`${medCount} meds`,p:ars.pts.meds,max:2},
            {l:"BMI ≤25",v:`${ps.bmi}`,p:ars.pts.bmi,max:1},
            {l:"HTN ≤6 years",v:`${ps.htnYrs} yr`,p:ars.pts.htn,max:1},
            {l:"Female sex",v:ps.sex==="F"?"Yes":"No",p:ars.pts.sex,max:1},
          ].map((r,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:i<3?`1px solid ${C.bdr}22`:"none"}}>
            <span style={{fontSize:10,color:C.t2}}>{r.l} <span style={{color:C.t3}}>({r.v})</span></span>
            <span style={{fontSize:11,fontWeight:700,color:r.p>0?C.acc:C.t3,fontFamily:M}}>{r.p} <span style={{fontSize:9,fontWeight:400,color:C.t3}}>/ {r.max}</span></span>
          </div>))}
        </div>
      </>)}
    </div>
    </>)}

    {/* Section 4: Risk & Benefit Counseling */}
    {dataSnap&&(<>
    <SectionHead number={4} title="Surgical Risk & Expected Outcomes" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[
          {l:"Complication rate",v:"~5%",sub:"minor; <1% serious",c:C.g},
          {l:"Biochemical cure",v:"~94%",sub:"K⁺ + ARR normalization",c:C.g},
          {l:"Complete clinical cure",v:"~37%",sub:"BP normal, no meds",c:C.acc},
          {l:"Clinical benefit",v:"~84%",sub:"complete + partial",c:C.acc},
        ].map((r,i)=>(<div key={i} style={{background:C.bg,borderRadius:7,padding:10,textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:r.c}}>{r.v}</div>
          <div style={{fontSize:10,fontWeight:700,color:C.wh}}>{r.l}</div>
          <div style={{fontSize:9,color:C.t3}}>{r.sub}</div>
        </div>))}
      </div>
      <div style={{marginTop:8,fontSize:10,color:C.t3,lineHeight:1.5}}>Based on PASO international cohort (n=705). Complication data from systematic review of 1,056 patients. Conversion to open: 0–2%. Hospital stay: 1–2 days.</div>
    </div>
    </>)}

    {/* Section 5: Pre-op Checklist */}
    {dataSnap&&(<>
    <SectionHead number={5} title="Pre-Operative Checklist" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      {hasMRA&&mraStopDate&&<div style={{background:C.accS,border:`1px solid ${C.acc}44`,borderRadius:7,padding:10,marginBottom:10,fontSize:12,color:C.acc}}>
        <strong>Stop MRA by {fmtD(mraStopDate)}</strong> (2 days before surgery on {ps.surgDate?fmtD(new Date(ps.surgDate+"T12:00:00")):""})
      </div>}
      {hasMRA&&!ps.surgDate&&<div style={{fontSize:11,color:C.w,marginBottom:8}}>MRA detected — enter surgery date above to calculate stop date.</div>}
      {[
        {s:chkMRA,f:setChkMRA,l:`Stop MRA ≥2 days before surgery${mraStopDate?" — by "+fmtD(mraStopDate):""}`},
        {s:chkK,f:setChkK,l:`Confirm K⁺ ≥ 3.5 mmol/L${!isNaN(kN)?` (current: ${kV}${kN<3.5?" ⚠":""})`:""}`},
        {s:chkLabs,f:setChkLabs,l:"Pre-op labs (CBC, BMP, coagulation, type & screen)"},
        {s:chkConsent,f:setChkConsent,l:"Informed consent obtained"},
        {s:chkAnesthesia,f:setChkAnesthesia,l:"Anesthesia pre-op clearance"},
      ].map((item,i)=>(<Chk key={i} checked={item.s} onChange={item.f} label={item.l}/>))}
    </div>

    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Confirm Pre-Operative Plan?</div>
      <div style={{display:"flex",gap:5}}>
        {[{v:"yes",l:"Yes — confirm"},{v:"no",l:"No — defer"}].map(o=>(<button key={o.v} onClick={()=>{setAcceptChange(o.v);setNoteSnap(null);}} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${acceptChange===o.v?C.acc:C.bdr}`,background:acceptChange===o.v?C.accS:"transparent",color:acceptChange===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
      </div>
    </div>
    {acceptChange&&!noteSnap&&<Btn primary onClick={()=>setNoteSnap({acceptChange})}>Generate Clinical Note</Btn>}
    </>)}

    {/* Clinical Note */}
    {noteSnap&&(()=>{
      const sexWord=ps.sex==="F"?"female":"male";
      const medSummary=meds.length>0?meds.map(m=>`${m.name} ${m.detectedDose||"?"} ${m.unit} ${m.detectedFreq||m.freq}`).join(", "):"none";
      const score=useARS?ars:paso;
      const interp=useARS?arsInterp:pasoInterp;

      let note=`Assessment:\nThis ${sexWord} patient (age ${ps.age}) with primary aldosteronism is being prepared for ${ps.side.toLowerCase()} laparoscopic adrenalectomy`;
      if(ps.surgDate) note+=` scheduled for ${fmtD(new Date(ps.surgDate+"T12:00:00"))}`;
      note+=`. Duration of hypertension is ${ps.htnYrs} years (${Math.round((parseFloat(ps.htnYrs)||0)*12)} months). BMI is ${ps.bmi} kg/m². Target organ damage (LVH/microalbuminuria) is ${ps.tod==="yes"?"present":"absent"}. Largest adrenal nodule measures ${ps.noduleMm} mm.`;
      note+=`\n\nCurrent BP is ${ds.sbp}/${ds.dbp} mmHg. K⁺ is ${ds.kV} mmol/L. eGFR is ${Math.round(ds.egfr)} mL/min/1.73m². Current medications: ${medSummary}. Total DDD: ${totalDDD.toFixed(2)}.`;

      if(!useARS&&paso){
        note+=`\n\nPASO Prediction Score (Burrello et al., Ann Surg 2020): ${paso.total}/25.`;
        note+=` HTN duration: ${paso.pts.htn} pts, sex: ${paso.pts.sex} pts, BMI: ${paso.pts.bmi} pts, anti-HTN meds (${totalDDD.toFixed(1)} DDD): ${paso.pts.meds} pts, target organ damage: ${paso.pts.tod} pts, nodule size: ${paso.pts.nodule} pts.`;
        note+=` ${pasoInterp?.l||""}. Cutoff >16 for complete clinical success (AUC 0.839, accuracy 79.2%).`;
      } else if(ars){
        note+=`\n\nAldosteronoma Resolution Score (Zarnegar et al., Ann Surg 2008): ${ars.total}/5 (${ars.level} likelihood).`;
      }

      note+=`\n\nExpected surgical outcomes based on international cohort data: biochemical cure ~94%, complete clinical cure ~37%, clinical benefit (complete + partial) ~84%, complication rate ~5%.`;

      if(ds.egfr<30) note+=` eGFR is below 30 — nephrology referral is recommended prior to surgery.`;
      if(ds.kV<3.5) note+=` K⁺ is ${ds.kV} mmol/L — hypokalemia should be corrected to ≥3.5 before surgery.`;

      note+=`\n\nPlan:\n`;
      if(hasMRA&&mraStopDate) note+=`- Stop MRA by ${fmtD(mraStopDate)} (2 days before surgery)\n`;
      if(ds.kV<3.5) note+=`- Correct hypokalemia to ≥3.5 mmol/L before surgery\n`;
      if(ds.egfr<30) note+=`- Nephrology referral prior to surgery\n`;
      note+=`- Pre-operative labs (CBC, BMP, coagulation, type & screen)\n`;
      note+=`- Anesthesia pre-op clearance\n`;
      note+=`- Informed consent with discussion of expected outcomes\n`;
      note+=`- Proceed with ${ps.side.toLowerCase()} laparoscopic adrenalectomy`;
      if(ps.surgDate) note+=` on ${fmtD(new Date(ps.surgDate+"T12:00:00"))}`;
      note+=`\n- Post-operative follow-up with electrolytes, renin, and aldosterone at 6–12 months`;

      logData("tool_surgery_prep",{age:ps.age,sex:ps.sex,side:ps.side,htn_years:parseFloat(ps.htnYrs)||null,bmi:parseFloat(ps.bmi)||null,tod:ps.tod,nodule_mm:parseFloat(ps.noduleMm)||null,sbp:ds.sbp,potassium:ds.kV,egfr:ds.egfr?Math.round(ds.egfr):null,med_count:medCount,total_ddd:totalDDD,paso_score:paso?paso.total:null,ars_score:ars?ars.total:null,score_used:useARS?"ARS":"PASO"});
      return <CopyNote text={note}/>;
    })()}

    <div style={{textAlign:"center",marginTop:14}}>
      <Btn small onClick={()=>{setPatSnap(null);clearFromData();setAge("");setSex("");setSide("");setSurgDate("");setHtnYrs("");setBmi("");setTod("");setNoduleMm("");setSbp("");setDbp("");setKV("");setEgfr("");setMedText("");setUseARS(false);}}>🔄 New Patient</Btn>
    </div>
    <p style={{fontSize:9,color:C.t3,textAlign:"center",marginTop:16}}>PASO Score: Burrello et al., Ann Surg 2020. ARS: Zarnegar et al., Ann Surg 2008. Educational only.</p>
  </>;
}

function PostAdxTool(){
  // ─── Section 1: Patient & Surgery Info ───
  const [age,setAge]=useState("");
  const [sex,setSex]=useState("");
  const [adxSide,setAdxSide]=useState(""); // "left","right"
  const [hadNodule,setHadNodule]=useState(""); // "yes","no"
  const [noduleSize,setNoduleSize]=useState("");
  const [adxMo,setAdxMo]=useState("");
  const [adxYr,setAdxYr]=useState("");
  const [demoSnap,setDemoSnap]=useState(null);
  function submitDemo(){setDemoSnap({age,sex,adxSide,hadNodule,noduleSize:parseFloat(noduleSize)||null,adxMo,adxYr});}

  // ─── Section 2: Baseline (pre-surgery, optional for PASO) ───
  const [bMo,setBMo]=useState("");
  const [bYr,setBYr]=useState("");
  const [bSbp,setBSbp]=useState("");
  const [bDbp,setBDbp]=useState("");
  const [bRTid,setBRTid]=useState("drc_ngl");
  const [bRV,setBRV]=useState("");
  const [bATid,setBATid]=useState("ia_pmol");
  const [bAV,setBAV]=useState("");
  const [bKV,setBKV]=useState("");
  const [bMedText,setBMedText]=useState("");

  // ─── Current (mandatory) ───
  const [cSbp,setCSbp]=useState("");
  const [cDbp,setCDbp]=useState("");
  const [cBpType,setCBpType]=useState("office");
  const [cRTid,setCRTid]=useState("drc_ngl");
  const [cRV,setCRV]=useState("");
  const [cATid,setCATid]=useState("ia_pmol");
  const [cAV,setCAV]=useState("");
  const [cKV,setCKV]=useState("");
  const [cEgM,setCEgM]=useState("direct");
  const [cCrUnit,setCCrUnit]=useState("mg");
  const [cCr,setCCr]=useState("");
  const [cEgD,setCEgD]=useState("");
  const [cMedText,setCMedText]=useState("");
  const [dataSnap,setDataSnap]=useState(null);

  // ─── Management ───
  const [acceptChange,setAcceptChange]=useState("");
  const [priorMRASE,setPriorMRASE]=useState("");
  const [mgmtSnap,setMgmtSnap]=useState(null);

  // ─── Computed ───
  const cSN=parseInt(cSbp),cDN=parseInt(cDbp),cKN=parseFloat(cKV);
  const ageN=parseInt(age);
  const cCrMg=cCrUnit==="umol"&&cCr?parseFloat(cCr)/88.4:parseFloat(cCr);
  const cEgC=cEgM==="auto"&&cCr&&age&&sex?calcEGFR(cCrMg,ageN,sex):null;
  const egfr=cEgM==="direct"?parseFloat(cEgD):cEgC;

  const cParsed=useMemo(()=>parseMedList(cMedText),[cMedText]);
  const bParsed=useMemo(()=>parseMedList(bMedText),[bMedText]);

  const hasBaseline=bSbp&&bKV;
  const canSubmitData=!isNaN(cSN)&&cSN>0&&!isNaN(cDN)&&cDN>0&&!isNaN(cKN)&&(egfr!==null&&!isNaN(egfr));

  const dataFingerprint=[cSbp,cDbp,cBpType,cRTid,cRV,cATid,cAV,cKV,cEgM,cCr,cCrUnit,cEgD,cMedText,bSbp,bDbp,bRTid,bRV,bATid,bAV,bKV,bMedText,bMo,bYr].join("|");
  const [snapFingerprint,setSnapFingerprint]=useState("");

  function clearMgmt(){setAcceptChange("");setPriorMRASE("");setMgmtSnap(null);}
  function clearFromData(){setDataSnap(null);setSnapFingerprint("");clearMgmt();}

  function submitData(){
    const bRen=REN.find(r=>r.id===bRTid)||REN[0];
    const bAld=ALD.find(a=>a.id===bATid)||ALD[0];
    const cAld=ALD.find(a=>a.id===cATid)||ALD[0];
    setSnapFingerprint(dataFingerprint);
    setDataSnap({
      b:hasBaseline?{mo:bMo,yr:bYr,sbp:parseInt(bSbp),dbp:parseInt(bDbp),rTid:bRTid,rV:parseFloat(bRV),aTid:bATid,aV:parseFloat(bAV),aToNg:bAld.toNg,kV:parseFloat(bKV),meds:[...bParsed]}:null,
      c:{sbp:cSN,dbp:cDN,bpType:cBpType,rTid:cRTid,rV:parseFloat(cRV),aTid:cATid,aV:parseFloat(cAV),aToNg:cAld.toNg,kV:cKN,egfr,meds:[...cParsed]}
    });
  }
  const dataChanged=dataSnap&&dataFingerprint!==snapFingerprint;

  // Snapshot refs
  const ds=dataSnap||{};
  const cs=ds.c||{};
  const bs=ds.b||null;
  const meds=dataSnap?cs.meds:cParsed;

  // Renin check
  const cRen=REN.find(r=>r.id===(dataSnap?cs.rTid:cRTid))||REN[0];
  const cRenSup=dataSnap&&cs.rV<=cRen.sup;

  // MRA status
  const currentMRA=meds.find(m=>m.cls==="mra");
  const onMRA=!!currentMRA;
  const bpHigh=cs.sbp>=130;

  // ─── PASO Computation ───
  function computePASO(){
    if(!bs) return null;
    const bKOk=!isNaN(bs.kV)&&bs.kV<3.5; // had baseline hypoK
    const cKOk=cs.kV>=3.5;
    const kCorrected=bKOk?cKOk:true; // if no baseline hypoK, met
    const reninNorm=!cRenSup; // renin no longer suppressed

    // Aldosterone reduction ≥50%
    const bAldNg=bs.aV*bs.aToNg;
    const cAldNg=cs.aV*cs.aToNg;
    const aldoDrop=bAldNg>0?(1-cAldNg/bAldNg)*100:0;
    const aldoHalved=aldoDrop>=50;

    let biochem="absent";
    if(kCorrected&&reninNorm) biochem="complete";
    else if(kCorrected&&!reninNorm&&aldoHalved) biochem="partial";

    // Clinical: count ALL anti-HTN meds (not MRA-specific like PAMO)
    const bMedCount=bs.meds.length;
    const cMedCount=meds.length;
    const bpNorm=cs.sbp<130&&cs.dbp<80;
    const sbpDrop=bs.sbp-cs.sbp;
    const bpImproved=sbpDrop>=20;
    const noMeds=cMedCount===0;
    const fewerMeds=bMedCount>0&&cMedCount<bMedCount;

    let clinical="absent";
    if(bpNorm&&noMeds) clinical="complete";
    else if(bpImproved||bpNorm||fewerMeds) clinical="partial";

    return {biochem,clinical,kCorrected,reninNorm,aldoHalved,aldoDrop:Math.round(aldoDrop),bpNorm,bpImproved,sbpDrop,noMeds,fewerMeds,bMedCount,cMedCount,bKOk};
  }
  const paso=dataSnap&&bs?computePASO():null;
  const pamoCols={complete:C.g,partial:C.w,absent:C.r};

  function submitMgmt(){setMgmtSnap({acceptChange,priorMRASE});}

  // ─── RENDER ───
  return <>
    <h2 style={{fontSize:17,fontWeight:700,color:C.wh,margin:"0 0 4px"}}>Specialists: Post-Adrenalectomy Follow-Up</h2>
    <p style={{fontSize:11,color:C.t2,margin:"0 0 14px"}}>Assess surgical outcomes using PASO criteria and guide ongoing management.</p>

    {/* Section 1: Patient & Surgery Info */}
    <SectionHead number={1} title="Patient & Surgery Information" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Age range</div><Sel value={age} onChange={setAge} ph="Select..." options={[{v:"21",l:"18–24"},{v:"30",l:"25–34"},{v:"42",l:"35–49"},{v:"57",l:"50–64"},{v:"72",l:"65–79"},{v:"85",l:"80+"}]}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Sex</div><Sel value={sex} onChange={setSex} ph="Select..." options={[{v:"M",l:"Male"},{v:"F",l:"Female"}]}/></div>
      </div>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Adrenalectomy Details</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Side</div>
          <div style={{display:"flex",gap:5}}>{[{v:"left",l:"Left"},{v:"right",l:"Right"}].map(o=>(<button key={o.v} onClick={()=>setAdxSide(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${adxSide===o.v?C.acc:C.bdr}`,background:adxSide===o.v?C.accS:"transparent",color:adxSide===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}</div>
        </div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Nodule on pathology?</div>
          <div style={{display:"flex",gap:5}}>{[{v:"yes",l:"Yes"},{v:"no",l:"No"}].map(o=>(<button key={o.v} onClick={()=>setHadNodule(o.v)} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${hadNodule===o.v?C.acc:C.bdr}`,background:hadNodule===o.v?C.accS:"transparent",color:hadNodule===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}</div>
        </div>
      </div>
      {hadNodule==="yes"&&<div style={{marginBottom:8}}><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Nodule size (cm)</div><Inp value={noduleSize} onChange={setNoduleSize} placeholder="e.g. 1.5" type="number" style={{maxWidth:120}}/></div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Month of surgery</div><Sel value={adxMo} onChange={setAdxMo} ph="Month" options={["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m,i)=>({v:String(i+1),l:m}))}/></div>
        <div><div style={{fontSize:10,color:C.t2,marginBottom:2}}>Year of surgery</div><Inp value={adxYr} onChange={setAdxYr} placeholder="e.g. 2024" type="number"/></div>
      </div>
    </div>
    {!demoSnap&&<Btn primary onClick={submitDemo} disabled={!age||!sex||!adxSide||!hadNodule||!adxMo||!adxYr}>Continue</Btn>}

    {/* Section 2: Baseline & Current Data */}
    {demoSnap&&(<>
    <SectionHead number={2} title="Pre-Surgery Baseline & Current Data" active={true}/>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
      {/* LEFT: Baseline */}
      <div style={{flex:"1 1 260px",background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:C.wh}}>Pre-Surgery Baseline</div>
          <Pill c={C.t2} bg={C.bdr+"55"}>for PASO</Pill>
        </div>
        <div style={{fontSize:10,color:C.t3,marginBottom:8}}>Fill to evaluate PASO outcomes.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>Month</div><Sel value={bMo} onChange={setBMo} ph="Month" options={["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m,i)=>({v:String(i+1),l:m}))}/></div>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>Year</div><Inp value={bYr} onChange={setBYr} placeholder="e.g. 2024" type="number"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>SBP (mmHg)</div><Inp value={bSbp} onChange={setBSbp} placeholder="mmHg" type="number"/></div>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>DBP (mmHg)</div><Inp value={bDbp} onChange={setBDbp} placeholder="mmHg" type="number"/></div>
        </div>
        <LabInputs rTid={bRTid} setRTid={setBRTid} rV={bRV} setRV={setBRV} aTid={bATid} setATid={setBATid} aV={bAV} setAV={setBAV} kV={bKV} setKV={setBKV}/>
        <MedBox text={bMedText} onChange={setBMedText} parsed={bParsed} label="Pre-surgery medications"/>
      </div>

      {/* RIGHT: Current */}
      <div style={{flex:"1 1 260px",background:C.card,border:`1px solid ${C.acc}22`,borderRadius:9,padding:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:C.wh}}>Current Visit</div>
          <Pill c={C.acc} bg={C.accS}>required</Pill>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          {["office","home"].map(t=>(<button key={t} onClick={()=>setCBpType(t)} style={{flex:1,padding:"4px 0",borderRadius:4,border:`1px solid ${cBpType===t?C.acc:C.bdr}`,background:cBpType===t?C.accS:"transparent",color:cBpType===t?C.acc:C.t2,fontSize:10,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{t==="office"?"Office":"Home"}</button>))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>SBP (mmHg)</div><Inp value={cSbp} onChange={setCSbp} placeholder="mmHg" type="number"/></div>
          <div><div style={{fontSize:9,color:C.t2,marginBottom:1}}>DBP (mmHg)</div><Inp value={cDbp} onChange={setCDbp} placeholder="mmHg" type="number"/></div>
        </div>
        <LabInputs rTid={cRTid} setRTid={setCRTid} rV={cRV} setRV={setCRV} aTid={cATid} setATid={setCATid} aV={cAV} setAV={setCAV} kV={cKV} setKV={setCKV}/>
        <div style={{marginTop:6}}>
          <div style={{fontSize:9,color:C.t2,marginBottom:1}}>eGFR</div>
          <div style={{display:"flex",gap:3,marginBottom:3}}>
            {["direct","auto"].map(m=>(<button key={m} onClick={()=>setCEgM(m)} style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${cEgM===m?C.acc:C.bdr}`,background:cEgM===m?C.accS:"transparent",color:cEgM===m?C.acc:C.t2,fontSize:9,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{m==="direct"?"eGFR":"From Cr"}</button>))}
          </div>
          {cEgM==="direct"?<Inp value={cEgD} onChange={setCEgD} placeholder="eGFR" type="number"/>:<>
            <div style={{display:"flex",gap:3,marginBottom:2}}>
              {[{v:"mg",l:"mg/dL"},{v:"umol",l:"µmol/L"}].map(u=>(<button key={u.v} onClick={()=>setCCrUnit(u.v)} style={{padding:"2px 5px",borderRadius:3,border:`1px solid ${cCrUnit===u.v?C.acc:C.bdr}`,background:cCrUnit===u.v?C.accS:"transparent",color:cCrUnit===u.v?C.acc:C.t2,fontSize:8,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{u.l}</button>))}
            </div>
            <Inp value={cCr} onChange={setCCr} placeholder={cCrUnit==="mg"?"Cr":"µmol/L"} type="number"/>
            {cEgC&&<div style={{fontSize:9,color:C.acc,marginTop:1}}>→ eGFR ≈ {cEgC}</div>}
          </>}
        </div>
        <MedBox text={cMedText} onChange={setCMedText} parsed={cParsed} label="Current medications"/>
      </div>
    </div>
    {!dataSnap&&<Btn primary onClick={submitData} disabled={!canSubmitData}>Submit & Assess</Btn>}
    {dataSnap&&dataChanged&&<div style={{background:C.card,border:`1px solid ${C.w}44`,borderRadius:8,padding:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.w}}>⚠ Data changed.</span><Btn small primary onClick={()=>{clearMgmt();submitData();}} style={{width:"auto"}}>Re-submit</Btn></div>}
    </>)}

    {/* Section 3: PASO Outcome */}
    {dataSnap&&paso&&(<>
    <SectionHead number={3} title="PASO Surgical Outcome" active={true}/>
    <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:10,color:C.t3,marginBottom:8}}>Based on PASO criteria (Williams et al., Lancet Diabetes Endocrinol 2017). Clinical success uses modified BP target of &lt;130/80 mmHg.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:C.bg,borderRadius:7,padding:10,border:`1px solid ${pamoCols[paso.biochem]}33`}}>
          <div style={{fontSize:10,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Biochemical</div>
          <Pill c={pamoCols[paso.biochem]} bg={pamoCols[paso.biochem]+"18"}>{paso.biochem}</Pill>
          <div style={{marginTop:6,fontSize:10,color:C.t2,lineHeight:1.5}}>
            <div>{paso.kCorrected?"✅":"❌"} K⁺ corrected{paso.bKOk?"":" (was normal at baseline)"}</div>
            <div>{paso.reninNorm?"✅":"❌"} Renin normalized</div>
            {paso.biochem!=="complete"&&<div>{paso.aldoHalved?"✅":"❌"} Aldosterone ≥50% reduction ({paso.aldoDrop}%)</div>}
          </div>
        </div>
        <div style={{background:C.bg,borderRadius:7,padding:10,border:`1px solid ${pamoCols[paso.clinical]}33`}}>
          <div style={{fontSize:10,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Clinical</div>
          <Pill c={pamoCols[paso.clinical]} bg={pamoCols[paso.clinical]+"18"}>{paso.clinical}</Pill>
          <div style={{marginTop:6,fontSize:10,color:C.t2,lineHeight:1.5}}>
            <div>{paso.bpNorm?"✅":"❌"} BP &lt;130/80 (modified)</div>
            <div>{paso.noMeds?"✅":"❌"} Off all antihypertensives</div>
            {paso.clinical==="partial"&&<div style={{color:C.t3,marginTop:2}}>{paso.bpImproved?`SBP dropped ${paso.sbpDrop} mmHg`:paso.bpNorm?"BP at target but still on meds":`Fewer meds (${paso.bMedCount}→${paso.cMedCount})`}</div>}
          </div>
        </div>
      </div>
    </div>
    </>)}

    {/* Section 4: Management */}
    {dataSnap&&(<>
    <SectionHead number={paso?4:3} title="Post-Surgical Management" active={true}/>

    {/* eGFR < 30 */}
    {egfr!==null&&!isNaN(egfr)&&egfr<30&&(
      <Box type="red" title="eGFR < 30">eGFR is below 30 mL/min/1.73m². <strong>Refer to nephrology</strong> for evaluation of kidney dysfunction. MRA therapy and further antihypertensive titration should be deferred pending nephrology input.</Box>
    )}

    {/* Renin status */}
    {(egfr===null||isNaN(egfr)||egfr>=30)&&cRenSup&&(
      <Box type="warn" title="Renin Remains Suppressed After Adrenalectomy">
        Persistent renin suppression suggests ongoing autonomous aldosterone production. This may indicate residual or bilateral disease. {bpHigh?"Given SBP ≥130 mmHg, consider starting targeted MRA therapy.":"Blood pressure is currently controlled. Monitor closely and consider MRA therapy if BP rises."}
      </Box>
    )}
    {(egfr===null||isNaN(egfr)||egfr>=30)&&!cRenSup&&!bpHigh&&(
      <Box type="green" title="Renin Normalized, BP at Target">
        Renin is no longer suppressed, consistent with biochemical remission. Blood pressure is below 130 mmHg systolic. Continue routine follow-up.
      </Box>
    )}
    {(egfr===null||isNaN(egfr)||egfr>=30)&&!cRenSup&&bpHigh&&(
      <Box type="info" title="Renin Normalized but BP Above Target">
        Renin is no longer suppressed, suggesting the primary aldosteronism has been addressed surgically. Persistent hypertension is likely due to underlying essential hypertension. Consider uptitrating antihypertensive medications according to standard guidelines for essential hypertension.
      </Box>
    )}

    {/* MRA recommendation for suppressed renin + high BP + eGFR ok */}
    {(egfr!==null&&!isNaN(egfr)&&egfr>=30)&&cRenSup&&bpHigh&&(<div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Recommend: Start MRA therapy for persistent aldosteronism</div>
      {!onMRA&&(<>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:C.t2,marginBottom:2}}>Has the patient experienced prior side effects with MRAs?</div>
          <div style={{display:"flex",gap:5}}>
            {[{v:"no",l:"No"},{v:"yes",l:"Yes"}].map(o=>(<button key={o.v} onClick={()=>{setPriorMRASE(o.v);setAcceptChange("");setMgmtSnap(null);}} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${priorMRASE===o.v?C.acc:C.bdr}`,background:priorMRASE===o.v?C.accS:"transparent",color:priorMRASE===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
          </div>
        </div>
        {priorMRASE==="no"&&<Box type="green" title="Start Spironolactone 12.5 mg daily">Check electrolytes and creatinine at 2 weeks.</Box>}
        {priorMRASE==="yes"&&<Box type="info" title="Start Eplerenone 25 mg BID">Lower sexual side effect risk. Check electrolytes and creatinine at 2 weeks.</Box>}
      </>)}
      {onMRA&&<div style={{fontSize:12,color:C.t1}}>Patient is already on {currentMRA.name} {currentMRA.detectedDose||"?"} mg. Consider uptitration using the Titrate Medical Therapy tool.</div>}
    </div>)}

    {/* Accept */}
    {(egfr!==null&&!isNaN(egfr)&&egfr<30)||((cRenSup&&bpHigh&&(priorMRASE||onMRA))||(!cRenSup&&bpHigh)||(!cRenSup&&!bpHigh))?(
      <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9,padding:14,marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:C.wh,marginBottom:6}}>Accept Plan?</div>
        <div style={{display:"flex",gap:5}}>
          {[{v:"yes",l:"Yes — accept"},{v:"no",l:"No — defer"}].map(o=>(<button key={o.v} onClick={()=>{setAcceptChange(o.v);setMgmtSnap(null);}} style={{flex:1,padding:"6px 0",borderRadius:5,border:`1px solid ${acceptChange===o.v?C.acc:C.bdr}`,background:acceptChange===o.v?C.accS:"transparent",color:acceptChange===o.v?C.acc:C.t2,fontSize:11,fontWeight:600,fontFamily:F,cursor:"pointer"}}>{o.l}</button>))}
        </div>
        {acceptChange==="yes"&&<div style={{marginTop:6,fontSize:11,color:C.g}}>✅ Accepted.{(egfr>=30)&&cRenSup&&bpHigh?" Check lytes/Cr at 2 weeks.":""} Follow up in {(egfr<30)||cRenSup||bpHigh?"1–2 months":"4–6 months"}.</div>}
        {acceptChange==="no"&&<div style={{marginTop:6,fontSize:11,color:C.t2}}>Deferred. Follow up in 4–6 months.</div>}
      </div>
    ):null}

    {acceptChange&&!mgmtSnap&&<Btn primary onClick={submitMgmt}>Generate Clinical Note</Btn>}
    </>)}

    {/* Clinical Note */}
    {mgmtSnap&&(()=>{
      const sexWord=sex==="M"?"male":"female";
      const ageLabel=age==="21"?"18-24":age==="30"?"25-34":age==="42"?"35-49":age==="57"?"50-64":age==="72"?"65-79":"80+";
      const sideWord=demoSnap.adxSide==="left"?"left":"right";
      const adxDate=demoSnap.adxMo?["","January","February","March","April","May","June","July","August","September","October","November","December"][parseInt(demoSnap.adxMo)]||"":"";
      const medSummary=meds.length>0?meds.map(m=>`${m.name} ${m.detectedDose||"?"} ${m.unit} ${m.detectedFreq||m.freq}`).join(", "):"none";

      let note=`Assessment:\nThis ${sexWord} patient (age ${ageLabel}) with primary aldosteronism is being seen for post-adrenalectomy follow-up. The patient underwent ${sideWord} adrenalectomy${adxDate||demoSnap.adxYr?` in ${adxDate}${demoSnap.adxYr?" "+demoSnap.adxYr:""}`:""}.`;
      if(demoSnap.hadNodule==="yes") note+=` Pathology confirmed a${demoSnap.noduleSize?` ${demoSnap.noduleSize} cm`:""} nodule.`;
      else note+=` No discrete nodule was identified on pathology.`;
      note+=` Current BP is ${cs.sbp}/${cs.dbp} mmHg (${cs.bpType}). K⁺ is ${cs.kV} mmol/L. eGFR is ${Math.round(cs.egfr)} mL/min/1.73m². Current medications: ${medSummary}.`;
      note+=` Renin is ${cs.rV} ${cRen.u} (${cRenSup?"suppressed":"no longer suppressed"}).`;

      if(paso){
        const bDate=bs.mo?["","January","February","March","April","May","June","July","August","September","October","November","December"][parseInt(bs.mo)]||"":"";
        note+=`\n\nPASO Surgical Outcome Assessment (compared to pre-surgery baseline${bDate||bs.yr?` ${bDate}${bs.yr?" "+bs.yr:""}`:""}):\n`;
        // Biochemical narrative
        if(paso.biochem==="complete") note+=`The patient has achieved complete biochemical success. Renin has normalized and ${paso.bKOk?"hypokalemia has corrected":"potassium remains normal"}, consistent with remission of autonomous aldosterone production.`;
        else if(paso.biochem==="partial") note+=`The patient has achieved partial biochemical success. ${paso.kCorrected?(paso.bKOk?"Hypokalemia has corrected":"Potassium remains normal"):"Hypokalemia persists"}, but renin remains suppressed. Aldosterone has decreased by ${paso.aldoDrop}% from baseline (≥50% reduction), suggesting significant but incomplete biochemical response.`;
        else note+=`The patient has not achieved a meaningful biochemical response. Renin remains suppressed${paso.aldoHalved?", though aldosterone has decreased by "+paso.aldoDrop+"% from baseline":` and aldosterone has not decreased sufficiently (${paso.aldoDrop}% reduction, <50%)`}. This may indicate persistent or bilateral disease.`;

        // Clinical narrative
        if(paso.clinical==="complete") note+=` Clinically, the response is complete — blood pressure is below 130/80 mmHg without any antihypertensive medications.`;
        else if(paso.clinical==="partial"){
          note+=` Clinically, the response is partial — `;
          if(paso.bpImproved&&paso.fewerMeds) note+=`systolic blood pressure has dropped by ${paso.sbpDrop} mmHg and the number of antihypertensives has been reduced from ${paso.bMedCount} to ${paso.cMedCount}.`;
          else if(paso.bpImproved) note+=`systolic blood pressure has dropped by ${paso.sbpDrop} mmHg.`;
          else if(paso.bpNorm&&!paso.noMeds) note+=`blood pressure has reached target (<130/80 mmHg), though the patient requires ${paso.cMedCount} antihypertensive${paso.cMedCount!==1?"s":""} to achieve this.`;
          else if(paso.fewerMeds) note+=`the number of antihypertensives has been reduced from ${paso.bMedCount} to ${paso.cMedCount}.`;
        }
        else note+=` Clinically, there has been no improvement — blood pressure is the same or higher on the same or more antihypertensive medications.`;
        note+=` (Note: clinical success assessed using a modified BP target of <130/80 mmHg rather than the original PASO threshold of <140/90 mmHg.)`;
      }

      // Management plan
      const egLow=cs.egfr!==null&&!isNaN(cs.egfr)&&cs.egfr<30;
      note+=`\n\nPlan:\n`;
      if(acceptChange==="yes"){
        if(egLow){
          note+=`- eGFR is ${Math.round(cs.egfr)} mL/min/1.73m² — refer to nephrology for evaluation of kidney dysfunction\n`;
          note+=`- Defer MRA therapy and further antihypertensive titration pending nephrology input\n`;
          note+=`- Follow up in 1–2 months`;
        } else if(cRenSup&&bpHigh){
          if(!onMRA&&priorMRASE==="no") note+=`- Start spironolactone 12.5 mg daily for persistent aldosteronism\n- Check electrolytes and creatinine at 2 weeks\n`;
          else if(!onMRA&&priorMRASE==="yes") note+=`- Start eplerenone 25 mg BID for persistent aldosteronism\n- Check electrolytes and creatinine at 2 weeks\n`;
          else if(onMRA) note+=`- Continue current MRA therapy; consider uptitration\n`;
          note+=`- Follow up in 1–2 months`;
        } else if(!cRenSup&&bpHigh){
          note+=`- Renin normalized — persistent hypertension likely reflects underlying essential hypertension\n`;
          note+=`- Uptitrate antihypertensive medications according to standard hypertension guidelines\n`;
          note+=`- Follow up in 1–2 months`;
        } else {
          note+=`- Continue routine follow-up\n`;
          note+=`- Monitor blood pressure, electrolytes, and renin annually\n`;
          note+=`- Follow up in 4–6 months`;
        }
      } else {
        note+=`- Proposed changes deferred\n- Continue current regimen\n- Follow up in 4–6 months`;
      }
      logData("tool_post_adx",{age_range:age,sex:sex,adx_side:demoSnap.adxSide,current_sbp:cs.sbp,current_k:cs.kV,renin_suppressed:cRenSup,med_count:meds.length,paso_biochem:paso?paso.biochem:null,paso_clinical:paso?paso.clinical:null,accepted:acceptChange});
      return <CopyNote text={note}/>;
    })()}

    {/* Reset */}
    <div style={{textAlign:"center",marginTop:14}}>
      <Btn small onClick={()=>{setDemoSnap(null);clearFromData();setAge("");setSex("");setAdxSide("");setHadNodule("");setNoduleSize("");setAdxMo("");setAdxYr("");setBMo("");setBYr("");setBSbp("");setBDbp("");setBRTid("pra_ng");setBRV("");setBATid("ia_ngdl");setBAV("");setBKV("");setBMedText("");setCSbp("");setCDbp("");setCRTid("pra_ng");setCRV("");setCATid("ia_ngdl");setCAV("");setCKV("");setCEgD("");setCCr("");setCMedText("");}}>🔄 New Patient</Btn>
    </div>
    <p style={{fontSize:9,color:C.t3,textAlign:"center",marginTop:16}}>Adapted from: Williams TA et al., Lancet Diabetes Endocrinol 2017; Adler GK et al., JCEM 2025. Educational only.</p>
  </>;
}

export default function PA(){
  return <ErrorBoundary><PAInner/></ErrorBoundary>;
}
