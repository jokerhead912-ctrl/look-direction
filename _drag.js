/* 真實拖桿延遲：一幀一改、一幀一 render，量 rAF 幀間隔。
   呢個先係用家感受到嘅「慢唔慢」——唔係 pix 嗰個合成數字。 */
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

  const R=await pg.evaluate(()=>new Promise(res=>{
    const S=window.ldKey.S;
    const stat=ts=>{ const d=[]; for(let i=1;i<ts.length;i++) d.push(ts[i]-ts[i-1]);
      d.sort((a,b)=>a-b);
      return {medMs:+d[Math.floor(d.length/2)].toFixed(2), p95Ms:+d[Math.floor(d.length*0.95)].toFixed(2),
              maxMs:+d[d.length-1].toFixed(2), fps:+(1000/d[Math.floor(d.length/2)]).toFixed(1)}; };
    /* 控制組：淨係空轉 rAF，唔 render —— 量環境噪聲（CDP／GC／其他 tab） */
    const run=(withRender)=>new Promise(r=>{
      const ts=[]; let N=0;
      function loop(t){
        ts.push(t); N++;
        if(N<90){
          if(withRender){
            S.sec.con=((N%40)-20)*4; S.sec.shad=((N%26)-13)*6;
            S.pvKey++; S.pvCache.clear(); scheduleRender(true);
          }
          requestAnimationFrame(loop);
        }else{ S.sec.con=0; S.sec.shad=0; S.pvKey++; S.pvCache.clear(); r(stat(ts)); }
      }
      requestAnimationFrame(loop);
    });
    run(false).then(idle=>run(true).then(busy=>res({
      idle: idle, busy: busy,
      renderCostMs: +(busy.medMs-idle.medMs).toFixed(2),
      /* 我哋嘅 render 有幾多係「超出環境本身嘅幀時間」 */
      verdict: busy.medMs-idle.medMs < 8 ? 'PASS（render 只係食咗環境幀時間嘅一部分）'
                                         : 'FAIL（render 自己製造咗幀時間）'
    })));
  }));
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
