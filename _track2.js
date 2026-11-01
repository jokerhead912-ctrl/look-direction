/* 追蹤嘅「反面」同「真實」測試 —— 淨驗成功案例會自欺。
   B 反面：目標 shot 冇皮膚 → 命中分要低，而且唔可以靜靜雞產出垃圾。
   C 真實：同一個鏡位、唔同 grade（s4_01 vs s4_02 都係 shot05）→ 要高分 + 同 auto 高 IoU。
   D 真實：跨 shot（shot05 → shot08，唔同鏡位）→ 分數應該明顯跌，用嚟睇「追蹤唔到」時嘅表現。 */
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
  await load(D+'s4_09_shot08_johnnie-to.png');

  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const S=window.ldKey.S, K=window.ldKey;
    const iouAgainst=async(i,tracked)=>{
      switchShot(i); await sleep(200);
      const T={w:tracked.w,h:tracked.h,m:Float32Array.from(tracked.m)};
      S.keyMatte=null; K.ensureMatte();
      const ok=K.autoSkinMatte(); const A=S.keyMatte;
      if(!ok) return null;
      let inter=0,uni=0;
      for(let k=0;k<T.m.length;k++){ const a=T.m[k]>0.35, bb=A.m[k]>0.35; if(a&&bb)inter++; if(a||bb)uni++; }
      return uni? +(inter/uni).toFixed(3):null;
    };
    const out={};
    /* C：shot05 兩個唔同 grade */
    switchShot(0); S.keyMatte=null; K.ensureMatte();
    out.srcAuto=K.autoSkinMatte(); out.srcCov=+(K.keyCoverage()*100).toFixed(2);
    saveShotState();
    let res=keyTrackAll();
    out.C_sameShotDiffGrade={score:res[1].score, iou:await iouAgainst(1,S.shots[1].st.key)};
    /* D：跨鏡位 shot05 → shot08 */
    out.D_crossShot={score:res[2].score, iou:await iouAgainst(2,S.shots[2].st.key)};

    /* B：反面 —— 目標完全冇皮膚 */
    switchShot(0); await sleep(150);
    const c=document.createElement('canvas'); c.width=800; c.height=500;
    const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,800,500);
    g.addColorStop(0,'#0b1e3a'); g.addColorStop(0.5,'#1c3f6e'); g.addColorStop(1,'#5b86b8');
    x.fillStyle=g; x.fillRect(0,0,800,500);
    addShot(c,'NO_SKIN_BLUE'); await sleep(400);
    switchShot(0); await sleep(150);
    res=keyTrackAll();
    const blue=res[res.length-1];
    out.B_negative={score:blue.score, covAfter:null};
    /* 反面案例：追蹤完嗰張嘅覆蓋率（理論上唔應該有嘢） */
    switchShot(S.shots.length-1); await sleep(200);
    out.B_negative.covAfter=+(K.keyCoverage()*100).toFixed(2);
    switchShot(0);
    return out;
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
})().catch(e=>console.log('FATAL',e.message))
  .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} console.log('CLOSED'); process.exit(0); });
