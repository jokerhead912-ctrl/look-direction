/* 最小復現：逐步標記，搵出「Assignment to constant variable」到底喺邊一句。
   鐵律：finally 一定要 close browser —— 否則 evaluate 一拋錯，node 就永遠掛起。 */
const { chromium } = require('playwright');
const IMG='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/v4_A_none.png';
let b=null;
(async()=>{
  b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(700);
  const [ch]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#b-addshot')]);
  await ch.setFiles([IMG]); await pg.waitForTimeout(2200);

  const steps=[];
  const step=async(name,fn)=>{
    try{ const r=await pg.evaluate(fn); steps.push([name,'OK',r]); return r; }
    catch(e){ steps.push([name,'THROW',e.message.split('\n')[0]]); throw e; }
  };
  try{
    await step('01 skinWin()', ()=>skinWin());
    await step('02 gridLab',   ()=>{const g=window.ldKey.gridLab(window.ldKey.S.vendorLabQuick); return [g.w,g.h];});
    await step('03 fresh',     ()=>{window.ldKey.S.keyMatte=null; window.ldKey.ensureMatte(); return 'ok';});
    await step('04 auto',      ()=>{const ok=window.ldKey.autoSkinMatte(); return [ok, +(window.ldKey.keyCoverage()*100).toFixed(2)];});
    await step('05 override skinWin', ()=>{window.skinWin=()=>({lo:30,hi:80,wlo:10,whi:12}); return 'set';});
    await step('06 auto(hardcoded)',  ()=>{window.ldKey.S.keyMatte=null; window.ldKey.ensureMatte();
                                          const ok=window.ldKey.autoSkinMatte();
                                          return [ok, +(window.ldKey.keyCoverage()*100).toFixed(2)];});
    await step('07 restore skinWin',  ()=>{ location.reload; return 'skip'; });
    await step('08 keyApplyAll',      ()=>{ try{ keyApplyAll(); return 'ok'; }catch(e){ return 'THROW '+e.message; } });
    await step('09 shotState has key',()=>{const st=window.ldKey.S.shots[0].st; return st? Object.keys(st):null;});
  }catch(e){ steps.push(['ABORT','',e.message.split('\n')[0]]); }
  console.log(JSON.stringify({steps:steps, pageerr:E.slice(0,3)},null,1));
})().catch(e=>console.log('FATAL',e.message))
  .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} console.log('CLOSED'); process.exit(0); });
