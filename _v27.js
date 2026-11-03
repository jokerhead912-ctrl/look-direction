/* v27：兩個發現真改 —— 完整保護
   T27 全新載入：checkbox「完整保護」必須預設 tick
   T28 舊行為（關）：皮膚照跟 grade（skinFromOrig 大）
   T29 新預設（開）：皮膚明顯返向原圖，而且 **L 都要保**（lumaDiff 大跌）
   T30 保護要局部：遮罩外面照樣被 grade（唔可以全圖唔郁）
   T31 全選 kg=1 + 完整保護：皮膚 ≈ 原圖（證明「100%」真係 100%）
   T32 膚保滑桿 0：即使完整保護開咗都完全唔保（slider 仍然有效，有得較返）
   T33 對照組：同一 state render 兩次 diff = 0 */
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
  const out={};
  const cb=document.querySelector('#skinprotsec');
  out.T27_checkboxDefaultChecked = cb? cb.checked : null;
  out.T27_label = cb? cb.parentNode.textContent.trim() : null;
  out.ver=(typeof APP_VER!=='undefined')?APP_VER:'?';

  const im=await new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=url; });
  addShot(im,'real'); await sleep(800);
  const nr=document.querySelector('#chrnr'); if(nr) nr.checked=false; S.chrNR=false;
  const sk=document.querySelector('#skin'); if(sk) sk.checked=true;
  S.skinProt=100; S.chromaStr=100; S.toneStr=100;
  setActive(3); await sleep(300);
  autoSkinMatte(); await sleep(700); await sleep(400);

  const K=S.keyMatte, m=window.ldKey.blurredMatte();
  const IN=[], OUT=[];
  for(let y=2;y<K.h-2;y+=5) for(let x=2;x<K.w-2;x+=5){
    const p=[(x+0.5)/K.w,(y+0.5)/K.h];
    if(m[y*K.w+x]>0.95) IN.push(p);
    else if(m[y*K.w+x]<0.02 && OUT.length<120) OUT.push(p);
  }
  const px=p=>{ const X=Math.max(0,Math.min(cv.width-1,Math.round(p[0]*cv.width)));
    const Y=Math.max(0,Math.min(cv.height-1,Math.round(p[1]*cv.height)));
    const d=g.getImageData(X,Y,1,1).data; return [d[0],d[1],d[2]]; };
  const grab=pts=>pts.map(px);
  const diff=(A,B)=>{ let s=0; for(let i=0;i<A.length;i++)
      s+=Math.abs(A[i][0]-B[i][0])+Math.abs(A[i][1]-B[i][1])+Math.abs(A[i][2]-B[i][2]);
    return +(s/(A.length*3)).toFixed(3); };
  const luma=p=>0.299*p[0]+0.587*p[1]+0.114*p[2];
  const ldiff=(A,B)=>{ let s=0; for(let i=0;i<A.length;i++) s+=Math.abs(luma(A[i])-luma(B[i]));
    return +(s/A.length).toFixed(3); };
  const redraw=async()=>{ S.pvKey++; S.pvCache.clear(); scheduleRender(true); await sleep(450); await sleep(350); };

  /* 落一個強 grade：一次調色 tone + 二次調色 sat/temp/分區 */
  S.sec.sat=-80; S.sec.temp=60; S.sec.high=35; S.sec.white=-25;
  await redraw();
  S.hold=true; paint(); await sleep(80);
  const origIn=grab(IN), origOut=grab(OUT);
  S.hold=false; paint(); await sleep(80);

  /* T28 舊行為 */
  S.skinProtSec=false; await redraw();
  const aIn=grab(IN), aOut=grab(OUT);
  out.T28={skinFromOrig:diff(aIn,origIn), lumaDiff:ldiff(aIn,origIn),
           outsideFromOrig:diff(aOut,origOut)};

  /* T29 / T30 新預設 */
  S.skinProtSec=true; await redraw();
  const bIn=grab(IN), bOut=grab(OUT);
  out.T29={skinFromOrig:diff(bIn,origIn), lumaDiff:ldiff(bIn,origIn)};
  out.T30={outsideFromOrig:diff(bOut,origOut),
           outsideChangedVsLegacy:diff(bOut,aOut)};
  out.T29_ratio=+(out.T29.skinFromOrig/out.T28.skinFromOrig).toFixed(3);

  /* T33 對照組 */
  await redraw(); out.T33_controlDiff=diff(grab(IN),bIn);

  /* T31 全選 kg=1 → 應該 ≈ 原圖 */
  keyFillAll(); await sleep(600); await sleep(400);
  await redraw(); const cIn=grab(IN);
  out.T31_fullMatte_skinFromOrig=diff(cIn,origIn);

  /* T32 膚保=0 → 完全唔保 */
  S.skinProt=0; await redraw(); const dIn=grab(IN);
  out.T32_skinProt0_skinFromOrig=diff(dIn,origIn);
  S.skinProt=100; S.sec.sat=0; S.sec.temp=0; S.sec.high=0; S.sec.white=0;
  await redraw();

  /* T34 / T35：全選 kg=1 時，正確不變量唔係「= 原圖」
     （Lab↔RGB 往返本身有固定偏差），而係 **grade 對皮膚零影響**。 */
  const gradeOn=()=>{ S.sec.sat=-80; S.sec.temp=60; S.sec.high=35; S.sec.white=-25;
                      S.chromaStr=100; S.toneStr=100; setActive(3); };
  const gradeOff=()=>{ S.sec.sat=0; S.sec.temp=0; S.sec.high=0; S.sec.white=0;
                       S.chromaStr=0; S.toneStr=0; setActive(0); };
  /* 完整保護開 */
  S.skinProtSec=true; gradeOn(); await redraw(); const pOn=grab(IN);
  gradeOff(); await redraw(); const pOff=grab(IN);
  out.T34_fullProt_gradeEffectOnSkin=diff(pOn,pOff);
  /* 牙齒：完整保護關，grade 應該有大影響 */
  S.skinProtSec=false; gradeOn(); await redraw(); const lOn=grab(IN);
  gradeOff(); await redraw(); const lOff=grab(IN);
  out.T35_TEETH_legacyGradeEffect=diff(lOn,lOff);
  S.skinProtSec=true; gradeOff(); await redraw();
  return out;
}, u);
console.log(JSON.stringify(R,null,1));
console.log('PAGEERROR:',E.length?E.slice(0,4).join(' | '):'none');
})().catch(e=>console.log('FATAL',e.message))
 .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} process.exit(0); });
