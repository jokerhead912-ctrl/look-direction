/* v25.1 回歸：**「關」就係關**。
   導演實測 bug：顯示揀咗「關」，但筆刷仲揀緊 → 三處 force 照畫層紅。
   T10 筆刷模式 + 關：遮罩必須完全唔畫（diff = 0）
   T11 填充確實有畫（唔好因為改 force 而冇咗回饋）
   T12 入工具：顯示=關 → 自動轉填充；離開 → 還原返關
   T13 入工具：顯示=描邊 → 唔好郁；離開 → 唔好郁（唔好覆寫手動選擇）
   T14 即時筆觸（keyPaintLive）+ 關：都唔可以畫 */
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
  const im=await new Promise(res=>{ const i=new Image(); i.onload=()=>res(i); i.src=url; });
  addShot(im,'real'); await sleep(800);
  autoSkinMatte(); await sleep(700); await sleep(400);
  const K=S.keyMatte, m=window.ldKey.blurredMatte();
  const pts=[];
  for(let y=2;y<K.h-2&&pts.length<300;y+=5) for(let x=2;x<K.w-2&&pts.length<300;x+=5)
    if(m[y*K.w+x]>0.95) pts.push([(x+0.5)/K.w,(y+0.5)/K.h]);
  const px=p=>{ const X=Math.max(0,Math.min(cv.width-1,Math.round(p[0]*cv.width)));
    const Y=Math.max(0,Math.min(cv.height-1,Math.round(p[1]*cv.height)));
    const d=g.getImageData(X,Y,1,1).data; return [d[0],d[1],d[2]]; };
  const grab=()=>pts.map(px);
  const diff=(A,B)=>{ let s=0; for(let i=0;i<A.length;i++)
      s+=Math.abs(A[i][0]-B[i][0])+Math.abs(A[i][1]-B[i][1])+Math.abs(A[i][2]-B[i][2]);
    return +(s/(A.length*3)).toFixed(3); };
  const set=(mode,tool)=>{ S.keyShow=mode; S.keyMode=tool||null;
    syncKeyUI(); paint(); };
  const out={nPts:pts.length, coverage:+(keyCoverage()*100).toFixed(2)};

  /* 基線：關 + 冇工具 */
  set(0,null); await sleep(80); const base=grab();

  /* T10：筆刷模式 + 關 —— 導演嗰個 bug */
  set(0,'brush'); await sleep(80); const t10=grab();
  out.T10_brushOff_diff=diff(t10,base);

  /* T11：筆刷模式 + 填充 —— 必須有畫 */
  set(2,'brush'); await sleep(80); const t11=grab();
  out.T11_brushFill_diff=diff(t11,base);
  set(2,null); await sleep(80); const t11b=grab();
  out.T11b_fillNoTool_diff=diff(t11b,base);   /* 畫緊筆刷 alpha 應大過冇畫緊 */

  /* T12：入工具自動轉填充 / 離開還原 */
  S.keyShow=0; S.keyMode=null; S.keyShowPrev=null; syncKeyUI();
  setKeyMode('brush'); await sleep(80);
  out.T12_enter_show=S.keyShow; out.T12_enter_prev=S.keyShowPrev;
  setKeyMode(null); await sleep(80);
  out.T12_exit_show=S.keyShow;

  /* T13：顯示=描邊 入工具唔好郁 */
  S.keyShow=1; S.keyMode=null; S.keyShowPrev=null; syncKeyUI();
  setKeyMode('rect'); await sleep(80); out.T13_enter_show=S.keyShow;
  setKeyMode(null); await sleep(80);   out.T13_exit_show=S.keyShow;

  /* T14：即時筆觸 + 關 */
  S.keyShow=0; S.keyMode='brush'; syncKeyUI(); paint(); await sleep(60);
  const before=grab();
  keyBackup();              /* 起 _kbak（keyPaintLive 要用） */
  window.__t14=false;
  try{ keyPaintLive(); }catch(e){ window.__t14='throw:'+e.message; }
  await sleep(150);
  out.T14_liveOff_diff=diff(grab(),before);
  /* 牙齒檢查：還原 v25 舊邏輯，T10 必須 FAIL（diff > 0），否則呢個 gate 冇牙 */
  const old=keyOverlayDraw;
  window.keyOverlayDraw=function(){
    if(S.keyHide||S.hold) return;
    if(S.keyShow||S.keyMode==='brush') drawKeyOverlay(S.keyMode==='brush');
  };
  S.keyShow=0; S.keyMode='brush'; paint(); await sleep(80);
  out.TEETH_oldLogic_brushOff_diff=diff(grab(),base);
  window.keyOverlayDraw=old;
  S.keyMode=null; S.keyShow=1; syncKeyUI(); paint();
  return out;
}, u);
console.log(JSON.stringify(R,null,1));
console.log('PAGEERROR:',E.length?E.slice(0,4).join(' | '):'none');
})().catch(e=>console.log('FATAL',e.message))
 .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} process.exit(0); });
