import json,io
t=io.open('_v23.json',encoding='utf-8').read()
i=t.find('{'); j=t.rfind('}')
if i<0:
    print(t[:600]); raise SystemExit
d=json.loads(t[i:j+1])
print('%-20s %5s %5s | %-30s | %-30s' % ('shot','p50','p90','舊版寫死 L30-80','自適應 skinWin'))
print('-'*112)
for k in d['after']:
    a=d['after'][k]; b=d['before'][k]
    ha=a['hue']; hb=b['hue']
    sa='搵唔到' if not a['found'] else ('%5.2f%%  離 flesh %s°'%(a['cov'], ha['gapDeg'] if ha else '?'))
    sb='搵唔到' if not b['found'] else ('%5.2f%%  離 flesh %s°'%(b['cov'], hb['gapDeg'] if hb else '?'))
    w=a['win']
    print('%-20s %5.1f %5.1f | %-30s | %-30s  窗=[%.0f→%.0f]' % (k[:20], a['p50'], a['p90'], sb, sa, w['lo'], w['hi']))
print()
print('B 逐 shot 記憶:', d['persistence'])
print('C 套全部     :', d['applyAll'], '->', 'PASS' if d['applyAllPass'] else 'FAIL')
