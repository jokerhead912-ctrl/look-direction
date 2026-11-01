/* 查清 C（同一鏡位、唔同 grade）IoU=0 到底係「追蹤錯」定係「我嘅對照基準 auto 唔穩」。
   s4_01 同 s4_02 係同一格 shot05、淨係 grade 唔同 → 塊面應該喺同一個位。
   所以：auto(01) 嘅中心 ≈ auto(02) 嘅中心 先叫 auto 穩；如果兩個中心差好遠，
   即係 auto 唔穩，IoU 嗰條基準本身冇效，唔係追蹤嘅問題。 */
const { chromium } = require('playwright');
const D='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/ab_skill_test/';
let b=null;
(async()=>{
  b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(800);
  const load=async(f)=>{ const [ch]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#b-addshot')]);
                         await ch.setFiles([f]); await pg.waitForTimeout(1800); };
  await load(D+'s4_01_shot05_johnnie-to.png');
  await load(D+'s4_02_shot05_park-chan-wook.png');
  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const S=window.ldKey.S, K=window.ldKey;
    const ctr=M=>{ let X0=1e9,X1=-1,Y0=1e9,Y1=-1;
      for(let y=0;y<M.h;y++) for(let x=0;x<M.w;x++) if(M.m[y*M.w+x]>0.15){
        if(x<X0)X0=x; if(x>X1)X1=x; if(y<Y0)Y0=y; if(y>Y1)Y1=y; }
      return X1<0?null:{cx:+((X0+X1+1)/2/M.w).toFixed(3), cy:+((Y0+Y1+1)/2/M.h).toFixed(3),
                        bw:+((X1-X0+1)/M.w).toFixed(3), bh:+((Y1-Y0+1)/M.h).toFixed(3)}; };
    const autoAt=async(i)=>{ switchShot(i); await sleep(200);
      S.keyMatte=null; K.ensureMatte();
      const ok=K.autoSkinMatte();
      return {ok:ok, cov:+(K.keyCoverage()*100).toFixed(2), box:ctr(S.keyMatte)}; };
    const out={};
    out.auto_01=await autoAt(0);
    out.auto_02=await autoAt(1);
    /* 追蹤：由 01 畫完追去 02 */
    switchShot(0); S.keyMatte=null; K.ensureMatte(); K.autoSkinMatte(); saveShotState();
    out.srcBox=ctr(S.keyMatte);
    const res=keyTrackAll();
    out.trackRes=res;
    switchShot(1); await sleep(200);
    out.tracked_02={cov:+(K.keyCoverage()*100).toFixed(2), box:ctr(S.keyMatte)};
    out.anchors={};
    for(let i=0;i<2;i++){ switchShot(i); await sleep(120);
      const an=S.vendorAn||{};
      out.anchors[S.shots[i].name]=[+(an.p10||0).toFixed(1),+(an.p50||0).toFixed(1),+(an.p90||0).toFixed(1)];
      out.anchors[S.shots[i].name+'win']=(function(){const w=skinWin();return [+w.lo.toFixed(1),+w.hi.toFixed(1)];})();
    }
    switchShot(0);
    return out;
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
})().catch(e=>console.log('FATAL',e.message))
  .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} console.log('CLOSED'); process.exit(0); });
