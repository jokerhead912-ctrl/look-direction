/* v27.1 回歸：完整保護 **只認 key**，唔可以喺冇畫 matte 嘅圖度改 pixel。
   背景：v27 將 skinProtSec 預設開之後，golden / golden_real 即刻 FAIL ——
   `g = max(matte, fleshGate)` 只要有膚保 slider 就 >0.002，令兩段還原全圖生效。
   v27.1 改用 kgKey = kf[i]*kp 並 gate 喺 kf。

   T36 冇 key：完整保護 開 vs 關，全圖 diff 必須 = 0
   T37 有 key：完整保護 開 vs 關，全圖 diff 必須 > 0（唔好改到冇咗功能）
   T38 牙齒：用源碼還原 v27 舊邏輯（kg / 無 kf gate），T36 必須 FAIL（diff > 0）
   T39 兩個頁面都冇 pageerror
   鐵律：finally 一定要 close browser + 刪臨時 HTML，否則 node 會永遠掛起。 */
const { chromium } = require('playwright');
const fs = require('fs');
const D = 'C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/';
const DIR = D + 'look-direction/';
const TEETH = DIR + '_teeth_v271.html';
let b = null;

/* 由目前 index.html 還原 v27 舊邏輯，做「牙齒」對照頁 */
function makeTeeth(){
  let s = fs.readFileSync(DIR+'index.html','utf8');
  const before = s;
  s = s.replace(/if\(S\.skinProtSec && kf && kgKey>0\.002\)\{/g,
                'if(S.skinProtSec && kg>0.002){')
       .replace(/const tL=1-kgKey;/g,'const tL=1-kg;')
       .replace(/const t=1-kgKey;/g,'const t=1-kg;');
  if(s===before) throw new Error('teeth patch 冇命中，v27.1 源碼改咗？要更新 _v271.js');
  fs.writeFileSync(TEETH, s, 'utf8');
}

/* 喺一個 page 度量：冇 key / 有 key 兩組「開 vs 關」全圖 diff */
async function probe(pg, url, img){
  const E=[];
  pg.on('pageerror', e=>E.push(e.message));
  await pg.goto('file:///'+url, {waitUntil:'load'});
  await pg.waitForTimeout(800);
  return await pg.evaluate(async(src)=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const S=window.ldKey.S;
    const cv=document.querySelector('#cv'), g=cv.getContext('2d');
    const im=await new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=src; });
    addShot(im,'probe'); await sleep(800);

    const nr=document.querySelector('#chrnr'); if(nr) nr.checked=false; S.chrNR=false;
    const sk=document.querySelector('#skin');  if(sk) sk.checked=true;
    S.skinProt=100; S.chromaStr=100; S.toneStr=100;
    setActive(3); await sleep(250);
    /* 一個強 grade，令完整保護「有嘢可保」 */
    S.sec.sat=-80; S.sec.temp=60; S.sec.high=35; S.sec.white=-25;

    const redraw=async()=>{ S.pvKey++; S.pvCache.clear(); scheduleRender(true);
                            await sleep(450); await sleep(350); };
    const snap=()=>new Uint8ClampedArray(g.getImageData(0,0,cv.width,cv.height).data);
    const diff=(A,B)=>{ let s=0,n=0;
      for(let i=0;i<A.length;i+=16){ s+=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]); n+=3; }
      return +(s/n).toFixed(4); };
    const pair=async()=>{ S.skinProtSec=false; await redraw(); const off=snap();
                          S.skinProtSec=true;  await redraw(); const on=snap();
                          return diff(off,on); };

    const out={};
    out.ver=(typeof APP_VER!=='undefined')?APP_VER:'?';
    out.hasKeyAtStart=(typeof hasKey==='function')?hasKey():null;
    out.T36_noKey_diff=await pair();

    autoSkinMatte(); await sleep(700); await sleep(350);
    out.hasKeyAfterAuto=(typeof hasKey==='function')?hasKey():null;
    out.T37_withKey_diff=await pair();
    S.skinProtSec=true;
    return out;
  }, img).then(r=>({...r, pageerror:E.slice(0,3)}));
}

(async()=>{
  makeTeeth();
  const img='data:image/jpeg;base64,'+fs.readFileSync(D+'ab_skill_test/ref_shot04.jpg').toString('base64');
  b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const ctx=b.contexts()[0];
  const p1=await ctx.newPage(), p2=await ctx.newPage();
  p1.setViewportSize({width:1600,height:1000});
  p2.setViewportSize({width:1600,height:1000});
  const cur=await probe(p1, DIR+'index.html', img);
  const old=await probe(p2, TEETH, img);
  const R={
    current:cur, teeth_v27:old,
    PASS_T36_noKeyUnchanged: cur.T36_noKey_diff===0,
    PASS_T37_withKeyStillWorks: cur.T37_withKey_diff>0.05,
    PASS_T38_TEETH: old.T36_noKey_diff>0.05,
    PASS_T39_noPageError: cur.pageerror.length===0 && old.pageerror.length===0
  };
  console.log(JSON.stringify(R,null,1));
})().catch(e=>console.log('FATAL', e.message))
 .finally(async()=>{
   try{ if(b) await b.close(); }catch(_){}
   try{ fs.unlinkSync(TEETH); }catch(_){}
   process.exit(0);
 });
