/* v26：key 保啲乜 —— 「連二次調色都保」。
   T21 預設（關）：二次調色完全穿過保護 → bypassDiff 必須 ≈ 0（= v25.2 行為）
   T22 開咗：二次調色要被保住 → bypassDiff 必須大
   T23 開咗都淨影響皮膚：遮罩**外面**唔可以變
   T24 預設關時新 code 完全唔跑：false→true→false 之後全圖 checksum 必須一樣
   T25 成本：開咗 render 時間唔可以爆 */
const { chromium } = require('playwright');
const fs=require('fs');
const D='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/';
let b=null;
(async()=>{
b=await chromium.connectOverCDP('http://127.0.0.1:9444');
const pg=await (b.contexts()[0]).newPage();
pg.setViewportSize({width:1600,height:1000});
const E=[]; pg.on('pageerror',e=>E.push(e.message));
await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
await pg.waitForTimeout(900);
const u='data:image/jpeg;base64,'+fs.readFileSync(D+'ab_skill_test/ref_shot04.jpg').toString('base64');

const R=await pg.evaluate(async(url)=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const S=window.ldKey.S;
  const cv=document.querySelector('#cv'), g=cv.getContext('2d');
  const im=await new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=url; });
  addShot(im,'real'); await sleep(800);
  const sk=document.querySelector('#skin'); if(sk) sk.checked=true;
  S.skinProt=100; S.chromaStr=100;
  autoSkinMatte(); await sleep(700); await sleep(400);

  const K=S.keyMatte, m=window.ldKey.blurredMatte();
  const IN=[],OUT=[];
  for(let y=2;y<K.h-2;y+=5) for(let x=2;x<K.w-2;x+=5){
    if(m[y*K.w+x]>0.95) IN.push([(x+0.5)/K.w,(y+0.5)/K.h]);
    else if(m[y*K.w+x]<0.02 && IN.length>60 && OUT.length<60) OUT.push([(x+0.5)/K.w,(y+0.5)/K.h]);
  }
  const px=p=>{ const X=Math.max(0,Math.min(cv.width-1,Math.round(p[0]*cv.width)));
    const Y=Math.max(0,Math.min(cv.height-1,Math.round(p[1]*cv.height)));
    const d=g.getImageData(X,Y,1,1).data; return [d[0],d[1],d[2]]; };
  const grab=pts=>pts.map(px);
  const diff=(A,B)=>{ let s=0; for(let i=0;i<A.length;i++)
      s+=Math.abs(A[i][0]-B[i][0])+Math.abs(A[i][1]-B[i][1])+Math.abs(A[i][2]-B[i][2]);
    return +(s/(A.length*3)).toFixed(3); };
  const redraw=async()=>{ S.pvKey++; S.pvCache.clear(); scheduleRender(true); await sleep(450); await sleep(350); };
  const out={nIn:IN.length,nOut:OUT.length,coverage:+(keyCoverage()*100).toFixed(2)};

  /* 二次調色 trim（sat + temp）—— 呢啲正正係舊版穿過保護嘅嘢 */
  S.sec.sat=-80; S.sec.temp=60; await redraw();

  S.hold=true; paint(); await sleep(80); const orig=grab(IN); S.hold=false; paint(); await sleep(80);

  /* T21 預設關 */
  S.skinProtSec=false;
  S.keyBy=false; await redraw(); const on1=grab(IN), out1=grab(OUT);
  S.keyBy=true;  await redraw(); const off1=grab(IN);
  S.keyBy=false; await redraw();
  out.T21_bypassDiff=diff(on1,off1);
  out.T21_skinFromOrig=diff(on1,orig);

  /* T22 / T23 開咗 */
  S.skinProtSec=true;
  S.keyBy=false; await redraw(); const on2=grab(IN), out2=grab(OUT);
  S.keyBy=true;  await redraw(); const off2=grab(IN);
  S.keyBy=false; await redraw();
  out.T22_bypassDiff=diff(on2,off2);
  out.T22_skinFromOrig=diff(on2,orig);
  out.T23_outsideDiff=diff(out1,out2);      /* 遮罩外面唔可以變 */

  /* T24 預設關時新 code 唔跑：false→true→false 全圖 checksum 要一樣 */
  S.skinProtSec=false; await redraw();
  const sum=()=>{ const d=g.getImageData(0,0,cv.width,cv.height).data;
    let h=0; for(let i=0;i<d.length;i+=997) h=(h*31+d[i])|0; return h; };
  const h1=sum();
  S.skinProtSec=true; await redraw(); S.skinProtSec=false; await redraw();
  const h2=sum();
  out.T24_checksumSame=(h1===h2);

  /* T25 成本 */
  const t0=S.timing.total, n0=S.timing.n;
  S.skinProtSec=true; await redraw(); const tOn=+S.timing.total.toFixed(2), nOn=S.timing.n;
  S.skinProtSec=false; await redraw(); const tOff=+S.timing.total.toFixed(2), nOff=S.timing.n;
  out.T25={px:nOn, ms_protSecOn:tOn, ms_protSecOff:tOff};
  /* T26 機制牙齒：全選 → kg=1 全圖 → 二次調色應該完全被 bypass，差值要大 */
  S.sec.sat=-100; S.sec.temp=100;
  keyFillAll(); await sleep(600); await sleep(400);
  S.skinProtSec=false; await redraw(); const fOff=grab(IN);
  S.skinProtSec=true;  await redraw(); const fOn=grab(IN);
  out.T26_fullMatte_protOff_vs_on=diff(fOff,fOn);
  S.skinProtSec=false;
  S.sec.sat=0; S.sec.temp=0; await redraw();
  return out;
}, u);
console.log(JSON.stringify(R,null,1));
console.log('PAGEERROR:',E.length?E.slice(0,4).join(' | '):'none');
})().catch(e=>console.log('FATAL',e.message))
 .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} process.exit(0); });
