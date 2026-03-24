import { useState, useMemo } from "react";

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
  { id: "pra_ng", l: "PRA (ng/mL/h)", sup: 1, u: "ng/mL/h", isPRA: true, toStd: 1 },
  { id: "pra_pmol", l: "PRA (pmol/L/min)", sup: 12.9, u: "pmol/L/min", isPRA: true, toStd: 1/12.9 },
  { id: "pra_ngl", l: "PRA (ng/L/s)", sup: 0.28, u: "ng/L/s", isPRA: true, toStd: 1/0.28 },
  { id: "drc_ngl", l: "DRC (ng/L)", sup: 5.2, u: "ng/L", isPRA: false, toStd: 1/5.2 },
  { id: "drc_mu", l: "DRC (mU/L)", sup: 8.2, u: "mU/L", isPRA: false, toStd: 1/8.2 },
];
const ALD = [
  { id: "ia_ngdl", l: "Immunoassay (ng/dL)", u: "ng/dL", isIA: true, min: 10, toNg: 1 },
  { id: "ia_pmol", l: "Immunoassay (pmol/L)", u: "pmol/L", isIA: true, min: 277, toNg: 1/27.7 },
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
const Btn=({onClick,children,primary,disabled,small,style:s})=><button onClick={onClick} disabled={disabled} style={{padding:small?"5px 12px":"9px 18px",borderRadius:7,border:primary?"none":`1px solid ${C.bdr}`,background:disabled?C.bdr:primary?C.acc:C.card,color:disabled?C.t3:primary?"#fff":C.t2,fontSize:small?12:13,fontWeight:600,fontFamily:F,cursor:disabled?"not-allowed":"pointer",width:small?"auto":"100%",...s}}>{children}</button>;
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
export default function PA(){
  const [view,setView]=useState(null);
  if(!view) return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:F,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{maxWidth:480,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.acc,textTransform:"uppercase",marginBottom:8}}>Adapted from the 2025 Endocrine Society Guidelines</div>
        <h1 style={{color:C.wh,fontSize:26,fontWeight:800,margin:"0 0 4px",lineHeight:1.25}}>Primary Aldosteronism<br/>Clinical Decision Support</h1>
        <p style={{color:C.t2,fontSize:12,margin:"0 0 24px"}}>Select a tool to get started.</p>
        <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:460,margin:"0 auto",textAlign:"left"}}>
          <Btn primary onClick={()=>setView("screen")}>🩺  Primary Care: Should I Screen for Primary Aldosteronism?</Btn>
          <Btn primary onClick={()=>setView("interpret")}>🔬  Primary Care: Interpret Aldosterone & Renin Levels, and Initial Management</Btn>
          <Btn primary onClick={()=>setView("specialist")}>🏥  Specialists: Initial Consultation and Management</Btn>
          <Btn disabled>📈  Specialists: Titrate Medical Therapy</Btn>
          <Btn disabled>🔬  Specialists: Prepare for Adrenal Vein Sampling</Btn>
          <Btn disabled>🔪  Specialists: Prepare for Surgery</Btn>
          <Btn disabled>📋  Specialists: Post-Adrenalectomy Follow-Up</Btn>
        </div>
        <p style={{fontSize:10,color:C.t3,marginTop:18,lineHeight:1.5}}>Educational tool only. Not medical advice.<br/>Adapted from: Adler GK et al., JCEM 2025. DOI:10.1210/clinem/dgaf284</p>
      </div>
    </div>
  );
  const Header=()=><div style={{background:C.card,borderBottom:`1px solid ${C.bdr}`,padding:"9px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:C.acc,textTransform:"uppercase"}}>PA Tool</span><span style={{color:C.t3}}>·</span><span style={{fontSize:12,color:C.t2}}>{view==="screen"?"Primary Care: Should I Screen?":view==="specialist"?"Specialists: Initial Consultation & Management":"Primary Care: Interpret & Initial Management"}</span></div>
    <Btn small onClick={()=>setView(null)}>← Menu</Btn>
  </div>;
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:F,color:C.t1}}>
      <Header/>
      <div style={{maxWidth:600,margin:"0 auto",padding:"18px 16px 40px"}}>
        {view==="screen"&&<ScreenTool/>}
        {view==="interpret"&&<InterpretTool mode="pcp"/>}
        {view==="specialist"&&<InterpretTool mode="specialist"/>}
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
  const [rTid,setRTid]=useState("pra_ng");
  const [rV,setRV]=useState("");
  const [aTid,setATid]=useState("ia_ngdl");
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

  const ren=REN.find(r=>r.id===_rTid);
  const ald=ALD.find(a=>a.id===_aTid);
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

      {/* ══ Determine how far from threshold ══ */}
      {(() => {
        const aldoRatio = !isNaN(aN) ? aN / ald.min : null; // >1 = above threshold
        const arrRatio = (arrVal && arrTh) ? arrVal / arrTh : null;

        // FP threshold in user's units: guideline says aldo >15 ng/dL IA or >10 ng/dL LC-MS/MS = PA likely despite BB
        const fpHighThresh = ald.isIA
          ? (ald.u === "pmol/L" ? 416 : 15)   // 15 ng/dL or 416 pmol/L for IA
          : (ald.u === "pmol/L" ? 277 : 10);  // 10 ng/dL or 277 pmol/L for LC-MS/MS
        const fpStronglyPositive = !isNaN(aN) && aN > fpHighThresh;
        const fpWeaklyPositive = !isNaN(aN) && aN >= ald.min && aN <= fpHighThresh;

        // FN near-threshold: tiered by drug strength
        // Strong interferors (MRA, ENaC, drospirenone, diuretics): renin suppressed AND aldo>60% AND ARR>60%
        // Weak interferors (ACEi, ARB, CCB, SGLT2i): ALL THREE: renin suppressed AND aldo>75% AND ARR>75%
        const strongFN = fn.filter(d => d.strength === "strong" || d.strength === "intermediate");
        const weakFN = fn.filter(d => d.strength === "weak");

        const strongNear = strongFN.length > 0 && renSup && aldoRatio && aldoRatio > 0.6 && arrRatio && arrRatio > 0.6;
        const weakNear = weakFN.length > 0 && renSup && aldoRatio && aldoRatio > 0.75 && arrRatio && arrRatio > 0.75;
        const nearThreshold = !pos && (strongNear || weakNear);
        const nearMeds = [...(strongNear ? strongFN : []), ...(weakNear ? weakFN : [])];
        const clearlyNegative = (!pos && fn.length > 0) && !nearThreshold;

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
        return <CopyNote text={note}/>;
      })()}

      <div style={{textAlign:"center",marginTop:14}}>
        <Btn small onClick={()=>{setPhase("input");setSnap(null);setLatSnap(null);setMgmtSnap(null);setRV("");setAV("");setKV("");setAdnStatus("");setAdnSzMain("");setAdnSzLeft("");setCr("");setEgD("");setAge("");setSex("");setResHTN(false);setSurgCandidate("");setSurgInterest("");setSpecAvsDecision("");setForegoAvs("");}}>🔄 New Patient</Btn>
      </div>
    </div>}

    <p style={{fontSize:9,color:C.t3,textAlign:"center",marginTop:16}}>Adapted from: Adler GK et al., JCEM 2025. DOI:10.1210/clinem/dgaf284. Educational only.</p>
  </>;
}
