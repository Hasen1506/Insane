#!/usr/bin/env python3
# INSANE v0.8 live test as real users on mobile profiles. Screens shot in light + dark.
import json, os, time, subprocess, traceback, urllib.parse
from playwright.sync_api import sync_playwright
from PIL import Image

B = 'http://localhost:8099'
OUT = '/workspace/projects/6f0ffc48-74a2-4cb3-8297-6f9b94b75e81/work/live/shots'
os.makedirs(OUT, exist_ok=True)
LOG, AUDIT, NET = [], {}, {}
def note(*a):
    s = ' '.join(str(x) for x in a); LOG.append(s); print(s, flush=True)

def code(email):
    j = json.loads(subprocess.check_output(['curl', '-s', B + '/api/dev/outbox?email=' + urllib.parse.quote(email)]))
    import re; return re.search(r'code is (\d{6})', j['mail']['text']).group(1)

def clock(offset_ms):
    subprocess.run(['curl', '-s', '-X', 'POST', '-H', 'content-type: application/json', '-d', json.dumps({'offset': offset_ms}), B + '/api/dev/clock'], capture_output=True)

AUDIT_JS = r"""() => {
 const lum=c=>{const m=c.match(/[\d.]+/g);if(!m)return null;const [r,g,b]=m.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return {L:.2126*r+.7152*g+.0722*b,a:m[3]===undefined?1:+m[3]}};
 const bgOf=el=>{while(el){const c=getComputedStyle(el).backgroundColor;const l=lum(c);if(l&&l.a>0.5)return l.L;el=el.parentElement}return 1};
 const small=[],low=[];let n=0;
 document.querySelectorAll('button,a,[data-act],input,select,label.chip').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')return;n++;if(r.height<44||r.width<44)small.push((e.innerText||e.getAttribute('aria-label')||e.id||e.dataset.act||'').trim().slice(0,30)+` ${Math.round(r.width)}x${Math.round(r.height)}`)});
 document.querySelectorAll('p,span,small,div.meta,.meta,li,h3,button,label').forEach(e=>{if(!e.childNodes.length||![...e.childNodes].some(c=>c.nodeType===3&&c.textContent.trim()))return;const r=e.getBoundingClientRect();if(!r.width)return;const f=lum(getComputedStyle(e).color);if(!f)return;const b=bgOf(e);const hi=Math.max(f.L,b),lo=Math.min(f.L,b);const cr=(hi+.05)/(lo+.05);if(cr<4.5)low.push(e.innerText.trim().slice(0,30)+' '+cr.toFixed(2)+' '+getComputedStyle(e).fontSize)});
 const unl=[...document.querySelectorAll('input,textarea,select')].filter(i=>!i.labels?.length&&!i.getAttribute('aria-label')&&i.type!=='hidden'&&i.type!=='file').map(i=>i.id||i.name||i.type);
 return {vw:innerWidth,sw:document.documentElement.scrollWidth,interactive:n,smallTargets:small.slice(0,40),smallCount:small.length,lowContrast:[...new Set(low)].slice(0,25),lowCount:low.length,unlabelled:unl,fontMin:Math.min(...[...document.querySelectorAll('body *')].filter(e=>e.innerText&&e.children.length===0).map(e=>parseFloat(getComputedStyle(e).fontSize))),toast:document.querySelector('.toast')?.innerText||null,lang:document.documentElement.lang,doctype:!!document.doctype}
}"""

def shoot(page, name, dark_too=True, full=False):
    for scheme in (['light', 'dark'] if dark_too else ['light']):
        try:
            page.emulate_media(color_scheme=scheme); page.wait_for_timeout(120)
            p = f'{OUT}/{name}-{scheme}.png'
            page.screenshot(path=p, full_page=full)
            im = Image.open(p).convert('RGB'); w = 400; h = int(im.height * w / im.width)
            im.resize((w, h)).save(p.replace('.png', '.jpg'), quality=60); os.remove(p)
            if scheme == 'light':
                AUDIT[name] = page.evaluate(AUDIT_JS)
        except Exception as e:
            note('shoot fail', name, scheme, e)
    page.emulate_media(color_scheme='light')

