/* 黃金不變量跑喺**真實素材**上面（_golden.js 用嘅係合成幀）。
   合成幀會過到、真實素材過唔到嘅話，即係條不變量淨係啱自己砌嘅嘢。
   鐵律：finally 一定要 close browser，否則 evaluate 一拋錯 node 就永遠掛起。 */
const { chromium } = require('playwright');
const fs=require('fs');
const D='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/';
const IMGS=[D+'look-direction/v4_A_none.png',
            D+'ab_skill_test/ref_shot04.jpg',D+'ab_skill_test/ref_shot05.jpg',
            D+'ab_skill_test/ref_shot06.jpg',D+'ab_skill_test/ref_shot08.jpg'];
let b=null;
(async()=>{
  b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(800);
  for(const f of IMGS){
    const [ch]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#b-addshot')]);
    await ch.setFiles([f]); await pg.waitForTimeout(1600);
  }
  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const S=window.ldKey.S, P=window.ldPerf;
    const cv=document.querySelector('#cv'), g=cv.getContext('2d');
    const stats=()=>{
      const W=cv.width,H=cv.height,d=g.getImageData(0,0,W,H).data,n=W*H;
      const lum=new Float32Array(n); let mn=999,mx=-1,sum=0;
      for(let i=0;i<n;i++){ const o=i*4;
        const L=0.2126*d[o]+0.7152*d[o+1]+0.0722*d[o+2]; lum[i]=L; sum+=L;
        for(let ch=0;ch<3;ch++){ const v=d[o+ch]; if(v<mn)mn=v; if(v>mx)mx=v; } }
      const mean=sum/n; let vs=0; for(let i=0;i<n;i++) vs+=(lum[i]-mean)*(lum[i]-mean);
      return {n:n,lum:lum,mean:mean,sd:Math.sqrt(vs/n),mn:mn,mx:mx};
    };
    const decile=(st,hi)=>{ const idx=Array.from(st.lum.keys()).sort((a,b)=>st.lum[a]-st.lum[b]);
      const N=Math.max(1,Math.floor(st.n*0.10)), set=hi?idx.slice(st.n-N):idx.slice(0,N);
      let s=0; for(const i of set) s+=st.lum[i]; return s/set.length; };
    const reset=async()=>{ for(const k of ['exp','con','high','shad','white','black','temp','tint','sat','vib']) S.sec[k]=0;
      S.pvKey++; S.pvCache.clear(); P.render(false); await sleep(70); };
    const withSec=async(o)=>{ for(const k in o) S.sec[k]=o[k];
      S.pvKey++; S.pvCache.clear(); P.render(false); await sleep(70); return stats(); };

    const out={ver:(typeof APP_VER!=='undefined')?APP_VER:'?', frames:{}};
    for(let i=0;i<S.shots.length;i++){
      if(i!==S.shotIdx) switchShot(i);
      await sleep(120);
      const an=S.vendorAn||{};
      const f={p10:+(an.p10||0).toFixed(1),p50:+(an.p50||0).toFixed(1),p90:+(an.p90||0).toFixed(1),I:{}};
      /* I2 對比單調 */
      const sds=[]; for(const v of [-100,-50,0,50,100]){ await reset(); const st=await withSec({con:v}); sds.push(+st.sd.toFixed(2)); }
      let mono=true; for(let q=1;q<sds.length;q++) if(sds[q]<sds[q-1]-0.5) mono=false;
      f.I.monotonicContrast={sds:sds,pass:mono};
      /* I3 分區掣方向性（要有牙：+100 郁 ≥8 luma） */
      const dir={};
      for(const pair of [['shad',0],['black',0],['high',1],['white',1]]){
        const k=pair[0], reg=pair[1];
        await reset(); const base=stats();
        await reset(); const up=await withSec({[k]:100});
        await reset(); const dn=await withSec({[k]:-100});
        const m=st=>decile(st,reg);
        dir[k]={base:+m(base).toFixed(2),plus:+m(up).toFixed(2),minus:+m(dn).toFixed(2),
                pass:(m(up)-m(base))>=8 && (m(base)-m(dn))>=2};
      }
      f.I.zoneDirection=dir;
      /* I4 保層次 */
      await reset();
      const pcb=document.getElementById('protect'); const hadP=pcb?pcb.checked:false;
      if(pcb) pcb.checked=true;
      const sp=await withSec({con:100,exp:100});
      f.I.noClipWithProtect={min:sp.mn,max:sp.mx,pass:sp.mn>0&&sp.mx<255};
      if(pcb) pcb.checked=hadP;
      await reset();
      out.frames[S.shots[i].name]=f;
    }
    return out;
  });
  fs.writeFileSync('golden_real.json', JSON.stringify(R,null,1));
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
})().catch(e=>console.log('FATAL',e.message))
  .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} console.log('CLOSED'); process.exit(0); });
