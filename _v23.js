/* v23 驗收：
   A. auto 膚色偵測 —— 自適應 skinWin vs 舊版寫死 L 30–80，喺真實素材上對比覆蓋率，
      再用「選中區平均色相離 flesh line 幾遠」做 sanity check（怕降到門檻之後亂揀背景）。
   B. matte 逐 shot 記憶 —— 畫完切走再切返，覆蓋率要喺返度；未畫過嗰張要係乾淨嘅 0。
   C. 套全部 —— keyApplyAll 之後每張都要有 key。 */
const { chromium } = require('playwright');
const D='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/';
const IMGS=[
  D+'look-direction/v4_A_none.png',
  D+'ab_skill_test/ref_shot04.jpg',
  D+'ab_skill_test/ref_shot05.jpg',
  D+'ab_skill_test/ref_shot06.jpg',
  D+'ab_skill_test/ref_shot08.jpg'
];
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
    await ch.setFiles([f]); await pg.waitForTimeout(1800);
  }

  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const S=window.ldKey.S, K=window.ldKey;
    const fresh=()=>{ S.keyMatte=null; K.ensureMatte(); };
    /* 選中區嘅平均色相，同 flesh line 中心差幾遠 */
    const hueGap=()=>{
      const lab=S.vendorLabQuick||S.vendorLabFull; if(!lab) return null;
      const gl=K.gridLab(lab), M=S.keyMatte; if(!M) return null;
      let n=0,sx=0,sy=0;
      const gw=gl.w||M.w, gh=gl.h||M.h;
      for(let y=0;y<M.h;y++) for(let x=0;x<M.w;x++){
        const v=M.m[y*M.w+x]; if(v<0.35) continue;
        const gx=Math.min(gw-1,Math.round(x*gw/M.w)), gy=Math.min(gh-1,Math.round(y*gh/M.h));
        const i=gy*gw+gx, a=gl.a[i], bb=gl.b[i];
        if(a*a+bb*bb<4) continue;
        const h=Math.atan2(bb,a)*180/Math.PI;
        sx+=Math.cos(h*Math.PI/180); sy+=Math.sin(h*Math.PI/180); n++;
      }
      if(!n) return null;
      let mh=Math.atan2(sy,sx)*180/Math.PI; const fl=K.FL();
      let d=mh-fl[0]; while(d>180)d-=360; while(d<-180)d+=360;
      return {n:n, meanHue:+mh.toFixed(1), fleshHue:+fl[0].toFixed(1), gapDeg:+Math.abs(d).toFixed(1)};
    };
    const measure=(win)=>{
      const out={};
      for(let i=0;i<S.shots.length;i++){
        if(i!==S.shotIdx) switchShot(i);
        fresh();
        const st=S.shots[i];
        const an=st.an||{};
        const ok=K.autoSkinMatte();
        out[st.name]={
          p10:+(an.p10||0).toFixed(1), p50:+(an.p50||0).toFixed(1), p90:+(an.p90||0).toFixed(1), p99:+(an.p99||0).toFixed(1),
          win: win?null:{lo:+skinWin().lo.toFixed(1),hi:+skinWin().hi.toFixed(1)},
          found:ok, cov:+(K.keyCoverage()*100).toFixed(2), hue:hueGap()
        };
      }
      return out;
    };
    const origWin=window.skinWin;
    const after=measure(false);                                    /* 自適應 */
    window.skinWin=()=>({lo:30,hi:80,wlo:10,whi:12});              /* 舊版寫死 */
    const before=measure(true);
    window.skinWin=origWin;

    /* B. 逐 shot 記憶 */
    for(let i=0;i<S.shots.length;i++){ if(i!==S.shotIdx) switchShot(i); fresh(); }
    switchShot(0); fresh(); K.autoSkinMatte();
    const c0=+(K.keyCoverage()*100).toFixed(2);
    switchShot(1); const c1=+(K.keyCoverage()*100).toFixed(2);
    switchShot(0); const c0b=+(K.keyCoverage()*100).toFixed(2);
    const pers={shot0_cov:c0, afterSwitchTo1:c1, backTo0:c0b,
          pass: c0>0.5 && c1<0.01 && Math.abs(c0b-c0)<0.01};

    /* C. 套全部 */
    switchShot(0); fresh(); K.autoSkinMatte();
    keyApplyAll();
    const all=[];
    for(let i=0;i<S.shots.length;i++){ if(i!==S.shotIdx) switchShot(i);
      all.push(+(K.keyCoverage()*100).toFixed(2)); }
    return {before:before, after:after, persistence:pers, applyAll:all,
            applyAllPass: all.every(v=>v>0.5)};
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
})().catch(e=>console.log('FATAL',e.message))
  .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} console.log('CLOSED'); process.exit(0); });
