/* 優化前後對照：同一張圖 + 同一個 grade，dump canvas 嘅 hash / 平均 RGB / 抽樣像素 */
const { chromium } = require('playwright');
const IMG='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/v4_A_none.png';
const fs=require('fs');
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
  /* 開色板 + 落一組 CDL（等條 pipeline 行晒 applyLook / polarClamp / CDL） */
  await pg.evaluate(()=>{const b=document.querySelector('#palseg button[data-m="1"]'); if(b) b.click();});
  await pg.waitForTimeout(800);
  await pg.evaluate(()=>{
    const btn=document.querySelector('#tonemode button[data-v="num"]'); if(btn) btn.click();
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{
    const set=(k,v)=>{const el=document.querySelector('input[data-cdl="'+k+'"]'); if(!el) return;
      el.value=String(v); el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));};
    set('s0',1.12); set('s1',1.0); set('s2',0.92); set('sat',0.85);
  });
  await pg.waitForTimeout(1200);
  /* 畫個 matte（等 polarClamp 都有行） */
  await pg.evaluate(()=>window.ldKey.keyFillAll());
  await pg.waitForTimeout(900);
  const R=await pg.evaluate(()=>{
    const c=document.getElementById('cv');
    const t=document.createElement('canvas'); t.width=c.width; t.height=c.height;
    t.getContext('2d').drawImage(c,0,0);
    const d=t.getContext('2d').getImageData(0,0,t.width,t.height).data;
    let h=0,sr=0,sg=0,sb=0;
    const samp=[];
    for(let i=0;i<d.length;i+=4){ sr+=d[i]; sg+=d[i+1]; sb+=d[i+2];
      h=((h*33)^(d[i]+d[i+1]*3+d[i+2]*7))>>>0; }
    for(let k=0;k<24;k++){ const i=Math.floor(k/24*d.length/4)*4; samp.push([d[i],d[i+1],d[i+2]]); }
    const n=d.length/4;
    return {w:t.width,h:t.height,hash:h,mean:[+(sr/n).toFixed(4),+(sg/n).toFixed(4),+(sb/n).toFixed(4)],samp:samp};
  });
  fs.writeFileSync(process.argv[2]||'_ref_before.json', JSON.stringify(R,null,1));
  console.log(JSON.stringify({w:R.w,h:R.h,hash:R.hash,mean:R.mean}));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
