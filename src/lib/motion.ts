/* eslint-disable */
// @ts-nocheck
// Motor de animación de técnica (figura SVG con cinemática directa), portado del prototipo Banana Burn.
const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let running = false;
const L={shin:38,thigh:40,torso:50,neck:15,ua:28,fa:26,foot:12};
const P=(p,len,a)=>[p[0]+len*Math.cos(a*Math.PI/180),p[1]+len*Math.sin(a*Math.PI/180)];
function solve(mode,q){
  const j={};
  if(mode==='ankle'){
    j.ankle=q.root||[100,178]; j.knee=P(j.ankle,L.shin,q.shin); j.hip=P(j.knee,L.thigh,q.thigh);
    j.sh=P(j.hip,L.torso,q.torso); j.head=P(j.sh,L.neck,q.neck); j.el=P(j.sh,L.ua,q.ua); j.wr=P(j.el,L.fa,q.fa);
  }else if(mode==='hip'){
    j.hip=q.root; j.sh=P(j.hip,L.torso,q.torso); j.knee=P(j.hip,L.thigh,q.thigh); j.ankle=P(j.knee,L.shin,q.shin);
    j.head=P(j.sh,L.neck,q.neck); j.el=P(j.sh,L.ua,q.ua); j.wr=P(j.el,L.fa,q.fa);
  }else if(mode==='hand'){
    j.wr=q.root; j.el=P(j.wr,L.fa,q.fa); j.sh=P(j.el,L.ua,q.ua); j.hip=P(j.sh,L.torso,q.torso);
    j.knee=P(j.hip,L.thigh,q.thigh); j.ankle=P(j.knee,L.shin,q.shin); j.head=P(j.sh,L.neck,q.neck);
  }
  j.toe=P(j.ankle,L.foot,q.foot??0);
  return j;
}
const ANIM={
  squat:{mode:'ankle',props:['rack','barbell'],bar:j=>[j.sh[0]-4,j.sh[1]-5],hi:['thigh','shin','torso'],
    A:{shin:-90,thigh:-90,torso:-90,neck:-80,ua:127,fa:-66},
    B:{shin:-60,thigh:-189,torso:-50,neck:-55,ua:167,fa:-26},
    ph:[['B',3,'Baja lento · 3 s','ecc'],['B',.8,'Pausa abajo','hold'],['A',1,'Sube fuerte','con'],['A',.7,'Respira y aprieta','hold']]},
  frontsquat:{mode:'ankle',props:['barbell'],bar:j=>j.wr,hi:['thigh','shin'],
    A:{shin:-90,thigh:-90,torso:-90,neck:-82,ua:-10,fa:172},
    B:{shin:-55,thigh:-185,torso:-62,neck:-60,ua:18,fa:200},
    ph:[['B',3,'Baja lento · 3 s','ecc'],['B',.7,'Pausa abajo','hold'],['A',1,'Sube fuerte','con'],['A',.7,'Codos altos','hold']]},
  bench:{mode:'hip',props:['bench','barbell'],bar:j=>j.wr,hi:['ua','torso'],
    A:{root:[72,120],torso:0,thigh:150,shin:100,neck:-12,ua:-95,fa:-92},
    B:{root:[72,120],torso:0,thigh:150,shin:100,neck:-12,ua:-208,fa:-80},
    ph:[['B',3,'Baja lento · 3 s','ecc'],['B',.6,'Toca pecho','hold'],['A',1,'Empuja fuerte','con'],['A',.7,'Escápulas atrás','hold']]},
  incline:{mode:'hip',props:['incline','dumbbell'],bar:j=>j.wr,hi:['ua','torso'],
    A:{root:[72,128],torso:-28,thigh:160,shin:96,neck:-35,ua:-100,fa:-96},
    B:{root:[72,128],torso:-28,thigh:160,shin:96,neck:-35,ua:-212,fa:-78},
    ph:[['B',3,'Baja lento · 3 s','ecc'],['B',.5,'Estira pecho','hold'],['A',1,'Empuja fuerte','con'],['A',.7,'Aprieta','hold']]},
  ohp:{mode:'ankle',props:['barbell'],bar:j=>j.wr,hi:['ua','fa'],
    A:{shin:-90,thigh:-90,torso:-92,neck:-80,ua:70,fa:-85},
    B:{shin:-90,thigh:-90,torso:-88,neck:-95,ua:-85,fa:-88},
    ph:[['B',1,'Empuja arriba','con'],['B',.5,'Bloquea','hold'],['A',3,'Baja lento · 3 s','ecc'],['A',.6,'Glúteo y abdomen duros','hold']]},
  dbpress:{mode:'ankle',props:['dumbbell'],bar:j=>j.wr,hi:['ua','fa'],
    A:{shin:-90,thigh:-90,torso:-92,neck:-80,ua:60,fa:-88},
    B:{shin:-90,thigh:-90,torso:-90,neck:-88,ua:-88,fa:-90},
    ph:[['B',1,'Empuja arriba','con'],['B',.4,'Arriba','hold'],['A',3,'Baja lento · 3 s','ecc'],['A',.6,'Abajo','hold']]},
  deadlift:{mode:'ankle',props:['barbell'],bar:j=>j.wr,big:true,hi:['torso','thigh'],
    A:{shin:-72,thigh:-160,torso:-32,neck:-22,ua:95,fa:95},
    B:{shin:-90,thigh:-90,torso:-92,neck:-80,ua:92,fa:92},
    ph:[['B',1.2,'Empuja el suelo','con'],['B',.6,'Bloquea glúteos','hold'],['A',2.2,'Baja controlado','ecc'],['A',.8,'Reset y aire','hold']]},
  rdl:{mode:'ankle',props:['barbell'],bar:j=>j.wr,big:true,hi:['thigh','torso'],
    A:{shin:-88,thigh:-95,torso:-92,neck:-80,ua:92,fa:92},
    B:{shin:-82,thigh:-135,torso:-20,neck:-10,ua:100,fa:100},
    ph:[['B',3,'Cadera atrás · 3 s','ecc'],['B',.5,'Estira isquios','hold'],['A',1,'Cadera adelante','con'],['A',.6,'Aprieta glúteo','hold']]},
  pullup:{mode:'hand',props:['pullbar'],hi:['ua','torso'],
    A:{root:[100,-10],fa:90,ua:90,torso:92,thigh:98,shin:115,neck:-90},
    B:{root:[100,-10],fa:70,ua:195,torso:100,thigh:105,shin:125,neck:-80},
    ph:[['B',1.2,'Tira con la espalda','con'],['B',.5,'Barbilla arriba','hold'],['A',3,'Baja lento · 3 s','ecc'],['A',.6,'Cuelga activo','hold']]},
  dips:{mode:'hand',props:['dipbars'],hi:['ua','torso'],
    A:{root:[100,78],fa:-90,ua:-90,torso:95,thigh:110,shin:150,neck:-88},
    B:{root:[100,78],fa:-95,ua:15,torso:112,thigh:125,shin:165,neck:-70},
    ph:[['B',3,'Baja lento · 3 s','ecc'],['B',.5,'Estira','hold'],['A',1,'Empuja fuerte','con'],['A',.6,'Bloquea','hold']]},
  row:{mode:'ankle',props:['barbell'],bar:j=>j.wr,hi:['ua','torso'],
    A:{shin:-80,thigh:-130,torso:-22,neck:-10,ua:100,fa:92},
    B:{shin:-80,thigh:-130,torso:-22,neck:-10,ua:210,fa:88},
    ph:[['B',1,'Codos atrás','con'],['B',.8,'Aprieta escápulas','hold'],['A',2.5,'Baja lento','ecc'],['A',.5,'Estira','hold']]},
  dbrow:{mode:'ankle',props:['dumbbell','benchlow'],bar:j=>j.wr,hi:['ua','torso'],
    A:{shin:-84,thigh:-128,torso:-14,neck:-6,ua:96,fa:92},
    B:{shin:-84,thigh:-128,torso:-14,neck:-6,ua:208,fa:86},
    ph:[['B',1,'Codo al bolsillo','con'],['B',.8,'Aprieta','hold'],['A',2.5,'Baja lento','ecc'],['A',.5,'Estira','hold']]},
  curl:{mode:'ankle',props:['barbell-sm'],bar:j=>j.wr,hi:['fa','ua'],
    A:{shin:-90,thigh:-90,torso:-91,neck:-82,ua:92,fa:92},
    B:{shin:-90,thigh:-90,torso:-91,neck:-82,ua:98,fa:-55},
    ph:[['B',1,'Sube sin balanceo','con'],['B',.6,'Aprieta bíceps','hold'],['A',3,'Baja lento · 3 s','ecc'],['A',.4,'Abajo','hold']]},
  facepull:{mode:'ankle',props:['cable'],bar:j=>j.wr,hi:['ua'],
    A:{shin:-92,thigh:-88,torso:-95,neck:-85,ua:-8,fa:-8},
    B:{shin:-92,thigh:-88,torso:-95,neck:-85,ua:-175,fa:-30},
    ph:[['B',1,'Tira a la cara','con'],['B',.8,'Rota hacia atrás','hold'],['A',2.5,'Vuelve lento','ecc'],['A',.4,'Estira','hold']]},
  pushup:{mode:'ankle',props:[],hi:['ua','torso'],
    A:{root:[40,172],shin:-22,thigh:-22,torso:-22,neck:-18,ua:90,fa:90,foot:42},
    B:{root:[40,172],shin:-6,thigh:-6,torso:-6,neck:-4,ua:180,fa:45,foot:42},
    ph:[['B',3,'Baja lento · 3 s','ecc'],['B',.5,'Pecho cerca del piso','hold'],['A',1,'Empuja fuerte','con'],['A',.5,'Cuerpo en tabla','hold']]},
  plank:{mode:'ankle',props:[],hi:['torso','thigh'],
    A:{root:[40,172],shin:-12,thigh:-12,torso:-12,neck:-8,ua:90,fa:0,foot:42},
    B:{root:[40,172],shin:-12,thigh:-15,torso:-10,neck:-8,ua:91,fa:0,foot:42},
    ph:[['B',2,'Respira sin soltar','con'],['A',2,'Glúteo y abdomen duros','ecc']]},
  kneeraise:{mode:'hand',props:['pullbar'],hi:['torso','thigh'],
    A:{root:[100,-10],fa:90,ua:90,torso:92,thigh:95,shin:100,neck:-90},
    B:{root:[100,-10],fa:88,ua:92,torso:98,thigh:-5,shin:85,neck:-90},
    ph:[['B',1,'Rodillas al pecho','con'],['B',.5,'Aprieta abdomen','hold'],['A',2.5,'Baja lento','ecc'],['A',.5,'Sin balanceo','hold']]},
  carry:{mode:'ankle',props:['dumbbell'],bar:j=>j.wr,hi:['torso','fa'],
    A:{shin:-90,thigh:-90,torso:-91,neck:-82,ua:92,fa:90},
    B:{shin:-82,thigh:-98,torso:-92,neck:-82,ua:93,fa:91},
    ph:[['B',.6,'Paso firme','con'],['A',.6,'Pecho alto, hombros abajo','ecc']]},
  lateral:{mode:'front',props:['dumbbell'],hi:['ua'],
    A:{a:80},B:{a:-4},
    ph:[['B',1,'Sube con el codo','con'],['B',.6,'Pausa arriba','hold'],['A',3,'Baja lento · 3 s','ecc'],['A',.4,'Abajo','hold']]}
};
// Variantes sin equipo (misma cinemática, sin barra ni discos)
Object.assign(ANIM,{
  squat_bw:{...ANIM.squat,props:[],bar:null,A:{...ANIM.squat.A,ua:-10,fa:-10},B:{...ANIM.squat.B,ua:20,fa:10}},
  jump_bw:{...ANIM.squat,props:[],bar:null,A:{...ANIM.squat.A,ua:100,fa:100},B:{...ANIM.squat.B,ua:150,fa:120},ph:[['B',.8,'Baja rápido','ecc'],['A',.5,'¡Salta!','con'],['A',.6,'Aterriza suave','hold']]},
  rdl_bw:{...ANIM.rdl,props:[],bar:null},
  curl_bw:{...ANIM.curl,props:[],bar:null},
  burpee:{...ANIM.pushup,ph:[['B',.7,'Pecho al piso','ecc'],['A',.6,'Empuja y salta','con'],['A',.4,'Arriba','hold']]},
  mountain:{...ANIM.plank,A:{...ANIM.pushup.A},B:{...ANIM.pushup.A,thigh:-70,shin:-150},ph:[['B',.35,'Rodilla al pecho','con'],['A',.35,'Cambia rápido','ecc']]},
});
const lerp=(a,b,t)=>a+(b-a)*t;
const ease={con:t=>1-Math.pow(1-t,3),ecc:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,hold:t=>t};
function poseAt(an,time){
  const total=an.ph.reduce((s,p)=>s+p[1],0); let t=time%total, cur='A';
  for(const [to,d,label,k] of an.ph){
    if(t<=d){const from=cur;const e=ease[k](d?t/d:1);const q={};const A=an[from],B=an[to];
      for(const key in A){q[key]=Array.isArray(A[key])?[lerp(A[key][0],B[key][0],e),lerp(A[key][1],B[key][1],e)]:lerp(A[key],B[key],e)}
      return {q,label,k,prog:(time%total)/total,phaseProg:d?t/d:1};}
    t-=d; cur=to;
  }
  return {q:an.A,label:'',k:'hold',prog:0,phaseProg:0};
}
const SVGNS='http://www.w3.org/2000/svg';
const mk=(tag,attrs,parent)=>{const e=document.createElementNS(SVGNS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);parent&&parent.appendChild(e);return e};
const FIGS=new Set();
function buildFigure(container,key,{label=true}={}){
  const an=ANIM[key]; if(!an) return;
  const svg=mk('svg',{viewBox:'0 -34 200 222',role:'img','aria-label':'Animación de técnica'});
  container.prepend(svg);
  const defs=mk('defs',{},svg);
  const f=mk('filter',{id:'gl'+Math.random().toString(36).slice(2,7),x:'-50%',y:'-50%',width:'200%',height:'200%'},defs);
  mk('feGaussianBlur',{stdDeviation:'3.2',result:'b'},f); const m=mk('feMerge',{},f); mk('feMergeNode',{in:'b'},m); mk('feMergeNode',{in:'SourceGraphic'},m);
  mk('line',{x1:0,y1:180,x2:200,y2:180,stroke:'var(--line)','stroke-width':2},svg);
  mk('ellipse',{cx:100,cy:181,rx:46,ry:4,fill:'var(--line)',opacity:.6},svg);
  const g={svg,an,key,el:{}};
  const props=mk('g',{},svg);
  // static props
  if(an.props.includes('rack')){mk('line',{x1:150,y1:20,x2:150,y2:180,stroke:'var(--faint)','stroke-width':3,opacity:.5},props);mk('line',{x1:142,y1:46,x2:152,y2:46,stroke:'var(--faint)','stroke-width':3,opacity:.5},props)}
  if(an.props.includes('bench')){mk('rect',{x:46,y:127,width:96,height:7,rx:3,fill:'var(--faint)',opacity:.7},props);mk('line',{x1:60,y1:134,x2:60,y2:180,stroke:'var(--faint)','stroke-width':4,opacity:.6},props);mk('line',{x1:128,y1:134,x2:128,y2:180,stroke:'var(--faint)','stroke-width':4,opacity:.6},props);mk('line',{x1:150,y1:40,x2:150,y2:180,stroke:'var(--faint)','stroke-width':3,opacity:.4},props)}
  if(an.props.includes('incline')){const h=an.A.root;const end=P(h,62,an.A.torso);mk('line',{x1:h[0]-24,y1:h[1]+8,x2:end[0]+4,y2:end[1]+8,stroke:'var(--faint)','stroke-width':7,'stroke-linecap':'round',opacity:.7},props);mk('line',{x1:h[0],y1:h[1]+10,x2:h[0],y2:180,stroke:'var(--faint)','stroke-width':4,opacity:.6},props)}
  if(an.props.includes('benchlow')){mk('rect',{x:120,y:120,width:60,height:7,rx:3,fill:'var(--faint)',opacity:.6},props);mk('line',{x1:170,y1:127,x2:170,y2:180,stroke:'var(--faint)','stroke-width':4,opacity:.5},props)}
  if(an.props.includes('pullbar')){mk('line',{x1:60,y1:-10,x2:150,y2:-10,stroke:'var(--faint)','stroke-width':2,opacity:.35},props);mk('circle',{cx:100,cy:-10,r:4.5,fill:'var(--faint)'},props);mk('line',{x1:150,y1:-10,x2:150,y2:180,stroke:'var(--faint)','stroke-width':3,opacity:.4},props)}
  if(an.props.includes('dipbars')){mk('circle',{cx:100,cy:80,r:4,fill:'var(--faint)'},props);mk('line',{x1:100,y1:84,x2:100,y2:180,stroke:'var(--faint)','stroke-width':3,opacity:.5},props)}
  if(an.props.includes('cable')){mk('rect',{x:186,y:-20,width:8,height:200,rx:3,fill:'var(--faint)',opacity:.45},props);g.el.cable=mk('line',{stroke:'var(--faint)','stroke-width':1.6,'stroke-dasharray':'3 3'},props)}
  g.el.trail=mk('path',{fill:'none',stroke:'var(--banana)','stroke-width':1.2,'stroke-dasharray':'2 4',opacity:.55},svg);
  const body=mk('g',{'stroke-linecap':'round','stroke-linejoin':'round'},svg);
  const hiF=`url(#${f.id})`;
  const bone=(name,w)=>{const hot=an.hi.includes(name);return mk('line',{stroke:hot?'var(--ember)':'var(--figure)','stroke-width':w,filter:hot?hiF:''},body)};
  if(an.mode==='front'){
    g.el.legL=mk('line',{x1:93,y1:104,x2:91,y2:178,stroke:'var(--figure)','stroke-width':10},body);
    g.el.legR=mk('line',{x1:107,y1:104,x2:109,y2:178,stroke:'var(--figure)','stroke-width':10},body);
    mk('path',{d:'M84 54 L116 54 L110 104 L90 104 Z',fill:'var(--figure)'},body);
    g.el.uaL=bone('ua',8);g.el.faL=bone('fa',7);g.el.uaR=bone('ua',8);g.el.faR=bone('fa',7);
    mk('circle',{cx:100,cy:36,r:10,fill:'var(--figure)'},body);
    g.el.dL=mk('rect',{width:6,height:16,rx:2,fill:'var(--banana)'},body);g.el.dR=mk('rect',{width:6,height:16,rx:2,fill:'var(--banana)'},body);
  }else{
    g.el.foot=bone('foot',7);g.el.shin=bone('shin',9);g.el.thigh=bone('thigh',11);g.el.torso=bone('torso',14);
    g.el.neck=mk('line',{stroke:'var(--figure)','stroke-width':6},body);
    g.el.head=mk('circle',{r:10,fill:'var(--figure)'},body);
    g.el.ua=bone('ua',8);g.el.fa=bone('fa',7);
    if(an.props.includes('barbell')){g.el.plate=mk('circle',{r:an.big?22:18,fill:'none',stroke:'var(--banana)','stroke-width':5},svg);g.el.hub=mk('circle',{r:3.5,fill:'var(--banana)'},svg)}
    if(an.props.includes('barbell-sm')){g.el.plate=mk('circle',{r:9,fill:'none',stroke:'var(--banana)','stroke-width':4},svg);g.el.hub=mk('circle',{r:2.5,fill:'var(--banana)'},svg)}
    if(an.props.includes('dumbbell')){g.el.db=mk('rect',{width:18,height:9,rx:3,fill:'var(--banana)'},svg)}
    if(an.props.includes('cable')){g.el.handle=mk('circle',{r:4,fill:'var(--banana)'},svg)}
  }
  if(label){
    g.el.lab=mk('text',{x:6,y:-20,'font-family':'-apple-system, Inter, sans-serif','font-size':10,'font-weight':600,fill:'var(--muted)'},svg);
    g.el.barbg=mk('rect',{x:6,y:-14,width:188,height:3,rx:1.5,fill:'var(--line)'},svg);
    g.el.bar=mk('rect',{x:6,y:-14,width:0,height:3,rx:1.5,fill:'var(--ember)'},svg);
  }
  // precompute trail
  if(an.mode!=='front'){
    const total=an.ph.reduce((s,p)=>s+p[1],0);let d='';
    for(let i=0;i<=60;i++){const {q}=poseAt(an,total*i/60);const j=solve(an.mode,q);const b=an.bar?an.bar(j):j.wr;d+=(i?'L':'M')+b[0].toFixed(1)+' '+b[1].toFixed(1)}
    g.el.trail.setAttribute('d',d);
  }
  g.t0=performance.now()-Math.random()*800;
  FIGS.add(g); draw(g,reduceMotion?an.ph[0][1]:0); if(!running){running=true;requestAnimationFrame(loop)}
  return g;
}
const setL=(el,a,b)=>{el.setAttribute('x1',a[0]);el.setAttribute('y1',a[1]);el.setAttribute('x2',b[0]);el.setAttribute('y2',b[1])};
function draw(g,time){
  const an=g.an; const st=poseAt(an,time); const e=g.el;
  if(an.mode==='front'){
    const a=st.q.a; const sR=[115,56], sL=[85,56];
    const eR=P(sR,L.ua,a), wR=P(eR,L.fa,a-8); const eL=[200-eR[0],eR[1]], wL=[200-wR[0],wR[1]];
    setL(e.uaR,sR,eR);setL(e.faR,eR,wR);setL(e.uaL,sL,eL);setL(e.faL,eL,wL);
    e.dR.setAttribute('x',wR[0]-3);e.dR.setAttribute('y',wR[1]-8);e.dL.setAttribute('x',wL[0]-3);e.dL.setAttribute('y',wL[1]-8);
  }else{
    const j=solve(an.mode,st.q);
    setL(e.foot,j.ankle,j.toe);setL(e.shin,j.ankle,j.knee);setL(e.thigh,j.knee,j.hip);setL(e.torso,j.hip,j.sh);
    setL(e.neck,j.sh,P(j.sh,8,st.q.neck));e.head.setAttribute('cx',j.head[0]);e.head.setAttribute('cy',j.head[1]);
    setL(e.ua,j.sh,j.el);setL(e.fa,j.el,j.wr);
    const b=an.bar?an.bar(j):j.wr;
    if(e.plate){e.plate.setAttribute('cx',b[0]);e.plate.setAttribute('cy',b[1]);e.hub.setAttribute('cx',b[0]);e.hub.setAttribute('cy',b[1])}
    if(e.db){e.db.setAttribute('x',b[0]-9);e.db.setAttribute('y',b[1]-4.5)}
    if(e.handle){e.handle.setAttribute('cx',b[0]);e.handle.setAttribute('cy',b[1]);setL(e.cable,b,[190,36])}
  }
  if(e.lab){e.lab.textContent=(st.k==='ecc'?'▼ ':st.k==='con'?'▲ ':'• ')+st.label.toUpperCase();e.bar.setAttribute('width',(188*st.prog).toFixed(1));
    e.bar.setAttribute('fill',st.k==='ecc'?'var(--banana)':st.k==='con'?'var(--ember)':'var(--faint)')}
}
function loop(now){
  running=FIGS.size>0; if(!running) return;
  for(const g of FIGS){ if(!g.svg.isConnected){FIGS.delete(g);continue} if(!reduceMotion) draw(g,(now-g.t0)/1000) }
  requestAnimationFrame(loop);
}

export { ANIM, buildFigure };
