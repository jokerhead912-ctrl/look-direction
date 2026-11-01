/* 追蹤嘅 ground-truth 測試（未過關唔好當得）。
   兩條獨立證據：
   1) 已知真值 —— 對源圖施加已知 scale s0 + 位移 (dx,dy) 生成新 shot，
      追蹤反解出嚟嘅 (cx,cy,s) 要同道真值相符。
   2) 交叉對照 —— 追蹤出嚟嘅 matte vs 喺目標 shot 上「獨立 auto 偵測」嘅 matte，
      計 IoU。auto 係另一條路，兩條路講同一件事先算數。 */
const { chromium } = require('playwright');
const IMG='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/v4_A_none.png';
let b=null;
(async()=>{
  b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(800);
  const [ch]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#b-addshot')]);
  await ch.setFiles([IMG]); await pg.waitForTimeout(2200);

  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const S=window.ldKey.S, K=window.ldKey;
    const centerFrac=M=>{ let X0=1e9,X1=-1,Y0=1e9,Y1=-1;
      for(let y=0;y<M.h;y++) for(let x=0;x<M.w;x++) if(M.m[y*M.w+x]>0.15){
        if(x<X0)X0=x; if(x>X1)X1=x; if(y<Y0)Y0=y; if(y>Y1)Y1=y; }
      if(X1<0) return null;
      return {cx:(X0+X1+1)/2/M.w, cy:(Y0+Y1+1)/2/M.h}; };

    /* ---- 源 shot：auto 畫 key ---- */
    switchShot(0); S.keyMatte=null; K.ensureMatte();
    const ok0=K.autoSkinMatte();
    const c0=centerFrac(S.keyMatte);
    const cov0=+(K.keyCoverage()*100).toFixed(2);
    saveShotState();

    /* ---- 施加「已知」變換，生成目標 shot ---- */
    const img=S.vendorImg, IW=img.width, IH=img.height;
    const XS=[{n:'T1_放大右移',s0:1.18,dx:90,dy:-40},
              {n:'T2_縮小左下',s0:0.82,dx:-70,dy:55},
              {n:'T3_輕微移位',s0:1.05,dx:30,dy:20}];
    for(const t of XS){
      const c=document.createElement('canvas'); c.width=IW; c.height=IH;
      const x=c.getContext('2d');
      x.fillStyle='#000'; x.fillRect(0,0,IW,IH);
      x.drawImage(img, t.dx, t.dy, IW*t.s0, IH*t.s0);
      addShot(c,t.n); await sleep(400);
    }
    switchShot(0); await sleep(200);

    /* ---- 追蹤 ---- */
    const t0=performance.now();
    const res=keyTrackAll();
    const ms=+(performance.now()-t0).toFixed(0);

    /* ---- 逐張驗 ---- */
    const rows=[];
    for(let i=1;i<S.shots.length;i++){
      const t=XS[i-1];
      const r=res[i];
      const exp={cx:c0.cx*t.s0 + t.dx/IW, cy:c0.cy*t.s0 + t.dy/IH, s:t.s0};
      /* 追蹤出嚟嘅 matte */
      switchShot(i); await sleep(200);
      const T={w:S.keyMatte.w,h:S.keyMatte.h,m:Float32Array.from(S.keyMatte.m)};
      const covT=+(K.keyCoverage()*100).toFixed(2);
      /* 同一張圖上獨立 auto 一次，做交叉對照 */
      S.keyMatte=null; K.ensureMatte();
      const okA=K.autoSkinMatte();
      const A=S.keyMatte;
      let inter=0,uni=0;
      if(okA){
        for(let k=0;k<T.m.length;k++){
          const a=T.m[k]>0.35, bb=A.m[k]>0.35;
          if(a&&bb) inter++; if(a||bb) uni++;
        }
      }
      rows.push({
        name:t.n, score:r.score,
        expCx:+exp.cx.toFixed(3), expCy:+exp.cy.toFixed(3), expS:+exp.s.toFixed(2),
        gotCx:r.cx, gotCy:r.cy, gotS:r.s,
        dCx:+(r.cx-exp.cx).toFixed(3), dCy:+(r.cy-exp.cy).toFixed(3), dS:+(r.s-exp.s).toFixed(2),
        covTracked:covT, autoOk:okA, iou: uni? +(inter/uni).toFixed(3) : null
      });
    }
    switchShot(0);
    return {srcAutoOk:ok0, srcCov:cov0, srcCenter:{cx:+c0.cx.toFixed(3),cy:+c0.cy.toFixed(3)},
            trackMs:ms, rows:rows};
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
})().catch(e=>console.log('FATAL',e.message))
  .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} console.log('CLOSED'); process.exit(0); });
