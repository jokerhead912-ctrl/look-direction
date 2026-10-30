/* 兩件事：
   A. 證明回歸門「有牙」—— 將 zoneAnchors 覆寫返 v21 嘅硬編碼值，
      I3（分區掣方向性）必須變 FAIL。如果佢照樣 PASS，即係條門係廢嘅。
   B. CDL 導出 → 自己 parse 返 → 用同一組數再算一次，驗證數字自洽
      （Resolve 嗰步要外部工具，呢度淨係驗「我 export 嘅嘢係咪講得出嘅嘢」）。 */
const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(800);

  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const S=window.ldKey.S, P=window.ldPerf;
    const cv=document.querySelector('#cv'), g=cv.getContext('2d');
    /* 暗調夜景合成幀（同 _golden.js 嘅 dark） */
    const c=document.createElement('canvas'); c.width=900;c.height=600;
    const x=c.getContext('2d');
    const gr=x.createLinearGradient(0,0,900,600);
    gr.addColorStop(0,'#05060a'); gr.addColorStop(.6,'#141821'); gr.addColorStop(1,'#2b3038');
    x.fillStyle=gr; x.fillRect(0,0,900,600);
    for(let i=0;i<10;i++){ const v=Math.round(12+i*24);
      x.fillStyle='rgb('+v+','+v+','+v+')'; x.fillRect(20+i*80,530,70,50); }
    x.fillStyle='#6b4636'; x.beginPath(); x.arc(760,150,90,0,Math.PI*2); x.fill();
    addShot(c,'gate'); await sleep(600);

    const decile=hi=>{ const W=cv.width,H=cv.height,d=g.getImageData(0,0,W,H).data,n=W*H;
      const lum=new Float32Array(n);
      for(let i=0;i<n;i++){const o=i*4;lum[i]=0.2126*d[o]+0.7152*d[o+1]+0.0722*d[o+2];}
      const idx=Array.from(lum.keys()).sort((a,b)=>lum[a]-lum[b]);
      const N=Math.floor(n*0.10), set=hi?idx.slice(n-N):idx.slice(0,N);
      let s=0; for(const i of set) s+=lum[i]; return s/set.length; };
    const reset=async()=>{ for(const k of ['exp','con','high','shad','white','black','temp','tint','sat','vib']) S.sec[k]=0;
      S.pvKey++; S.pvCache.clear(); P.render(false); await sleep(80); };
    const runI3=async()=>{
      const out={};
      for(const [k,hi] of [['shad',0],['black',0],['high',1],['white',1]]){
        await reset(); const base=decile(hi);
        await reset(); S.sec[k]=100;  S.pvKey++;S.pvCache.clear();P.render(false); await sleep(80); const up=decile(hi);
        await reset(); S.sec[k]=-100; S.pvKey++;S.pvCache.clear();P.render(false); await sleep(80); const dn=decile(hi);
        out[k]={base:+base.toFixed(2),plus:+up.toFixed(2),minus:+dn.toFixed(2),
                pass: (up-base)>=8 && (base-dn)>=2};
      }
      await reset(); return out;
    };

    /* ---- A1：今嘅 code（shot-adapted anchors） ---- */
    const now=await runI3();
    /* ---- A2：覆寫返 v21 硬編碼錨點，睇條門會唔會紅 ---- */
    const orig=window.zoneAnchors;
    window.zoneAnchors=function(){
      return {bk:0.30,shA:0.02,shB:0.45,hiA:0.55,hiB:0.98,whA:0.70,whB:1.00,zS:0.18,zM:0.50,zH:0.85};
    };
    const v21=await runI3();
    window.zoneAnchors=orig;

    /* ---- B：CDL 自洽 ---- */
    await reset();
    S.sec.con=40; S.sec.exp=25; S.sec.sat=1.1; S.pvKey++;S.pvCache.clear();P.render(false); await sleep(120);
    const cdl=exportCdlFor(S.sec);
    const txt=(typeof cdl==='string')?cdl:(cdl&&cdl.text?cdl.text:JSON.stringify(cdl));
    const nums=(txt.match(/-?\d+\.?\d*(e[-+]?\d+)?/g)||[]).map(Number).filter(v=>isFinite(v));
    /* slope/offset/power 應該各 3 個；sat 1 個 */
    const before=decile(1);
    return {
      I3_now: now,
      I3_v21anchors: v21,
      gateHasTeeth: Object.keys(v21).some(k=>!v21[k].pass),
      cdl:{ len:txt.length, head:txt.slice(0,180), numCount:nums.length },
      brightDecileWithGrade:+before.toFixed(2)
    };
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
