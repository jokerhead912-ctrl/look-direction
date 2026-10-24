'use strict';
/* 端到端「調色流程」測試：由入圖 → 追色 → 逐條桿 tune → 切面 → A/B
   → 示波器 → 保層次 → 導出 → undo/redo → 全屏/專注，全程捉 JS error，
   每步記 low／mid／high 三區平均 RGB（驗證真係改到嘢、三通道冇塌）。*/
const fs=require('fs');
const P=process.argv[2]||'/Users/kincheung/WorkBuddy/2026-09-01-13-20-32/look-direction/index.html';
const html=fs.readFileSync(P,'utf8');
const INJECT=`
<script>
(async()=>{
  const R={errs:[],steps:[]};
  window.__R=R;
  window.onerror=function(m,s,l,c,e){ R.errs.push(String(m)+(e&&e.stack? ' @ '+(e.stack.split('\\n')[1]||'').trim():'')); };
  window.addEventListener('unhandledrejection',ev=>R.errs.push('REJECT '+String(ev.reason)));
  const _ce=console.error; console.error=function(){ R.errs.push('console.error '+[].slice.call(arguments).join(' ')); _ce.apply(console,arguments); };

  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  /* 三區平均：暗/中/亮各取一批 pixel，先睇得出係咪真係改到嘢、三通道有冇塌 */
  function zones(){
    const cv=S.outCanvas; if(!cv) return null;
    const w=cv.width,h=cv.height;
    const d=cv.getContext('2d').getImageData(0,0,w,h).data;
    const acc=[[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2];
      const y=0.2126*r+0.7152*g+0.0722*b;
      const z=y<70?0:(y<175?1:2);
      acc[z][0]+=r; acc[z][1]+=g; acc[z][2]+=b; acc[z][3]++;
    }
    return acc.map(a=>a[3]? [Math.round(a[0]/a[3]),Math.round(a[1]/a[3]),Math.round(a[2]/a[3]),a[3]] : [-1,-1,-1,0]);
  }
  const zs=()=>{ const z=zones(); return z? z.map(a=>a[0]+','+a[1]+','+a[2]).join(' | ') : 'none'; };
  const changed=(a,b)=>{ if(!a||!b) return false;
    return a.some((v,i)=>Math.abs(v[0]-b[i][0])>2||Math.abs(v[1]-b[i][1])>2||Math.abs(v[2]-b[i][2])>2); };
  const chanOK=z=>!!z && z.every(a=>a[3]===0 || (a[0]>0&&a[1]>0&&a[2]>0));
  function step(name,fn){
    try{
      const before=zones();
      const r=fn();
      const after=zones();
      R.steps.push({n:name, before:zs.call(null)&&before? before.map(a=>a[0]+','+a[1]+','+a[2]).join(' | '):'',
                    after:after? after.map(a=>a[0]+','+a[1]+','+a[2]).join(' | '):'',
                    ch:changed(before,after), ok:chanOK(after), note:r||''});
    }catch(e){ R.steps.push({n:name,err:e.message}); R.errs.push('STEP '+name+' '+e.message); }
  }
  async function astep(name,fn){
    try{
      const before=zones();
      const r=await fn();
      const after=zones();
      R.steps.push({n:name, before:before? before.map(a=>a[0]+','+a[1]+','+a[2]).join(' | '):'',
                    after:after? after.map(a=>a[0]+','+a[1]+','+a[2]).join(' | '):'',
                    ch:changed(before,after), ok:chanOK(after), note:r||''});
    }catch(e){ R.steps.push({n:name,err:e.message}); R.errs.push('STEP '+name+' '+e.message); }
  }

  try{
    /* 1. 入來稿 */
    const vc=document.createElement('canvas'); vc.width=1200; vc.height=800;
    const vg=vc.getContext('2d');
    const vgd=vg.createLinearGradient(0,0,1200,800);
    vgd.addColorStop(0,'#101a24'); vgd.addColorStop(0.45,'#5d5646'); vgd.addColorStop(0.8,'#b09a72'); vgd.addColorStop(1,'#e2d0a2');
    vg.fillStyle=vgd; vg.fillRect(0,0,1200,800);
    vg.fillStyle='#243140'; vg.fillRect(0,540,1200,260);
    vg.fillStyle='#c89878'; vg.beginPath(); vg.ellipse(400,380,130,175,0,0,7); vg.fill();
    vg.fillStyle='#8d5f42'; vg.beginPath(); vg.ellipse(400,380,70,100,0,0,7); vg.fill();
    const vimg=new Image();
    await new Promise(r=>{ vimg.onload=r; vimg.onerror=r; vimg.src=vc.toDataURL('image/png'); });
    addShot(vimg,'shot_17.png');
    await wait(400);
    R.step0_vendor=!!S.vendorImg;

    /* 2. 入參考圖（目標） */
    const rc=document.createElement('canvas'); rc.width=800; rc.height=520;
    const rg2=rc.getContext('2d');
    const rgd=rg2.createLinearGradient(0,0,800,520);
    rgd.addColorStop(0,'#0b2436'); rgd.addColorStop(0.5,'#376f80'); rgd.addColorStop(1,'#cfc0a0');
    rg2.fillStyle=rgd; rg2.fillRect(0,0,800,520);
    const rimg=new Image();
    await new Promise(r=>{ rimg.onload=r; rimg.onerror=r; rimg.src=rc.toDataURL('image/png'); });
    addRef(rimg,'target_wong.png');
    await wait(400);
    R.step1_ref=S.refs.length;
    R.step1_active=S.active;
    R.pipShown=!$('pip').hidden;

    /* 3. 追色基準 */
    await astep('追色（參考圖自動匹配）',async()=>{ render(false); await wait(120); return 'ref='+S.active; });

    /* 4. 逐條 CDL 桿 tune */
    for(const [k,v] of [['exp',35],['con',25],['temp',-30],['tint',12],['sat',18]]){
      await astep('桿 '+k+'='+v, async()=>{
        if(!SLIDERS[k]) return 'MISSING';
        SLIDERS[k].set(v); render(false); await wait(120); return '';
      });
    }
    /* 5. 分區 ZONES */
    for(const [k,v] of [['high',-20],['shad',15],['white',12],['black',-14],['vib',20]]){
      await astep('分區 '+k+'='+v, async()=>{
        if(!SLIDERS[k]) return 'MISSING';
        SLIDERS[k].set(v); render(false); await wait(120); return '';
      });
    }
    /* 6. 色輪面 */
    await astep('色輪 Gain', async()=>{
      setToneMode('wheel'); S.sec.lgg.gain={x:0.45,y:0.15};
      render(false); await wait(150); return 'mode='+S.toneMode;
    });
    /* 7. 曲線面 */
    await astep('曲線 Y', async()=>{
      setToneMode('curve'); S.sec.cur.Y=[[0,0],[0.5,0.62],[1,1]];
      render(false); await wait(150); return 'mode='+S.toneMode;
    });
    /* 8. 數值面 */
    await astep('數值 CDL', async()=>{
      setToneMode('num');
      S.sec.cdlOv={s:[1.15,1.0,0.92],o:[0.02,0,0],p:[1,1,1],sat:1.15};
      render(false); await wait(150); return 'mode='+S.toneMode;
    });
    /* 9. 返簡化面（切面要無損：同一套 CDL 出嚟嘅圖要一致） */
    const beforeSwitch=zones();
    setToneMode('spl'); render(false); await wait(150);
    const afterSwitch=zones();
    R.switchNote='spl 面出圖='+(afterSwitch? afterSwitch.map(a=>a[0]+','+a[1]+','+a[2]).join(' | '):'');

    /* 10. A/B 對比 */
    await astep('A/B 開', async()=>{ toggleAB(); render(false); await wait(150); return 'locked='+S.locked; });
    await astep('A/B 關', async()=>{ toggleAB(); render(false); await wait(150); return 'locked='+S.locked; });

    /* 11. 示波器三種圖 */
    R.scopes={};
    for(const m of ['hist','wave','vec']){
      S.scopeMode=m; drawScopes();
      const s=$('scopecv');
      const d=s.getContext('2d').getImageData(0,0,s.width,s.height).data;
      let mn=255,mx=0; for(let i=0;i<d.length;i+=4){ if(d[i]<mn)mn=d[i]; if(d[i]>mx)mx=d[i]; }
      R.scopes[m]=(mx-mn>20)? 'painted' : 'BLANK';
    }
    updateFlatWarn();
    R.clip={lo:$('clipLo').textContent, hi:$('clipHi').textContent,
            chan:$('clipCh')?$('clipCh').textContent:'NA', flat:S.flat};

    /* 12. 保層次 */
    await astep('保層次 ON', async()=>{
      $('protect').checked=true; render(false); await wait(150);
      updateFlatWarn();
      return 'clip '+$('clipLo').textContent+' / '+$('clipHi').textContent+
             '  單通道'+($('clipCh')?$('clipCh').textContent:'NA');
    });
    R.clipProtected={lo:$('clipLo').textContent, hi:$('clipHi').textContent};
    $('protect').checked=false; render(false); await wait(120);

    /* 13. 導出 */
    try{ const t=makeCubeText(); R.cube={len:t.length, lines:t.split('\\n').length, head:t.split('\\n')[1]}; }
    catch(e){ R.cube='ERR '+e.message; R.errs.push('cube '+e.message); }
    try{ const t=makeCdlText();
      R.cdl={len:t.length, nums:(t.match(/-?[0-9]+\\.[0-9]{6}/g)||[]).length}; }
    catch(e){ R.cdl='ERR '+e.message; R.errs.push('cdl '+e.message); }
    try{ const c=buildSheetCanvas(); R.sheet=c? (c.width+'x'+c.height) : 'null'; }
    catch(e){ R.sheet='ERR '+e.message; R.errs.push('sheet '+e.message); }

    /* 14. undo / redo */
    const histLen0=S.hist.length;
    undo(); await wait(150);
    const afterUndo=zones();
    redo(); await wait(150);
    const afterRedo=zones();
    R.undoRedo={histLen0, afterUndo:afterUndo? afterUndo.map(a=>a[0]).join(',') : '',
                afterRedo:afterRedo? afterRedo.map(a=>a[0]).join(',') : '',
                ok:!!afterUndo&&!!afterRedo};

    /* 15. 專注 / 全屏 切換後 render 要照行 */
    await astep('專注 F', async()=>{ toggleFocus(true); await wait(150); render(false); await wait(150);
      return 'focus='+S.focus+' pip='+(!$('pip').hidden); });
    await astep('全屏 ~', async()=>{ toggleFs(true); await wait(150); render(false); await wait(150);
      return 'fs='+S.fs; });
    await astep('離開全屏', async()=>{ toggleFs(false); await wait(150); return 'fs='+S.fs; });
    await astep('離開專注', async()=>{ toggleFocus(false); await wait(150); return 'focus='+S.focus; });

    /* 16. 換來稿 / 換 look */
    await astep('換 look（←）', async()=>{
      setActive(Math.max(0,S.active-1)); render(false); await wait(150); return 'active='+S.active; });
    await astep('換 look（→）', async()=>{
      setActive(Math.min(itemCount()-1,S.active+1)); render(false); await wait(150); return 'active='+S.active; });

    R.OK=true;
  }catch(e){ R.OK=false; R.ERR=(e&&e.message)||String(e); R.STACK=(e&&e.stack||'').split('\\n').slice(0,4).join(' | '); }
  document.title='FLOW '+JSON.stringify(R);
})();
<\/script>
`;
if(!html.includes('</body>')) throw new Error('冇 </body>');
fs.writeFileSync('/tmp/_ld_flow.html', html.replace('</body>', INJECT+'</body>'));
console.log('built /tmp/_ld_flow.html');
