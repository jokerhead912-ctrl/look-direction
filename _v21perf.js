const { chromium } = require('playwright');
const SHOT='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/_shot17_small.png';
const HASH=`(()=>{const c=document.getElementById('cv');
  const t=document.createElement('canvas'); t.width=120; t.height=Math.max(1,Math.round(120*c.height/c.width));
  const x=t.getContext('2d'); x.drawImage(c,0,0,t.width,t.height);
  const d=x.getImageData(0,0,t.width,t.height).data;
  let s=0; for(let i=0;i<d.length;i+=16) s=(s*31+d[i])>>>0; return s;})()`;
(async()=>{
  const b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.stack||e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(800);
  const [ch]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#b-addshot')]);
  await ch.setFiles([SHOT]);
  await pg.waitForTimeout(2000);

  /* render 時間（同一設定重複 render，第二次應該 hit 到 prewash cache） */
  const T=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const one=async()=>{ const t0=performance.now();
      window.ldKey.S.pvKey++; window.ldKey.S.pvCache.clear();
      document.getElementById('skin').dispatchEvent(new Event('change',{bubbles:true}));
      await sleep(400); return +(performance.now()-t0).toFixed(0); };
    const a=[]; for(let i=0;i<4;i++) a.push(await one());
    return a;
  });
  console.log('RENDER_MS(4x)', JSON.stringify(T));
  console.log('CSTAT', await pg.textContent('#cstat'));

  /* 筆刷：畫緊（未放手）畫面要即刻有變 */
  const box=await pg.locator('#cv').boundingBox();
  await pg.evaluate(()=>{ document.getElementById('bkeybrush').click();
    const h=document.querySelector('.mr[data-k="brushR"] input'); h.value=110; h.dispatchEvent(new Event('input',{bubbles:true})); });
  await pg.waitForTimeout(300);
  const h0=await pg.evaluate(HASH);
  const cx=box.x+box.width*0.66, cy=box.y+box.height*0.42;
  await pg.mouse.move(cx,cy); await pg.mouse.down();
  const steps=[];
  for(let i=1;i<=10;i++){
    await pg.mouse.move(cx+i*7, cy+i*3);
    await pg.waitForTimeout(60);
    steps.push(await pg.evaluate(HASH));
  }
  const midChanged=steps.filter(s=>s!==h0).length;
  const beforeUp=await pg.evaluate(HASH);
  await pg.mouse.up();
  await pg.waitForTimeout(900);
  const afterUp=await pg.evaluate(HASH);
  console.log('LIVE steps changed:',midChanged,'/10   beforeUp!=h0:',beforeUp!==h0,'  afterUp!=h0:',afterUp!==h0);
  console.log('COVER', await pg.evaluate(()=>document.getElementById('keylb').textContent));

  /* 遮罩可見性：筆刷模式應該強制疊遮罩 */
  console.log('SHOW_MODE', await pg.evaluate(()=>window.ldKey.S.keyMode+' show='+window.ldKey.S.keyShow));
  /* Esc 退出 */
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(400);
  console.log('AFTER_ESC', await pg.evaluate(()=>window.ldKey.S.keyMode));
  console.log('ERR', E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
