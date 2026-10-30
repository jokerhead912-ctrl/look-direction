/* 逐段歸因：逐樣開關，睇每階段實際食幾多 ms（1400px，831k px） */
const { chromium } = require('playwright');
const IMG='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/v4_A_none.png';
(async()=>{
  const b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(800);
  const [ch]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#b-addshot')]);
  await ch.setFiles([IMG]);
  await pg.waitForTimeout(2200);
  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const P=window.ldPerf, S=window.ldKey.S;
    const med=async(n,q)=>{ const a=[]; for(let i=0;i<n;i++){ S.pvKey++; S.pvCache.clear(); P.render(q); await sleep(25); a.push(P.timing().total);} 
      a.sort((x,y)=>x-y); return +a[Math.floor(a.length/2)].toFixed(1); };
    const out={};
    const palBtn=document.querySelector('#palseg button[data-m="1"]');
    out['1_baseline']=await med(5,false);
    if(palBtn) palBtn.click(); await sleep(700);
    out['2_plus_palette']=await med(5,false);
    /* CDL：落組 slope */
    document.querySelector('#tonemode button[data-v="num"]').click(); await sleep(300);
    const set=(k,v)=>{const el=document.querySelector('input[data-cdl="'+k+'"]'); if(el){el.value=String(v); el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}};
    set('s0',1.12); set('s1',1.0); set('s2',0.92); await sleep(800);
    out['3_plus_cdl']=await med(5,false);
    /* 色度降噪開住 + 全選 matte（最壞情況） */
    window.ldKey.keyFillAll(); await sleep(900);
    out['4_plus_matte_full']=await med(5,false);
    out['5_quick']=await med(5,true);
    out.n=P.timing().n; out.w=P.timing().w;
    return out;
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
