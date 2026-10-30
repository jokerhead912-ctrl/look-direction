/* 黃金幀回歸集（golden-frame regression）。
   三張合成幀（暗調夜景 / 明亮日光 / 混合鎢絲燈），每張驗五條「不變量」——
   凍結數字冇用，要驗嘅係「無論咩圖都應該成立」嘅性質，呢啲先捉到回歸。
   I3 直接編碼 v22 修好嗰個 bug（分區掣方向性）。 */
const { chromium } = require('playwright');
const fs=require('fs');
const FILE='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/golden.json';
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

    /* ---- 三張合成幀 ---- */
    function frame(kind){
      const w=900,h=600, c=document.createElement('canvas'); c.width=w;c.height=h;
      const x=c.getContext('2d');
      const grd=x.createLinearGradient(0,0,w,h);
      if(kind==='dark'){ grd.addColorStop(0,'#05060a'); grd.addColorStop(.6,'#141821'); grd.addColorStop(1,'#2b3038'); }
      else if(kind==='bright'){ grd.addColorStop(0,'#b9c2cc'); grd.addColorStop(.5,'#dfe4e8'); grd.addColorStop(1,'#f2f0ea'); }
      else { grd.addColorStop(0,'#3a2513'); grd.addColorStop(.5,'#8a7256'); grd.addColorStop(1,'#9fb6c8'); } /* 暖陰 + 冷高光 */
      x.fillStyle=grd; x.fillRect(0,0,w,h);
      /* 灰階 ramp（驗中性） */
      for(let i=0;i<10;i++){ const v=Math.round(12+i*24);
        x.fillStyle='rgb('+v+','+v+','+v+')'; x.fillRect(20+i*80, h-70, 70, 50); }
      /* 一嚿「皮膚」色（驗膚色保護） */
      x.fillStyle = kind==='bright'? '#d8a984' : (kind==='warm'? '#c08d67' : '#6b4636');
      x.beginPath(); x.arc(w-140,150,90,0,Math.PI*2); x.fill();
      return c;
    }
    const stats=()=>{
      const W=cv.width,H=cv.height, d=g.getImageData(0,0,W,H).data, n=W*H;
      const lum=new Float32Array(n); let mn=999,mx=-1,sum=0;
      for(let i=0;i<n;i++){ const o=i*4;
        const L=0.2126*d[o]+0.7152*d[o+1]+0.0722*d[o+2];
        lum[i]=L; sum+=L; if(L<mn)mn=L; if(L>mx)mx=L;
        for(let ch=0;ch<3;ch++){ const v=d[o+ch]; if(v<mn)mn=v; if(v>mx)mx=v; }
      }
      const mean=sum/n; let vs=0; for(let i=0;i<n;i++) vs+=(lum[i]-mean)*(lum[i]-mean);
      return {data:d,W,H,n,lum,mean,sd:Math.sqrt(vs/n),mn,mx};
    };
    const decileMean=(st,hi)=>{ const idx=Array.from(st.lum.keys()).sort((a,b)=>st.lum[a]-st.lum[b]);
      const N=Math.floor(st.n*0.10), set=hi?idx.slice(st.n-N):idx.slice(0,N);
      let s=0; for(const i of set) s+=st.lum[i]; return s/set.length; };
    const reset=async()=>{ for(const k of ['exp','con','high','shad','white','black','temp','tint','sat','vib']) S.sec[k]=0;
      S.pvKey++; S.pvCache.clear(); P.render(false); await sleep(80); };
    const withSec=async(o)=>{ for(const k in o) S.sec[k]=o[k];
      S.pvKey++; S.pvCache.clear(); P.render(false); await sleep(80); return stats(); };

    const out={ver:(window.ldKey&&document.title.match(/v\d+/))?document.title.match(/v\d+/)[0]:'?', frames:{}};
    for(const kind of ['dark','bright','warm']){
      const c=frame(kind);
      /* addShot 需要 img-like；canvas 可以直接畀 */
      addShot(c,kind);
      await sleep(600);
      const an=S.vendorAn||{};
      const f={anchors:{p10:+(an.p10||0).toFixed(1),p50:+(an.p50||0).toFixed(1),p90:+(an.p90||0).toFixed(1)},I:{}};

      /* I2：對比單調 —— con 越大，輸出亮度標準差只可以升，唔可以跌 */
      const sds=[]; for(const v of [-100,-50,0,50,100]){ await reset(); const st=await withSec({con:v}); sds.push(+st.sd.toFixed(2)); }
      let mono=true; for(let i=1;i<sds.length;i++) if(sds[i]<sds[i-1]-0.5) mono=false;
      f.I.monotonicContrast={sds:sds, pass:mono};

      /* I3：分區掣方向性 —— v22 修嘅 bug 嘅回歸門 */
      const dir={};
      for(const [k,reg] of [['shad',0],['black',0],['high',1],['white',1]]){
        await reset(); const base=stats();
        await reset(); const up=await withSec({[k]:100});
        await reset(); const dn=await withSec({[k]:-100});
        const m=st=>decileMean(st,reg);
        /* 門檻要有牙：掣推到 +100，目標區至少要郁 8 luma（255 制，約 3%）。
           舊版 ±1 太鬆 —— v21 嗰組硬編碼錨點（high 淨郁 6.4、white 淨郁 2.8）照樣 PASS，
           條門等於廢。8 luma 係「額定權限 0.30 → 全效約 +80 luma」嘅 10%，好寬容。 */
        dir[k]={base:+m(base).toFixed(2), plus:+m(up).toFixed(2), minus:+m(dn).toFixed(2),
                pass: (m(up)-m(base))>=8 && (m(base)-m(dn))>=2};
      }
      f.I.zoneDirection=dir;

      /* I4：保層次開 → 唔可以有絕對 0 / 255 */
      await reset();
      const pcb=document.getElementById('protect');
      const hadP=pcb?pcb.checked:false;
      if(pcb) pcb.checked=true;
      const sp=await withSec({con:100,exp:100});
      f.I.noClipWithProtect={min:sp.mn, max:sp.mx, pass:sp.mn>0 && sp.mx<255};
      if(pcb) pcb.checked=hadP;
      await reset();
      out.frames[kind]=f;
    }
    return out;
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  fs.writeFileSync(FILE, JSON.stringify(R,null,1));
  console.log('saved ->',FILE);
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
