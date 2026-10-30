/* 決定性測試：拖動 90 幀，逐幀記低 JS 側 S.timing.total 同 rAF 幀間隔。
   如果 max(JS) 遠細過 max(幀間隔) → 尖峰唔喺我哋嘅 JS（係合成／上傳／環境）。 */
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
    const js=[], ts=[]; let N=0;
    function loop(t){
      ts.push(t); N++;
      if(N<90){
        S.sec.con=((N%40)-20)*4; S.sec.shad=((N%26)-13)*6;
        S.pvKey++; S.pvCache.clear(); scheduleRender(true);
        requestAnimationFrame(()=>{ js.push(+(S.timing.total||0).toFixed(2)); loop2(); });
      }else fin();
      function loop2(){ requestAnimationFrame(loop); }
    }
    function fin(){
      const d=[]; for(let i=1;i<ts.length;i++) d.push(+(ts[i]-ts[i-1]).toFixed(2));
      const srt=a=>{const x=a.slice().sort((p,q)=>p-q);return{med:x[Math.floor(x.length/2)],
        p95:x[Math.floor(x.length*0.95)],max:x[x.length-1]};};
      res({frame:srt(d), jsTotal:srt(js),
           jsOver20: js.filter(v=>v>20).length, framesOver25: d.filter(v=>v>25).length});
    }
    requestAnimationFrame(loop);
  }));
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
