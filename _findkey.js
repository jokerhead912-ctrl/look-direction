const { chromium } = require('playwright');
let b=null;
(async()=>{
  b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(900);
  const R=await pg.evaluate(()=>{
    const gs=[...document.querySelectorAll('#grpbox .grp')].map(g=>({
      id:g.dataset.g,
      title:g.querySelector('.nm').textContent.trim(),
      open:g.classList.contains('open'),
      hasKeyBtn: !!g.querySelector('#bkeybrush'),
      btns:[...g.querySelectorAll('button.b.sm')].map(x=>x.textContent).filter(Boolean).slice(0,14)
    }));
    return {groups:gs, ver:(typeof APP_VER!=='undefined')?APP_VER:'?'};
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
})().catch(e=>console.log('FATAL',e.message))
  .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} process.exit(0); });
