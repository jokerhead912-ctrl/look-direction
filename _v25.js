/* v25 回歸測試：遮罩顯示層（五態）+ 工具欄分組 + bypass / 撳實收遮罩
   重點：顯示層必須「淨影響畫面、唔入 grade」——所以用像素量度，唔靠肉眼。
   T1  描邊 / 外暗：遮罩**內部**像素必須同「關」完全一致（誤差 < 1/255）
   T2  填充：內部必須被改動（誤差 > 15/255）
   T3  白：內部必須近乎全白
   T4  外暗：外部必須被暗化
   T5  邊界：描邊同填充都要喺 0.5 等值線附近有明顯筆跡
   T6  撳實 X / ` ：即使顯示=填充，遮罩都要完全消失
   T7  bypass（K）：matte 開 vs 關嘅 grade 必須唔同
   T8  工具欄：分組、三選一、segmented、更多收摺、清除要撳兩次
   T9  顯示層改動唔可以 invalidate grade（唔好白做一次全解 render） */
const { chromium } = require('playwright');
let b=null;
(async()=>{
b=await chromium.connectOverCDP('http://127.0.0.1:9444');
const pg=await (b.contexts()[0]).newPage();
pg.setViewportSize({width:1600,height:1000});
const E=[]; pg.on('pageerror',e=>E.push(e.message));
await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
await pg.waitForTimeout(900);

const R=await pg.evaluate(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const S=window.ldKey.S;
  const cv=document.querySelector('#cv'), g=cv.getContext('2d');
  const out={};

  /* ---- 來稿：漸層 + 4px 噪點（要有局部細節先量到對比） + 中間一嚿膚色 ---- */
  const w=900,h=600,c=document.createElement('canvas'); c.width=w;c.height=h;
  const x=c.getContext('2d');
  const grd=x.createLinearGradient(0,0,w,h);
  grd.addColorStop(0,'#2a2f38'); grd.addColorStop(1,'#8d8478');
  x.fillStyle=grd; x.fillRect(0,0,w,h);
  let seed=12345; const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  for(let by=0;by<h;by+=4) for(let bx=0;bx<w;bx+=4){
    const n=(rnd()*2-1)*14;
    x.fillStyle = n>0 ? 'rgba(255,255,255,'+(n/255)+')' : 'rgba(0,0,0,'+(-n/255)+')';
    x.fillRect(bx,by,4,4);
  }
  x.fillStyle='#c08a6a'; x.beginPath(); x.ellipse(w*0.5,h*0.5,w*0.20,h*0.26,0,0,7); x.fill();
  /* 噪點要畫喺膚色塊**上面**，否則遮罩區內部冇細節 → 量唔到對比保留率 */
  for(let by=0;by<h;by+=4) for(let bx=0;bx<w;bx+=4){
    const n=(rnd()*2-1)*14;
    x.fillStyle = n>0 ? 'rgba(255,255,255,'+(n/255)+')' : 'rgba(0,0,0,'+(-n/255)+')';
    x.fillRect(bx,by,4,4);
  }
  addShot(c,'test_v25');
  await sleep(700);
  setActive(0); await sleep(500);
  /* 一定要有 grade 落去，否則 bypass（matte 開 vs 關）根本量唔到差別。
     仲要 tick「保護膚色」—— opt().skinProt = skin.checked ? S.skinProt/100 : 0，
     唔 tick 就當 0，咁保護根本冇開，bypass 自然量到 0 差別。 */
  const sk=document.querySelector('#skin'); if(sk) sk.checked=true;
  S.skinProt=100;
  S.sec.sat=-80; S.sec.con=40; S.sec.temp=30;
  S.pvKey++; S.pvCache.clear(); scheduleRender(true); await sleep(500); await sleep(400);

  /* ---- 手砌一個橢圓 matte（全選+erode 對全 1 冇效，所以直接寫） ---- */
  const K=ensureMatte();
  for(let y=0;y<K.h;y++){ const v=((y+0.5)/K.h-0.5)/0.26;
    for(let xx=0;xx<K.w;xx++){ const u=((xx+0.5)/K.w-0.5)/0.20;
      K.m[y*K.w+xx]=(u*u+v*v)<1?1:0; } }
  S.keyFeath=6; S.skinProt=100; touchKey();
  await sleep(700);
  out.coverage=+(keyCoverage()*100).toFixed(2);
  out.ver=(typeof APP_VER!=='undefined')?APP_VER:'?';
  out.hasKey=hasKey();

  const px=(u,v)=>{ const X=Math.max(0,Math.min(cv.width-1,Math.round(u*cv.width)));
    const Y=Math.max(0,Math.min(cv.height-1,Math.round(v*cv.height)));
    const d=g.getImageData(X,Y,1,1).data; return [d[0],d[1],d[2]]; };
  const grab=pts=>pts.map(p=>px(p[0],p[1]));
  const diff=(A,B)=>{ let s=0; for(let i=0;i<A.length;i++)
      s+=Math.abs(A[i][0]-B[i][0])+Math.abs(A[i][1]-B[i][1])+Math.abs(A[i][2]-B[i][2]);
    return +(s/(A.length*3)).toFixed(3); };
  const stdev=A=>{ let o=0; for(let ch=0;ch<3;ch++){ let mu=0;
      for(const p of A) mu+=p[ch]; mu/=A.length;
      let v=0; for(const p of A) v+=(p[ch]-mu)*(p[ch]-mu); o+=Math.sqrt(v/A.length); } return +(o/3).toFixed(3); };

  const IN =[[0.50,0.50],[0.45,0.50],[0.55,0.50],[0.50,0.42],[0.50,0.58],[0.46,0.46],[0.54,0.54],[0.48,0.52]];
  const OUT=[[0.03,0.03],[0.97,0.03],[0.03,0.97],[0.97,0.97],[0.50,0.03]];
  const EDGE=[]; for(let u=0.275;u<=0.325;u+=0.005) EDGE.push([u,0.50]);

  /* ---- 五態量度 ---- */
  const shot=async(mode)=>{ S.keyShow=mode; syncKeyUI(); paint(); await sleep(60);
    return {in:grab(IN), out:grab(OUT), edge:grab(EDGE)}; };
  const P={};
  for(const m of [0,1,2,3,4]) P[m]=await shot(m);
  const D={};
  for(const m of [1,2,3,4]) D[m]={ in:diff(P[m].in,P[0].in), out:diff(P[m].out,P[0].out), edge:diff(P[m].edge,P[0].edge) };
  out.pixelDiff=D;
  out.modeName={1:'描邊',2:'填充',3:'外暗',4:'白'};
  out.contrast={ baseStd:stdev(P[0].in), fillStd:stdev(P[2].in), outlineStd:stdev(P[1].in) };
  out.fillRetain=+(stdev(P[2].in)/stdev(P[0].in)).toFixed(3);
  out.outlineRetain=+(stdev(P[1].in)/stdev(P[0].in)).toFixed(3);
  out.whiteMin=Math.min.apply(null,P[4].in.map(p=>Math.min(p[0],p[1],p[2])));

  /* ---- T6：撳實 X / ` ---- */
  S.keyShow=2; paint(); await sleep(50);
  const fillIn=grab(IN);
  S.keyHide=true; paint(); await sleep(50);
  out.holdX_diff=diff(grab(IN),P[0].in);
  S.keyHide=false; S.hold=true; paint(); await sleep(50);
  out.holdTick_diff=diff(grab(IN),P[0].in);   /* 睇原圖時：會同 P0 唔同（因為 P0 係 graded）*/
  S.hold=false; paint(); await sleep(50);

  /* ---- T7a：grade 真係落咗（graded vs 原圖要唔同），否則 T7 無意義 ---- */
  S.hold=true; paint(); await sleep(60); const origIn=grab(IN); S.hold=false; paint(); await sleep(60);
  out.gradeDiffFromOrig=diff(grab(IN),origIn);
  out.protectOn_diffFromOrig=diff(grab(IN),origIn);      /* matte 開 + skinProt100 → 應接近原圖 */

  /* ---- T7：bypass ---- */
  S.keyBy=false; S.pvKey++; S.pvCache.clear(); scheduleRender(true); await sleep(500);
  await sleep(400); const on=grab(IN);
  S.keyBy=true;  S.pvKey++; S.pvCache.clear(); scheduleRender(true); await sleep(500);
  await sleep(400); const off=grab(IN);
  out.bypassDiff=diff(on,off);
  out.bypassOff_diffFromOrig=diff(off,origIn);           /* bypass 後應該跟返 grade */
  S.keyBy=false; S.pvKey++; S.pvCache.clear(); scheduleRender(true); await sleep(400); await sleep(300);

  /* ---- T9：顯示層改動唔好 invalidate grade ---- */
  const pv0=S.pvKey; S.keyShow=1; syncKeyUI(); paint(); S.keyOvA=0.8; paint(); S.keyOvC=1; paint();
  out.displayNoInvalidate = (S.pvKey===pv0);

  /* ---- T8：工具欄 DOM ---- */
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const grp=q('.keygrp');
  const toolRow=grp.children[1];
  out.ui={
    labels: qa('.keygrp .klab').map(e=>e.textContent),
    hasKeygrp: !!grp,
    tools: qa('.keygrp button.b.tool').map(e=>({t:e.querySelector('span').textContent,
       icon:!!e.querySelector('svg'), h:e.getBoundingClientRect().height, on:e.classList.contains('on'), title:(e.title||'').slice(0,20)})),
    addSegCells: qa('#keyaddseg button').map(e=>e.textContent),
    addSegOn: qa('#keyaddseg button').filter(e=>e.classList.contains('on')).map(e=>e.textContent),
    viewSeg: qa('#keyviewseg button').map(e=>e.textContent),
    viewSegOn: qa('#keyviewseg button').filter(e=>e.classList.contains('on')).map(e=>e.textContent),
    moreClosedHeight: (()=>{ const m=q('#keymore'); return getComputedStyle(m).display; })(),
    moreBtns: qa('#keymore button').map(e=>e.textContent),
    swatches: qa('#keyovsw i').length,
    swatchOn: qa('#keyovsw i').filter(e=>e.classList.contains('on')).map(e=>e.title),
    exportBtns: qa('#bkeyexp,#bkeyimp').map(e=>e.textContent),
    hasByBtn: !!q('#bkeyby'), hasBlinkBtn: !!q('#bkeyblink'),
    hintHasX: /撳實/.test(q('.keygrp')? q('.keygrp').parentNode.textContent : '')
  };
  /* 更多收摺：撳開 */
  q('#keymore').classList.add('open');
  out.ui.moreOpenHeight = getComputedStyle(q('#keymore')).display;
  /* 三選一：撳魔術棒 */
  q('#bkey_wand').click(); await sleep(120);
  out.ui.afterWandClick = qa('.keygrp button.b.tool').map(e=>e.classList.contains('on')?e.querySelector('span').textContent:null).filter(Boolean);
  q('#bkey_wand').click(); await sleep(120);
  out.ui.afterWandClickAgain = qa('.keygrp button.b.tool').map(e=>e.classList.contains('on')?e.querySelector('span').textContent:null).filter(Boolean);
  /* 清除要撳兩次 */
  const covBefore=+(keyCoverage()*100).toFixed(2);
  qa('#keymore button').find(e=>e.textContent==='清除').click(); await sleep(150);
  const cov1=+(keyCoverage()*100).toFixed(2);
  qa('#keymore button').find(e=>e.textContent==='清除').click(); await sleep(250);
  const cov2=+(keyCoverage()*100).toFixed(2);
  out.ui.clearArmed={before:covBefore, after1:cov1, after2:cov2};
  return out;
});

console.log(JSON.stringify(R,null,1));
console.log('PAGEERROR:',E.length?E.slice(0,4).join(' | '):'none');
})().catch(e=>{ console.log('FATAL',e.message); })
 .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} process.exit(0); });
