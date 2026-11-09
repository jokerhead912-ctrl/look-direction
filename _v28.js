/* v28：全部導出 + 摘要頁 回歸
   T40 逐張用返自己嘅 grade（三張唔同 sat，唔可以全部等於當前嗰張）
   T41 全解 retouch PNG 係真 PNG、三張唔同
   T42 批量完還原本來揀住嗰張（shotIdx + sat 都唔可以變）
   T43 單檔全包 summary.html：3 個「下載 retouch PNG」+ 3 個內嵌 PNG dataURL + 參數
   T44 輕量 summary.html（ZIP 用）：href 指去同目錄 PNG，唔內嵌全解
   T45 ZIP：10 個 entry（3×[png,cube,cdl] + summary.html），CRC 對得上
   T46 端到端：㩒「全部導出」只出 1 個 .zip 下載；㩒「摘要頁」只出 1 個 .html
   T47 牙齒：唔切 shot 嘅舊做法，三張 sat 會得 1 個值
   鐵律：finally close browser + process.exit(0) */
const { chromium } = require('playwright');
const fs = require('fs');
const D = 'C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/';
const IMGS = ['ab_skill_test/ref_shot04.jpg','ab_skill_test/ref_shot05.jpg','ab_skill_test/ref_shot06.jpg']
  .map(f=>'data:image/jpeg;base64,'+fs.readFileSync(D+f).toString('base64'));
let b=null;

