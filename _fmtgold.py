import json,io
t=io.open('golden.json',encoding='utf-8').read()
i=t.find('{'); j=t.rfind('}')
if i<0:
    print(t[:800]); raise SystemExit
d=json.loads(t[i:j+1])
print('ver',d['ver'])
allpass=True
for k,f in d['frames'].items():
    a=f['anchors']; I=f['I']
    bad=[]
    if not I['monotonicContrast']['pass']: bad.append('I2')
    for kk,v in I['zoneDirection'].items():
        if not v['pass']: bad.append('I3:'+kk)
    if not I['noClipWithProtect']['pass']: bad.append('I4')
    if bad: allpass=False
    print()
    print('== %-8s p10/p50/p90 = %5.1f %5.1f %5.1f   %s' % (k, a['p10'], a['p50'], a['p90'],
          'ALL PASS' if not bad else 'FAIL -> '+','.join(bad)))
    print('   I2 對比 sd:', I['monotonicContrast']['sds'])
    for kk in ['shad','black','high','white']:
        v=I['zoneDirection'][kk]
        print('   I3 %-6s base %7.2f  +100 %7.2f  -100 %7.2f  %s' % (kk, v['base'], v['plus'], v['minus'],
              'PASS' if v['pass'] else 'FAIL'))
    nc=I['noClipWithProtect']
    print('   I4 保層次 min/max: %d/%d  %s' % (nc['min'], nc['max'], 'PASS' if nc['pass'] else 'FAIL'))
print()
print('合成幀全部不變量:', 'ALL PASS' if allpass else '有 FAIL')