def ctx_for(pw, br, device, geo=(13.0827, 80.2707), tz='Asia/Kolkata', name='x'):
    d = dict(pw.devices[device]) if device else {'viewport': {'width': 1280, 'height': 860}}
    c = br.new_context(**d, geolocation={'latitude': geo[0], 'longitude': geo[1], 'accuracy': 15}, permissions=['geolocation'], timezone_id=tz, locale='en-IN', service_workers='block')
    NET[name] = {'bytes': 0, 'reqs': 0, 'blocked': set(), 'big': []}
    def route(r):
        u = r.request.url
        if u.startswith(B): return r.continue_()
        NET[name]['blocked'].add(u.split('/')[2]); return r.abort()
    c.route('**/*', route)
    def resp(res):
        try:
            l = int(res.headers.get('content-length') or 0)
            if not l and res.url.startswith(B) and res.request.resource_type in ('document', 'fetch', 'xhr', 'script'):
                try: l = len(res.body())
                except Exception: l = 0
            NET[name]['bytes'] += l; NET[name]['reqs'] += 1
            if l > 200000: NET[name]['big'].append((res.url.replace(B, ''), l))
        except Exception: pass
    c.on('response', resp)
    return c

def T(p, sel, timeout=4000):
    l = p.locator(sel).first
    try: l.click(timeout=timeout)
    except Exception:
        l.click(force=True, timeout=2000)
    p.wait_for_timeout(180)

def try_(label, fn):
    try: fn(); return True
    except Exception as e:
        note('STEP FAIL', label, str(e).split('\n')[0][:200]); return False

def sign_in(p, email):
    p.wait_for_selector('#si-email', timeout=15000)
    p.fill('#si-email', email); T(p, 'button:has-text("Email me a code")')
    p.wait_for_selector('#si-code', timeout=8000); p.fill('#si-code', code(email)); T(p, 'button:has-text("Sign in")')
    p.wait_for_selector('#ob-name, nav.tabs', timeout=15000)

def text(p):
    try: return p.locator('#app').inner_text()
    except Exception: return ''

