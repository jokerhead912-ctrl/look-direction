/* 拉條審計（單次 evaluate，快）：逐條由 12% 拉到 88%，比較 canvas 像素 */
const { chromium } = require('playwright');
const SHOT='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/_shot17_small.png';
(async()=>{
  const b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1700,height:1050});
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(800);
  const [ch]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#b-addshot')]);
  await ch.setFiles([SHOT]);
  await pg.waitForTimeout(2000);
  await pg.evaluate(()=>{const b=document.querySelector('#palseg button[data-m="1"]'); if(b) b.click();});
  await pg.waitForTimeout(1200);
  await pg.evaluate(()=>{const b=document.querySelector('#tonemode button[data-v="spl"]'); if(b) b.click();});
  await pg.waitForTimeout(400);
  /* 全部 group 打開，否則 collapsed 嘅拉桿量唔到 */
  await pg.evaluate(()=>{document.querySelectorAll('.grp').forEach(g=>{ if(!g.classList.contains('open')) g.querySelector('.grp-hd').click(); });});
  await pg.waitForTimeout(500);

  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const snap=()=>{ const c=document.getElementById('cv'); if(!c||!c.width) return null;
      const t=document.createElement('canvas'); t.width=200; t.height=Math.max(1,Math.round(200*c.height/c.width));
      const x=t.getContext('2d'); x.drawImage(c,0,0,t.width,t.height);
      const d=x.getImageData(0,0,t.width,t.height).data;
      let L=0,C=0,h='';
      for(let i=0;i<d.length;i+=4){ L+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; C+=Math.abs(d[i]-d[i+2]); }
      for(let i=0;i<d.length;i+=64){ h+=((d[i]*7+d[i+1]*3+d[i+2])%251)+','; }
      const n=d.length/4; return {L:+(L/n).toFixed(2),C:+(C/n).toFixed(2),h:h}; };
    const drag=async(k,f)=>{
      const el=document.querySelector('.sl[data-k="'+k+'"]'); if(!el) return false;
      const tr=el.querySelector('.sl-tr'); if(!tr) return false;
      const r=tr.getBoundingClientRect(); if(!r.width) return false;
      const cx=r.left+r.width*f, cy=r.top+r.height/2;
      const mk=(type)=>new PointerEvent(type,{clientX:cx,clientY:cy,bubbles:true,pointerId:1,isPrimary:true,button:0});
      tr.dispatchEvent(mk('pointerdown')); tr.dispatchEvent(mk('pointermove')); tr.dispatchEvent(mk('pointerup'));
      await sleep(190); return true;
    };
    /* 每條量完都要歸零：否則前一條嘅值會疊落去（例如曝光 +76 之後再推陰影，
       成張圖已經爆光，陰影遮罩變咗全圖 → 讀到 +142 呢啲假數據）。 */
    const reset=async(k)=>{
      const el=document.querySelector('.sl[data-k="'+k+'"]'); if(!el) return;
      const tr=el.querySelector('.sl-tr'); if(!tr) return;
      tr.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
      await sleep(170);
    };
    const out=[];
    const els=[...document.querySelectorAll('.sl[data-k]')];
    for(const el of els){
      const k=el.dataset.k;
      const label=(el.querySelector('.sl-nm')||{}).textContent||'';
      const grp=(el.closest('.grp')||{});
      const g=grp&&grp.dataset?grp.dataset.g:'';
      await reset(k);
      const okA=await drag(k,0.12); if(!okA){ out.push({k,label,grp:g,dead:'no-track'}); continue; }
      const a=snap();
      await reset(k);
      const okB=await drag(k,0.88); if(!okB){ out.push({k,label,grp:g,dead:'no-track'}); continue; }
      const c=snap();
      await reset(k);
      const vl=el.querySelector('.sl-vl');
      out.push({k,label,grp:g,val:vl?vl.value:null,
        dL:a&&c?+(c.L-a.L).toFixed(2):null, dC:a&&c?+(c.C-a.C).toFixed(2):null,
        same:(a&&c)?(a.h===c.h):null});
    }
    return {palOn:window.ldKey.S.sec.palOn, rows:out};
  });
  console.log(JSON.stringify(R,null,0));
  console.log('ERR',E.slice(0,4).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
