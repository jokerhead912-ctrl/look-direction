/* v25.2：移除 key —— 搵得到、清得晒、唔會復活
   T15 有 key 嗰陣「移除」掣要出現；冇 key 要收埋
   T16 「移除」要撳兩次先生效（防誤撳）
   T17 移除之後可以「復原」攞返
   T18 移除後切走再切返，舊 matte **唔可以**復活（舊版 bug）
   T19 「套全部」→「移除全部 shot」：全部 shot 嘅 st.key 要變 null
   T20 「移除全部 shot」一樣要撳兩次 */
const { chromium } = require('playwright');
const fs=require('fs');
const D='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/';
const F=['ab_skill_test/ref_shot04.jpg','ab_skill_test/ref_shot05.jpg','ab_skill_test/ref_shot06.jpg'];
let b=null;
(async()=>{
b=await chromium.connectOverCDP('http://127.0.0.1:9444');
const pg=await (b.contexts()[0]).newPage();
pg.setViewportSize({width:1600,height:1000});
const E=[]; pg.on('pageerror',e=>E.push(e.message));
await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
await pg.waitForTimeout(900);
const urls=F.map(f=>'data:image/jpeg;base64,'+fs.readFileSync(D+f).toString('base64'));

const R=await pg.evaluate(async(urls)=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const S=window.ldKey.S; const out={};
  const cov=()=>+(keyCoverage()*100).toFixed(2);
  const btn=t=>[...document.querySelectorAll('#keymore button')].find(e=>e.textContent===t);

  for(const u of urls){
    const im=await new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=u; });
    if(!im) continue;
    addShot(im,'r'+S.shots.length); await sleep(700);
  }
  switchShot(0); await sleep(700);
  autoSkinMatte(); await sleep(700); await sleep(400);
  out.shots=S.shots.length;
  out.c0=cov();
  const del=document.querySelector('#bkeydel');
  out.T15_delExists=!!del;
  out.T15_delVisible_whenKey=del? !del.hidden : null;

  /* T16：撳一次唔生效，撳第二次先清 */
  del.click(); await sleep(200); out.T16_after1=cov();
  del.click(); await sleep(400); out.T16_after2=cov();
  del.click(); await sleep(200);   /* 第三下：已清，應該彈「未畫」 */
  out.T16_hidden_whenNoKey=document.querySelector('#bkeydel').hidden;

  /* T17：復原攞返 */
  btn('復原').click(); await sleep(500);
  out.T17_undo=cov();
  out.T17_visibleAgain=!document.querySelector('#bkeydel').hidden;

  /* T18：移除後切走再切返唔可以復活。
     要先「切走再切返」一次，等 shot0.st.key 真係存低咗舊 matte —— 否則呢個測試冇牙。 */
  switchShot(1); await sleep(700); switchShot(0); await sleep(800);
  out.T18a_beforeClear=cov();
  out.T18b_stKeySaved=(S.shots[0].st&&S.shots[0].st.key)?1:0;   /* 必須係 1，證明真係存咗 */
  const d2=document.querySelector('#bkeydel');
  d2.click(); await sleep(150); d2.click(); await sleep(400);
  out.T18c_cleared=cov();
  out.T18d_stKeyRightAfterClear=(S.shots[0].st&&S.shots[0].st.key)?1:0;  /* 新 code 要係 0 */
  switchShot(1); await sleep(700); switchShot(0); await sleep(800);
  out.T18e_backOnShot0=cov();      /* 必須仲係 0 */

  /* T19 / T20：套全部 → 移除全部 shot */
  autoSkinMatte(); await sleep(700); await sleep(400);
  out.T19a_cov=cov();
  btn('套全部').click(); await sleep(400);
  out.T19b_storedKeys=S.shots.map(s=>s.st&&s.st.key?1:0);
  const ca=btn('移除全部 shot');
  out.T20_btnExists=!!ca;
  ca.click(); await sleep(200);
  out.T20_after1=S.shots.map(s=>s.st&&s.st.key?1:0);   /* 撳一次唔可以清 */
  ca.click(); await sleep(500);
  out.T20_after2=S.shots.map(s=>s.st&&s.st.key?1:0);   /* 第二次要清晒 */
  out.T19c_covAfterClearAll=cov();

  /* 牙齒檢查：還原 v25.1 嘅 keyClear（唔 saveShotState），T18 必須 FAIL */
  switchShot(0); await sleep(800);
  autoSkinMatte(); await sleep(700); await sleep(400);
  switchShot(1); await sleep(700); switchShot(0); await sleep(800);
  const oldClear=keyClear;
  window.keyClear=function(){
    const K=S.keyMatte; if(!K||!hasKey()){ toast('未畫 key'); return; }
    pushKeyUndo(); K.m.fill(0); touchKey(); updKeyLabel(); syncKeyUI();
  };
  const d3=document.querySelector('#bkeydel');
  const covBefore=cov();
  d3.click(); await sleep(150); d3.click(); await sleep(400);
  out.TEETH_covBefore=covBefore;
  out.TEETH_cleared=cov();
  out.TEETH_stKeyAfterClear=(S.shots[0].st&&S.shots[0].st.key)?1:0;
  switchShot(1); await sleep(700); switchShot(0); await sleep(800);
  out.TEETH_backOnShot0=cov();        /* 舊 code：呢度會復活 */
  window.keyClear=oldClear;
  return out;
}, urls);
console.log(JSON.stringify(R,null,1));
console.log('PAGEERROR:',E.length?E.slice(0,4).join(' | '):'none');
})().catch(e=>console.log('FATAL',e.message))
 .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} process.exit(0); });
