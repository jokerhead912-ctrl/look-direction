/* 定位拖動時 p95 掉幀嘅元兇：逐個 wrap render() 收尾嗰幾件嘢，睇邊件貴。 */
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
    const acc={};
    const wrap=(name)=>{
      const f=window[name];
      if(typeof f!=='function') return false;
      acc[name]={n:0,sum:0,max:0};
      window[name]=function(){ const t=performance.now(); const r=f.apply(this,arguments);
        const d=performance.now()-t; const a=acc[name]; a.n++; a.sum+=d; if(d>a.max)a.max=d; return r; };
      return true;
    };
    const ok=['updateDirection','updateABBadge','updateNumUI','updateFlatWarn','updateGroupDots','invalidateScope']
      .filter(wrap);
    const ts=[]; let N=0;
    function loop(t){
      ts.push(t); N++;
      if(N<90){
        S.sec.con=((N%40)-20)*4; S.sec.shad=((N%26)-13)*6;
        S.pvKey++; S.pvCache.clear(); scheduleRender(true);
        requestAnimationFrame(loop);
      }else{
        const d=[]; for(let i=1;i<ts.length;i++) d.push(ts[i]-ts[i-1]);
        d.sort((a,b)=>a-b);
        const out={wrapped:ok, medMs:+d[Math.floor(d.length/2)].toFixed(2),
                   p95Ms:+d[Math.floor(d.length*0.95)].toFixed(2)};
        out.perCall={};
        for(const k in acc) out.perCall[k]={avg:+(acc[k].sum/Math.max(1,acc[k].n)).toFixed(2),
                                            max:+acc[k].max.toFixed(2), calls:acc[k].n};
        res(out);
      }
    }
    requestAnimationFrame(loop);
  }));
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
