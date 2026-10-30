/* 分區掣／調色輪「區域選擇性」診斷：
   每個掣只應該郁佢聲稱嗰段亮度。shad/black 應該郁暗部多過亮部，high/white 反之。
   如果兩邊郁嘅量差唔多，或者掣完全冇反應 → 錨點（0.18/0.50/0.85、0.02/0.45/0.55/0.98）唔啱呢個 shot。 */
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
    const S=window.ldKey.S, P=window.ldPerf;
    const cv=document.querySelector('#cv');
    const g=cv.getContext('2d');

    const an=S.vendorAn||{};
    /* ---- 建立基準：全 0 設定 ---- */
    for(const k of ['high','shad','white','black','vib']) S.sec[k]=0;
    S.pvKey++; S.pvCache.clear(); P.render(false); await sleep(120);
    const W=cv.width, H=cv.height;
    const base=g.getImageData(0,0,W,H).data;
    const n=W*H;
    const lum=new Float32Array(n);
    for(let i=0;i<n;i++){ const o=i*4; lum[i]=0.2126*base[o]+0.7152*base[o+1]+0.0722*base[o+2]; }
    const idx=Array.from(lum.keys()).sort((a,b)=>lum[a]-lum[b]);
    const N=Math.floor(n*0.10);
    const dark=idx.slice(0,N), bright=idx.slice(n-N);

    const meanOf=(set,arr)=>{ let s=0; for(const i of set){ const o=i*4; s+=0.2126*arr[o]+0.7152*arr[o+1]+0.0722*arr[o+2]; } return s/set.length; };

    const probe=async(k,v)=>{
      for(const kk of ['high','shad','white','black']) S.sec[kk]=0;
      S.sec[k]=v;
      S.pvKey++; S.pvCache.clear(); P.render(false); await sleep(60);
      const d=g.getImageData(0,0,W,H).data;
      return {
        dark  : +(meanOf(dark,d)   - meanOf(dark,base)).toFixed(2),
        bright: +(meanOf(bright,d) - meanOf(bright,base)).toFixed(2),
        all   : +(meanOf(idx,d)    - meanOf(idx,base)).toFixed(2)
      };
    };
    const out={anchors:{p1:an.p1,p10:an.p10,p50:an.p50,p90:an.p90,p99:an.p99}, size:[W,H], rows:{}};
    /* 控制組：全 0 打兩次，應該條條都係 0.00 —— 否則係量度假象 */
    out.control=[await probe('high',0), await probe('white',0)];
    out.baseLuma={dark:+meanOf(dark,base).toFixed(2), bright:+meanOf(bright,base).toFixed(2), all:+meanOf(idx,base).toFixed(2)};
    /* 亮部分佈：有幾多 % 像素 L 過到 hardcode 嘅 55 / 70？ */
    let c55=0,c70=0; for(let i=0;i<n;i++){ if(lum[i]/255>0.55*0.9) c55++; if(lum[i]/255>0.70*0.9) c70++; }
    out.pctOver={over55:+(c55/n*100).toFixed(2), over70:+(c70/n*100).toFixed(2)};
    for(const k of ['shad','black','high','white']){
      const p=await probe(k,100), m=await probe(k,-100);
      out.rows[k]={plus100:p, minus100:m,
        /* 選擇性 = 目標區郁嘅量 − 反面區郁嘅量（正數 = 掣掱啱區） */
        select:+((k==='shad'||k==='black' ? p.dark-p.bright : p.bright-p.dark)).toFixed(2)};
    }
    for(const k of ['high','shad','white','black']) S.sec[k]=0;
    S.pvKey++; S.pvCache.clear(); P.render(false); await sleep(60);
    return out;
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
