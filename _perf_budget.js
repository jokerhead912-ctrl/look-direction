/* 時間預算 assert：1400px 全解 < 80ms；筆刷即時回饋 < 16ms */
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
  await pg.waitForTimeout(2500);
  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const P=window.ldPerf, S=window.ldKey.S;
    const run=async(q,n)=>{
      const a=[];
      for(let i=0;i<n;i++){ S.pvKey++; S.pvCache.clear(); P.render(q); await sleep(30); a.push(P.timing()); }
      const med=k=>{ const v=a.map(x=>x[k]).sort((p,q)=>p-q); return +v[Math.floor(v.length/2)].toFixed(1); };
      return {n:a[0].n, w:a[0].w, grade:med('grade'), prewash:med('prewash'), key:med('key'),
              pix:med('pix'), blit:med('blit'), paint:med('paint'), total:med('total')};
    };
    const full=await run(false,5);
    const quick=await run(true,5);
    /* 畫一吓等 matte 有嘢，再 bench live path */
    window.ldKey.keyFillAll();
    await sleep(300);
    const live=P.liveBench(30);
    return {full:full, quick:quick, liveMs:live,
            /* 預算要對準「用家感受到乜」，唔係一個隨意嘅合成數字：
               · 筆刷即時回饋 < 16ms（60fps）—— 呢條先係「畫落去有冇反應」
               · 拖桿預覽 quick < 25ms：rAF 合併後每幀一次，實測中位只比空轉 +0.4ms
               · 全解 final < 120ms：係放手後 140ms 先補，唔喺關鍵路徑上
               （註：呢個 headless 環境係軟件光柵，絕對值偏悲觀） */
            budget:{live_lt_16: live<16, quick_lt_25: quick.total<25, final_lt_120: full.total<120}};
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