def run():
    errs = []
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        # ====== Persona 1: Meera, new solo user, Pixel 7 ======
        c1 = ctx_for(pw, br, 'Pixel 7', name='meera'); p = c1.new_page()
        p.on('pageerror', lambda e: errs.append('meera: ' + str(e)))
        t0 = time.time(); p.goto(B, wait_until='domcontentloaded'); p.wait_for_selector('#si-email', timeout=20000)
        note('meera first paint to email box s', round(time.time() - t0, 2))
        shoot(p, '01-welcome-pixel7')
        # bad input
        p.fill('#si-email', 'not-an-email'); T(p, 'button:has-text("Email me a code")'); p.wait_for_timeout(500); shoot(p, '02-bad-email', False)
        note('bad email screen', text(p)[:200].replace('\n', ' | '))
        p.fill('#si-email', 'meera@x.com'); T(p, 'button:has-text("Email me a code")'); p.wait_for_selector('#si-code'); shoot(p, '03-code-entry')
        p.fill('#si-code', '000000'); T(p, 'button:has-text("Sign in")'); p.wait_for_timeout(500); shoot(p, '04-wrong-code', False)
        note('wrong code', text(p)[:200].replace('\n', ' | '))
        p.fill('#si-code', code('meera@x.com')); T(p, 'button:has-text("Sign in")'); p.wait_for_selector('#ob-name', timeout=15000)
        shoot(p, '05-ob-name')
        p.fill('#ob-name', 'Meera Krishnamurthy-Venkataraghavan 🌶️🔥'); shoot(p, '05b-ob-longname', False)
        # reload mid-onboarding
        p.reload(); p.wait_for_selector('#ob-name, nav.tabs', timeout=15000)
        note('after reload ob-name value =', repr(p.input_value('#ob-name')) if p.locator('#ob-name').count() else 'no ob-name')
        p.fill('#ob-name', 'Meera Krishnamurthy-Venkataraghavan 🌶️🔥'); T(p, '#ob-age'); T(p, '[data-act=ob-next]')
        p.wait_for_selector('#lp-q-home', timeout=8000); shoot(p, '06-ob-place')
        # keyboard: focus search, check viewport
        p.fill('#lp-q-home', 'Minjur'); p.wait_for_timeout(1500); shoot(p, '07-ob-place-search')
        note('search Minjur results', text(p)[text(p).find('Minjur') - 50:][:300].replace('\n', ' | ') if 'Minjur' in text(p) else 'none')
        if p.locator('.res').count(): T(p, '.res >> nth=0')
        else: T(p, '[data-act=lp-gps]'); p.wait_for_timeout(1500)
        p.wait_for_timeout(800); shoot(p, '08-ob-place-picked', full=True)
        note('place picked text', text(p)[:600].replace('\n', ' | '))
        try_('size', lambda: T(p, '[data-act=lp-size][data-v="2"]')); try_('radius', lambda: T(p, '[data-act=lp-radius][data-v="5"]'))
        T(p, '[data-act=ob-next]'); p.wait_for_timeout(400); shoot(p, '09-ob-circle', full=True)
        note('circle step', text(p)[:500].replace('\n', ' | '))
        T(p, '[data-act=ob-circle][data-v=skip]'); p.wait_for_selector('#ob-mind', timeout=8000); shoot(p, '10-ob-mind', full=True)
        try_('urge lane', lambda: (T(p, '[data-act=ob-lane][data-v=urge]'), p.fill('#ob-mind', 'swim in the sea at sunrise'), p.wait_for_timeout(400), shoot(p, '10b-ob-mind-typed', False)))
        T(p, '[data-act=ob-finish][data-v=mind]'); p.wait_for_selector('nav.tabs', timeout=15000); p.wait_for_timeout(800)
        shoot(p, '11-solo-home'); shoot(p, '11b-solo-home-full', False, full=True)
        note('solo home', text(p)[:900].replace('\n', ' | '))
        for t in ['circle', 'city', 'ledger']:
            T(p, f'[data-act="tab"][data-v="{t}"]'); p.wait_for_timeout(700); shoot(p, f'12-solo-{t}')
            note('solo', t, text(p)[:500].replace('\n', ' | '))
            for seg_act, segs in {'circle': ('cseg', ['plans', 'pacts', 'midnight', 'mole', 'people']), 'city': ('sseg', ['feed', 'calls', 'league']), 'ledger': ('lseg', ['pots'])}[t][1:] and [{'circle': ('cseg', ['plans', 'pacts', 'midnight', 'mole', 'people']), 'city': ('sseg', ['feed', 'calls', 'league']), 'ledger': ('lseg', ['pots'])}[t]]:
                for s in segs:
                    if try_(f'{t}/{s}', lambda: T(p, f'[data-act={seg_act}][data-v={s}]', 2500)):
                        p.wait_for_timeout(400); shoot(p, f'13-solo-{t}-{s}', s in ('mole', 'feed', 'pots'))
                        note('solo', t, s, text(p)[:350].replace('\n', ' | '))
        T(p, '[data-act=make]'); p.wait_for_timeout(400); shoot(p, '14-solo-plus', True, full=True)
        note('+ sheet', p.locator('.sheet').inner_text()[:800].replace('\n', ' | '))
        for k in ['mission', 'pot', 'drop']:
            p.keyboard.press('Escape'); T(p, '[data-act=make]'); 
            if try_('mk ' + k, lambda: T(p, f'[data-act=mk][data-v={k}]', 2500)):
                p.wait_for_timeout(500); shoot(p, f'15-solo-mk-{k}', False); note('solo mk', k, (p.locator('.sheet').inner_text() if p.locator('.sheet').count() else text(p))[:300].replace('\n', ' | '))
        p.keyboard.press('Escape')
        T(p, '[data-act="tab"][data-v="you"]'); p.wait_for_timeout(500); shoot(p, '16-solo-you'); shoot(p, '16b-solo-you-full', False, full=True)
        note('you', text(p)[:900].replace('\n', ' | '))
        # decode in solo
        T(p, '[data-act="tab"][data-v="city"]')
        if try_('decode', lambda: T(p, '[data-act=sheet][data-v=decode]', 2500)):
            p.wait_for_timeout(400); shoot(p, '17-decode'); note('decode', p.locator('.sheet').inner_text()[:400].replace('\n', ' | '))
            p.keyboard.press('Escape')
        html = p.content(); note('ANS in client source:', 'ANS=[' in html or "WATERLOO" in html)
        # offline
        c1.set_offline(True); p.wait_for_timeout(600); T(p, '[data-act="tab"][data-v="today"]'); p.wait_for_timeout(500); shoot(p, '18-offline', False)
        note('offline text', text(p)[:200].replace('\n', ' | '))
        c1.set_offline(False)
        # ====== Persona 2: Arjun creator, iPhone 13 ======
        c2 = ctx_for(pw, br, 'iPhone 13', name='arjun', geo=(13.0569, 80.2425)); a = c2.new_page(); a.on('pageerror', lambda e: errs.append('arjun: ' + str(e)))
        a.goto(B); sign_in(a, 'arjun@x.com'); a.fill('#ob-name', 'Arjun'); T(a, '#ob-age'); T(a, '[data-act=ob-next]')
        a.wait_for_selector('#lp-q-home'); T(a, '[data-act=lp-gps]'); a.wait_for_timeout(2500); shoot(a, '20-arjun-gps', False, full=True)
        note('arjun gps', text(a)[:400].replace('\n', ' | '))
        try_('exact', lambda: T(a, '[data-act=lp-prec][data-v=exact]')); a.wait_for_timeout(300); shoot(a, '21-arjun-exact', True, full=True)
        T(a, '[data-act=ob-next]'); a.fill('#ob-cname', 'Mylapore Mad Hatters with a very long circle name indeed'); T(a, '[data-act=ob-circle][data-v=create]')
        a.wait_for_selector('#ob-mind', timeout=8000); T(a, '[data-act=ob-lane][data-v=need]'); a.fill('#ob-mind', 'run 3 times a week'); a.wait_for_timeout(300)
        try_('stake', lambda: T(a, '[data-act=ob-stake][data-v="1"]', 2000)); T(a, '[data-act=ob-finish][data-v=mind]')
        a.wait_for_selector('nav.tabs', timeout=15000); a.wait_for_timeout(600); shoot(a, '22-creator-home'); shoot(a, '22b-creator-home-full', False, full=True)
        note('creator home', text(a)[:700].replace('\n', ' | '))
        cc = a.evaluate('() => S.circle && S.circle.code'); note('circle code', cc)
        T(a, '[data-act="tab"][data-v="circle"]'); a.wait_for_timeout(400); shoot(a, '23-creator-circle')
        try_('invite', lambda: (T(a, '[data-act=sheet][data-v=invite]', 2500), a.wait_for_timeout(400), shoot(a, '24-invite-sheet')))
        a.keyboard.press('Escape')
        # ====== Persona 3: Kavya joins by deep link, Pixel 7 ======
        c3 = ctx_for(pw, br, 'Pixel 7', name='kavya', geo=(13.0336, 80.2687)); k = c3.new_page(); k.on('pageerror', lambda e: errs.append('kavya: ' + str(e)))
        k.goto(B + '/#c' + cc); k.wait_for_selector('#si-email', timeout=15000); shoot(k, '30-deeplink-signin')
        note('deep link sign-in screen mentions circle?', 'Mylapore' in text(k), text(k)[:200].replace('\n', ' | '))
        sign_in(k, 'kavya@x.com'); shoot(k, '31-deeplink-ob'); note('deep link ob', text(k)[:250].replace('\n', ' | '))
        k.fill('#ob-name', 'كافيا Kavya'); T(k, '#ob-age'); T(k, '[data-act=ob-next]'); k.wait_for_selector('#lp-q-home')
        k.fill('#lp-q-home', 'Chennai'); k.wait_for_timeout(1200)
        if k.locator('.res').count(): T(k, '.res >> nth=0')
        T(k, '[data-act=ob-next]'); k.wait_for_timeout(400); shoot(k, '32-deeplink-circle-step', False, full=True)
        note('deeplink circle step', text(k)[:400].replace('\n', ' | '))
        try_('join', lambda: T(k, '[data-act=ob-circle][data-v=join]'))
        k.wait_for_selector('#ob-mind', timeout=8000); T(k, '[data-act=ob-finish][data-v=skip]'); k.wait_for_selector('nav.tabs', timeout=15000); k.wait_for_timeout(600)
        shoot(k, '33-joiner-home'); note('joiner in circle', k.evaluate('() => S.circle && S.circle.name'))
        # ====== Persona 4: Ravi joins by typing code, desktop 1280 ======
        c4 = ctx_for(pw, br, None, name='ravi', geo=(13.0108, 80.2206)); r = c4.new_page(); r.on('pageerror', lambda e: errs.append('ravi: ' + str(e)))
        r.goto(B); r.wait_for_selector('#si-email'); shoot(r, '40-desktop-signin'); sign_in(r, 'ravi@x.com'); r.fill('#ob-name', 'Ravi'); T(r, '#ob-age'); T(r, '[data-act=ob-next]')
        r.wait_for_selector('#lp-q-home'); T(r, '[data-act=lp-gps]'); r.wait_for_timeout(1500); T(r, '[data-act=ob-next]')
        r.fill('#ob-code', cc.lower()); T(r, '[data-act=ob-circle][data-v=join]'); r.wait_for_selector('#ob-mind', timeout=8000); T(r, '[data-act=ob-finish][data-v=skip]')
        r.wait_for_selector('nav.tabs', timeout=15000); r.wait_for_timeout(600); shoot(r, '41-desktop-home')
        # Meera second persona check: try to join while in none -> later
        # ====== Power user flows (Arjun) ======
        def A(label, fn): return try_(label, fn)
        # plan
        A('plan', lambda: (T(a, '[data-act="tab"][data-v="circle"]'), T(a, '[data-act=sheet][data-v=thread-new]'), T(a, '[data-act=tkind][data-v=plan]'), a.fill('#t-title', 'Beach cricket'), a.fill('#t-when', 'Sun 6am'), a.fill('#t-where', 'Besant Nagar'), T(a, '[data-act=t-create]'), a.wait_for_selector('#m-text'), a.fill('#m-text', 'who is in?'), a.press('#m-text', 'Enter'), a.wait_for_timeout(500), shoot(a, '50-plan-thread')))
        A('plan going kavya', lambda: (k.locator('[data-act="tab"][data-v="today"]').click(), k.wait_for_timeout(600), shoot(k, '51-kavya-home-plan'), T(k, '.thr:has-text("Beach cricket")'), T(k, '[data-act=going]'), k.wait_for_timeout(400), shoot(k, '52-kavya-going')))
        k.keyboard.press('Escape')
        # double-tap test: send same message twice quickly
        A('double send', lambda: (a.fill('#m-text', 'double'), a.press('#m-text', 'Enter'), a.press('#m-text', 'Enter'), a.wait_for_timeout(600)))
        note('double send count', a.evaluate("() => document.body.innerText.split('double').length-1"))
        # favor
        A('favor ask', lambda: (k.keyboard.press('Escape'), T(k, '[data-act="tab"][data-v="ledger"]'), T(k, '[data-act=fv-form][data-v=ask]'), k.wait_for_timeout(300), shoot(k, '53-favor-form'), k.fill('#fv-what', 'Help me shift a fridge'), T(k, '[data-act=fv-h][data-v="2"]'), T(k, '[data-act=fv-ask]'), k.wait_for_timeout(500), shoot(k, '54-ledger-favor')))
        A('favor claim', lambda: (a.keyboard.press('Escape'), T(a, '[data-act="tab"][data-v="today"]'), a.wait_for_timeout(800), shoot(a, '55-arjun-home-needs'), T(a, '[data-act=fv-claim]'), T(a, '[data-act=fv-done]'), T(a, '[data-act=fv-h2][data-v="2"]'), T(a, '[data-act=fv-done-save]'), a.wait_for_timeout(500)))
        A('favor confirm', lambda: (T(k, '[data-act="tab"][data-v="today"]'), k.wait_for_timeout(800), T(k, '[data-act=fv-confirm]'), k.wait_for_timeout(500), T(k, '[data-act="tab"][data-v="ledger"]'), k.wait_for_timeout(400), shoot(k, '56-ledger-after')))
        # pot
        A('pot', lambda: (T(a, '[data-act="tab"][data-v="ledger"]'), T(a, '[data-act=lseg][data-v=pots]'), T(a, '[data-act=pot-new]'), a.wait_for_timeout(300), shoot(a, '57-pot-form', True, full=True), a.fill('#np-name', 'Pondy trip'), a.fill('#np-each', '1500'), a.fill('#np-by', 'Friday'), a.fill('#np-min', '3'), a.fill('#np-pay', 'UPI arjun@okhdfc'), T(a, '[data-act=pot-create]'), a.wait_for_timeout(600), shoot(a, '58-pot-card')))
        note('pot currency', 'Pondy' in text(a), [l for l in text(a).split('\n') if '1,500' in l or '1500' in l][:3])
        A('pot pay', lambda: (T(k, '[data-act="tab"][data-v="today"]'), k.wait_for_timeout(700), T(k, '[data-act=pot-go]'), T(k, '[data-act=pledge]'), k.wait_for_timeout(400), T(k, '[data-act="tab"][data-v="ledger"]'), T(k, '[data-act=lseg][data-v=pots]'), T(k, '[data-act=pot-pay]'), k.wait_for_timeout(300), shoot(k, '59-pot-pay-methods'), note('pay methods', (k.locator('.sheet').inner_text() if k.locator('.sheet').count() else text(k))[:400].replace('\n', ' | '))))
        k.keyboard.press('Escape')
        # pact tick + cheer
        A('tick', lambda: (T(a, '[data-act="tab"][data-v="today"]'), T(a, '[data-act=tick]'), a.wait_for_timeout(400), shoot(a, '60-ticked')))
        A('pacts', lambda: (T(k, '[data-act="tab"][data-v="circle"]'), T(k, '[data-act=cseg][data-v=pacts]'), k.wait_for_timeout(300), shoot(k, '61-pacts'), T(k, '[data-act=cheer]')))
        # daily dare
        A('daily dare', lambda: (T(r, '[data-act="tab"][data-v="today"]'), T(r, '[data-act=sheet][data-v=proof][data-id=daily]'), r.wait_for_timeout(300), shoot(r, '62-dare-proof-desktop', False)))
        r.keyboard.press('Escape')
        # midnight
        A('midnight', lambda: (T(a, '[data-act="tab"][data-v="circle"]'), T(a, '[data-act=cseg][data-v=midnight]'), a.wait_for_timeout(300), shoot(a, '63-midnight', True, full=True), a.fill('#mn-text', 'Kavya, you are the funniest person here'), T(a, '[data-act=mnwhen][data-v=tonight]'), T(a, '[data-act=mn-send]'), a.wait_for_timeout(500), note('midnight with name', text(a)[:200].replace('\n', ' | ')), shoot(a, '64-midnight-name-blocked', False)))
        # mole
        A('mole', lambda: (T(k, '[data-act="tab"][data-v="circle"]'), T(k, '[data-act=cseg][data-v=mole]'), k.wait_for_timeout(300), shoot(k, '65-mole-3people'), note('mole 3 people', text(k)[:300].replace('\n', ' | '))))
        # dare someone
        A('dare', lambda: (T(a, '[data-act=make]'), T(a, '[data-act=mk][data-v=dare]'), a.wait_for_timeout(300), shoot(a, '66-dare-sheet', True, full=True), note('dare sheet', a.locator('.sheet').inner_text()[:400].replace('\n', ' | '))))
        a.keyboard.press('Escape')
        # meet / feed
        A('feed locked', lambda: (T(a, '[data-act="tab"][data-v="city"]'), T(a, '[data-act=sseg][data-v=feed]'), a.wait_for_timeout(300), shoot(a, '67-feed-locked')))
        A('meet', lambda: (T(a, '[data-act=make]'), T(a, '[data-act=mk][data-v=meet]'), a.wait_for_timeout(300), (T(a, '[data-act=pair-show]') if a.locator('[data-act=pair-show]').count() else None), a.wait_for_timeout(400), shoot(a, '68-meet-qr')))
        def do_meet():
            cd = a.locator('.sheet .big').inner_text().strip(); T(k, '[data-act=make]'); T(k, '[data-act=mk][data-v=meet]'); k.fill('#pair-in', cd); k.press('#pair-in', 'Enter'); k.wait_for_timeout(900)
        A('meet join', do_meet); a.keyboard.press('Escape'); k.keyboard.press('Escape')
        A('feed post', lambda: (T(a, '[data-act="tab"][data-v="city"]'), T(a, '[data-act=sseg][data-v=feed]'), T(a, '[data-act=pkind][data-v=Made]'), a.fill('#p-text', 'Built a kite that actually flew at Marina'), T(a, 'form[data-form=post] button[type=submit]'), a.wait_for_timeout(600), shoot(a, '69-feed-posted')))
        A('calls', lambda: (T(a, '[data-act=sseg][data-v=calls]'), a.wait_for_timeout(300), shoot(a, '70-calls')))
        A('league', lambda: (T(a, '[data-act=sseg][data-v=league]'), a.wait_for_timeout(300), shoot(a, '71-league')))
        A('map', lambda: (T(a, '[data-act=sseg][data-v=map]'), a.wait_for_timeout(1200), shoot(a, '72-city-map'), shoot(a, '72b-city-map-full', False, full=True), note('city map', text(a)[:500].replace('\n', ' | '))))
        A('host drop', lambda: (T(a, '[data-act=sheet][data-v=host]'), a.wait_for_timeout(500), shoot(a, '73-host-drop', True, full=True), note('host sheet', a.locator('.sheet').inner_text()[:700].replace('\n', ' | '))))
        a.keyboard.press('Escape')
        A('propose mission', lambda: (T(a, '[data-act=sheet][data-v=propose]'), a.wait_for_timeout(500), shoot(a, '74-mission-form', False, full=True)))
        a.keyboard.press('Escape')
        A('trail', lambda: (T(a, '[data-act=sheet][data-v=trail-new]'), a.wait_for_timeout(500), shoot(a, '75-trail-form', False, full=True)))
        a.keyboard.press('Escape')
        # profile edit place picker
        A('profile', lambda: (T(a, '[data-act="tab"][data-v="you"]'), T(a, '[data-act=sheet][data-v=profile]'), a.wait_for_timeout(800), shoot(a, '76-profile-place', True, full=True)))
        a.keyboard.press('Escape')
        # toast overlap check: copy invite
        A('toast', lambda: (T(a, '[data-act="tab"][data-v="circle"]'), T(a, '[data-act=copy]', 2500), a.wait_for_timeout(200), shoot(a, '77-toast-overlap', False)))
        # go dark
        A('dark', lambda: (T(a, '[data-act="tab"][data-v="you"]'), T(a, '[data-act=dark-setup]'), a.wait_for_timeout(300), shoot(a, '78-dark-setup', False, full=True), T(a, '[data-act=darkH][data-v="1"]'), T(a, '[data-act=dark-go]'), a.wait_for_timeout(500), shoot(a, '79-dark-on')))
        # day 14 time travel
        clock(14 * 864e5); a.reload(); a.wait_for_timeout(2500); shoot(a, '80-day14-home'); note('day14 home', text(a)[:500].replace('\n', ' | '))
        # back button
        A('back', lambda: (T(a, '[data-act="tab"][data-v="ledger"]'), a.go_back(), a.wait_for_timeout(800), note('after back url', a.url, 'tab', a.evaluate('() => S.ui.tab') if 'localhost' in a.url else 'left app')))
        # two tabs
        a2 = c2.new_page(); a2.goto(B); a2.wait_for_timeout(2500); note('second tab ok', 'nav' in a2.content()[:200000])
        # export / delete (Ravi)
        A('export', lambda: (T(r, '[data-act="tab"][data-v="you"]'), r.wait_for_timeout(300), shoot(r, '81-desktop-you', False, full=True)))
        A('delete', lambda: (T(r, '[data-act=del-ask]'), r.wait_for_timeout(300), shoot(r, '82-delete-confirm', False), T(r, '[data-act=del-yes]'), r.wait_for_timeout(1200), shoot(r, '83-after-delete', False)))
        note('after delete', text(r)[:200].replace('\n', ' | '))
        clock(0)
        # slow network (CDP throttle) cold load for a new user on 3G
        c5 = ctx_for(pw, br, 'Pixel 7', name='slow3g'); s = c5.new_page(); cdp = c5.new_cdp_session(s)
        cdp.send('Network.enable'); cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 300, 'downloadThroughput': 400 * 1024 / 8 * 8, 'uploadThroughput': 100 * 1024})
        t0 = time.time(); s.goto(B, wait_until='domcontentloaded', timeout=60000); s.wait_for_selector('#si-email', timeout=60000); note('slow 3G (400KB/s) time to email box s', round(time.time() - t0, 1))
        sign_in(s, 'slow@x.com'); s.fill('#ob-name', 'Slow'); T(s, '#ob-age'); t0 = time.time(); T(s, '[data-act=ob-next]'); s.wait_for_selector('#lp-q-home', timeout=60000)
        s.fill('#lp-q-home', 'Chennai'); 
        try: s.wait_for_selector('.res', timeout=60000); note('slow 3G place search results s', round(time.time() - t0, 1))
        except Exception as e: note('slow search fail', e)
        br.close()
    note('PAGE ERRORS', errs)
    for kk in NET: NET[kk]['blocked'] = sorted(NET[kk]['blocked'])
    json.dump({'log': LOG, 'audit': AUDIT, 'net': NET, 'errors': errs}, open(OUT + '/../live.json', 'w'), indent=1, default=str)

if __name__ == '__main__':
    try: run()
    except Exception:
        traceback.print_exc()
        json.dump({'log': LOG, 'audit': AUDIT, 'net': {k: {**v, 'blocked': sorted(v['blocked'])} for k, v in NET.items()}}, open(OUT + '/../live.json', 'w'), indent=1, default=str)
