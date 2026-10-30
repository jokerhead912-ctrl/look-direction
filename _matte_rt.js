/* matte 來回測試：畫 matte → 匯出 PNG（alpha）→ 匯入 → 比較 */
const { chromium } = require('playwright');
const IMG='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/v4_A_none.png';
(async()=>{
  const b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.stack||e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(800);
  const [ch]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#b-addshot')]);
  await ch.setFiles([IMG]);
  await pg.waitForTimeout(2200);
  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const K=window.ldKey, S=K.S;
    const lab=S.vendorLabFull;
    /* 畫一個唔規則嘅 matte（橢圓 + 一條掃） */
    K.ensureMatte();
    const M=K.S.keyMatte;
    for(let a=0;a<360;a+=3){
      const r=a*Math.PI/180;
      K.stampMatte(M.w*0.62+Math.cos(r)*M.w*0.10, M.h*0.45+Math.sin(r)*M.h*0.18, M.w*0.06, 0.5, true);
    }
    K.S.brushR=60;
    for(let x=0;x<200;x++) K.stampMatte(M.w*0.15+x*0.6, M.h*0.7, M.w*0.03, 0.6, true);
    /* 模擬 touchKey（stamp 冇 bump） */
    K.S.pvKey++; K.S.pvCache.clear();
    await sleep(400);
    const f0=K.keyMatteToField(lab);
    const cov0=K.keyCoverage();
    const snap0=Float32Array.from(f0);
    /* 造 PNG（alpha = 保護量） */
    const c=document.createElement('canvas'); c.width=lab.w; c.height=lab.h;
    const x=c.getContext('2d'); const id=x.createImageData(lab.w,lab.h), d=id.data;
    for(let i=0;i<lab.n;i++){ const p=i*4, v=Math.round(Math.max(0,Math.min(1,f0[i]))*255);
      d[p]=255;d[p+1]=255;d[p+2]=255;d[p+3]=v; }
    x.putImageData(id,0,0);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const file=new File([blob],'k.png',{type:'image/png'});
    /* 清咗再匯入 */
    K.keyClear(); await sleep(300);
    const covClr=K.keyCoverage();
    K.importKeyPNG(file);
    await sleep(1200);
    const f1=K.keyMatteToField(lab);
    const cov1=K.keyCoverage();
    let mx=0,sum=0,n=0;
    for(let i=0;i<lab.n;i+=7){ const dd=Math.abs(snap0[i]-f1[i]); if(dd>mx)mx=dd; sum+=dd; n++; }
    return {w:lab.w,h:lab.h,cov0:+(cov0*100).toFixed(2),covCleared:+(covClr*100).toFixed(2),
            cov1:+(cov1*100).toFixed(2), maxDiff:+mx.toFixed(4), meanDiff:+(sum/n).toFixed(4),
            coverDeltaPct:+((cov1-cov0)*100).toFixed(3)};
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