(async()=>{
  b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(900);

  const R=await pg.evaluate(async(imgs)=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const K=window.ldKey, S=K.S, out={};
    const load=src=>new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=src; });
    const hash=u=>{ let h=2166136261; for(let i=0;i<u.length;i+=97){ h^=u[i]; h=Math.imul(h,16777619); } return (h>>>0).toString(16); };
    const isPNG=u=>u[0]===137&&u[1]===80&&u[2]===78&&u[3]===71&&u[4]===13&&u[5]===10&&u[6]===26&&u[7]===10;

    out.ver=(typeof APP_VER!=='undefined')?APP_VER:'?';
    out.T00_ui=!!document.querySelector('#b-expallshots')&&!!document.querySelector('#b-summary');

    for(let i=0;i<imgs.length;i++){ const im=await load(imgs[i]); addShot(im,'batch_'+i); await sleep(350); }
    out.shots=S.shots.length;

    /* 三張各設一個唔同 grade，寫入佢自己嘅 shot state */
    const sats=[-60,40,0];
    for(let i=0;i<3;i++){
      switchShot(i);
      S.sec.sat=sats[i]; S.sec.temp=(i===0?30:0); S.sec.high=(i===1?35:0);
      saveShotState(); render(false); await sleep(120);
    }
    switchShot(1); await sleep(200);
    const keep=S.shotIdx, keepSat=S.sec.sat;

    /* T49 profile：一張入面邊度最慢（決定要唔要拔走 LUT）*/
    switchShot(0); render(false);
    let tp=performance.now(); const pf=exportFull(); const tFull=performance.now()-tp;
    tp=performance.now(); await new Promise(r=>pf.toBlob(r,'image/png')); const tBlob=performance.now()-tp;
    tp=performance.now(); makeCubeText(); const tCube=performance.now()-tp;
    tp=performance.now(); makeCdlText(); const tCdl=performance.now()-tp;
    out.T49={fullMs:+tFull.toFixed(0),blobMs:+tBlob.toFixed(0),cubeMs:+tCube.toFixed(0),cdlMs:+tCdl.toFixed(0)};
    switchShot(keep); render(false);

    const t0=performance.now();
    const items=await K.collectShotExports(null);
    out.T48_totalMs=+(performance.now()-t0).toFixed(0);
    out.T48_msPerShot=+(out.T48_totalMs/3).toFixed(0);
    out.T40_items=items.length;
    out.T40_errors=items.filter(x=>x.error).map(x=>x.error);
    out.T40_sats=items.map(x=>x.sec&&x.sec.sat);
    out.T40_distinctGrades=new Set(out.T40_sats).size;
    /* 牙齒：唔切 shot（舊做法）→ 三張都係當前嗰張嘅 sat */
    const legacy=[]; for(let i=0;i<3;i++) legacy.push(keepSat);
    out.T47_TEETH_legacyDistinctGrades=new Set(legacy).size;

    out.T41_pngOK=items.every(x=>!x.error&&isPNG(x.png));
    out.T41_sizes=items.map(x=>x.error?0:x.png.length);
    out.T41_hashes=items.map(x=>x.error?'ERR':hash(x.png));
    out.T41_distinctPNG=new Set(out.T41_hashes).size;
    /* T50 牙齒：靜默切換出嘅 PNG 要同「正常 render 後」逐張出嘅逐位元組一樣，
       否則就係為咗快而改咗數 —— 唔收貨。 */
    switchShot(0); render(false);
    const mb=await new Promise(r=>exportFull().toBlob(r,'image/png'));
    const mh=hash(new Uint8Array(await mb.arrayBuffer()));
    out.T50_silentMatchesManual=(mh===out.T41_hashes[0]);
    switchShot(keep); render(false);

    out.T42_restoredShot=(S.shotIdx===keep);
    out.T42_restoredSat=(S.sec.sat===keepSat);
    out.T42_keep=keep;

    const good=items.filter(x=>!x.error);
    const fullHTML=K.buildSummaryHTML(good,true);
    const liteHTML=K.buildSummaryHTML(good,false);
    out.T43_embeddedPNG=(fullHTML.match(/data:image\/png;base64,/g)||[]).length;
    out.T43_downloadLinks=(fullHTML.match(/class="dl"/g)||[]).length;
    out.T43_hasParams=fullHTML.indexOf('-60.0')>=0 && fullHTML.indexOf('40.0')>=0;
    out.T43_hasCDL=fullHTML.indexOf('ASC CDL')>=0;
    out.T43_bytes=fullHTML.length;
    out.T44_liteNoEmbedded=(liteHTML.match(/data:image\/png;base64,/g)||[]).length;
    out.T44_liteRelative=(liteHTML.match(/href="\d\d_/g)||[]).length;
    out.T44_liteBytes=liteHTML.length;

    const files=K.buildExportFiles(good,false);
    out.T45_files=files.length;
    out.T45_names=files.map(f=>f.name);
    out.T45_allBytes=files.every(f=>f.data&&f.data.length>0);

    const zip=K.makeZip(files);
    const zu=new Uint8Array(await zip.arrayBuffer()), dv=new DataView(zu.buffer);
    let eo=-1;
    for(let i=zu.length-22;i>=Math.max(0,zu.length-65557);i--){ if(dv.getUint32(i,true)===0x06054b50){ eo=i; break; } }
    out.T45_hasEOCD=eo>=0;
    if(eo>=0){
      const cnt=dv.getUint16(eo+10,true), cd=dv.getUint32(eo+16,true);
      out.T45_entries=cnt;
      let p=cd, names=[], crcOK=true;
      for(let k=0;k<cnt;k++){
        const fl=dv.getUint16(p+28,true), el=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true);
        names.push(new TextDecoder().decode(zu.subarray(p+46,p+46+fl)));
        const lo=dv.getUint32(p+42,true), sz=dv.getUint32(p+20,true);
        if(dv.getUint32(lo,true)===0x04034b50){
          const lfl=dv.getUint16(lo+26,true), lel=dv.getUint16(lo+28,true);
          const data=zu.subarray(lo+30+lfl+lel, lo+30+lfl+lel+sz);
          if((K.crc32(data)>>>0)!==(dv.getUint32(p+16,true)>>>0)) crcOK=false;
        }else crcOK=false;
        p+=46+fl+el+cl;
      }
      out.T45_namesInZip=names;
      out.T45_crcOK=crcOK;
      out.T45_zipBytes=zu.length;
    }

    /* 端到端：攔低 <a download>.click()，睇吓實際出幾個檔 */
    const orig=HTMLAnchorElement.prototype.click;
    const caps=[];
    HTMLAnchorElement.prototype.click=function(){ caps.push({href:this.href,download:this.download}); };
    try{
      await K.exportAllShots('zip');
      out.T46_zipDownloads=caps.length;
      out.T46_zipName=caps.length?caps[0].download:null;
      if(caps.length){
        const zz=new Uint8Array(await (await fetch(caps[0].href)).arrayBuffer());
        out.T46_zipMagic=zz[0]===0x50&&zz[1]===0x4b;
      }
      caps.length=0;
      await K.exportAllShots('html');
      out.T46_htmlDownloads=caps.length;
      out.T46_htmlName=caps.length?caps[0].download:null;
      if(caps.length){
        const tx=await (await fetch(caps[0].href)).text();
        out.T46_htmlEmbeddedPNG=(tx.match(/data:image\/png;base64,/g)||[]).length;
      }
    }finally{ HTMLAnchorElement.prototype.click=orig; }
    out.T42_restoredAfterE2E=(S.shotIdx===keep);
    return out;
  }, IMGS);

  console.log(JSON.stringify(R,null,1));
  console.log('PAGEERROR:', E.length?E.slice(0,4).join(' | '):'none');
})().catch(e=>console.log('FATAL', e.message))
 .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} process.exit(0); });
