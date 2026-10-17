"""Build INSANE's offline map + place data from GeoNames and Natural Earth.

Inputs (downloaded into RAW): cities5000.txt, countryInfo.txt, admin1CodesASCII.txt and
Natural Earth GeoJSON layers. Outputs into app/data/:
  places.tsv       every place of 5,000+ people (and seats of government), worldwide
  world.json       low-detail land, lakes and borders for zoomed-out views
  t/<x>_<y>.json   15-degree tiles: detailed land, lakes, borders, regions, roads, urban areas, rivers
Coordinates are quantised to 1e-4 degrees (about 11 m) and delta-encoded.
"""
import json, os, sys, math
RAW = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(os.path.join(OUT, 't'), exist_ok=True)
T = 15  # tile size in degrees

def load(n):
    with open(os.path.join(RAW, n + '.geojson'), encoding='utf-8') as f:
        return json.load(f)['features']

# ---------- places ----------
cc_name = {}
for line in open(os.path.join(RAW, 'countryInfo.txt'), encoding='utf-8'):
    if line.startswith('#'): continue
    p = line.rstrip('\n').split('\t')
    if len(p) > 4: cc_name[p[0]] = p[4]
adm = {}
for line in open(os.path.join(RAW, 'admin1CodesASCII.txt'), encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    adm[p[0]] = p[1]
rows = []
for line in open(os.path.join(RAW, 'cities5000.txt'), encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    name, lat, lon, fcode, cc, a1, pop = p[1], float(p[4]), float(p[5]), p[7], p[8], p[10], int(p[14] or 0)
    rows.append((name.replace('\t', ' '), round(lat, 3), round(lon, 3), cc, adm.get(cc + '.' + a1, ''), pop))
rows.sort(key=lambda r: -r[5])
admins = sorted({r[4] for r in rows if r[4]})
aidx = {a: i for i, a in enumerate(admins)}
with open(os.path.join(OUT, 'places.tsv'), 'w', encoding='utf-8') as f:
    f.write('#' + '|'.join(f'{k}={v}' for k, v in sorted(cc_name.items())) + '\n')
    f.write('#' + '|'.join(admins) + '\n')
    for r in rows:
        f.write(f"{r[0]}\t{r[1]:g}\t{r[2]:g}\t{r[3]}\t{aidx[r[4]] if r[4] else ''}\t{r[5]}\n")
print('places', len(rows), os.path.getsize(os.path.join(OUT, 'places.tsv')))

# ---------- geometry helpers ----------
def dp(pts, tol):
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    t2 = tol * tol
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0: d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > best: best, bi = d, i
        if best > t2:
            keep[bi] = True; stack.append((a, bi)); stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]

def clip_ring(ring, x0, y0, x1, y1):
    def clip(pts, inside, inter):
        out = []
        if not pts: return out
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev): out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev): out.append(inter(prev, cur))
            prev = cur
        return out
    def ix(x):
        return lambda p, q: (x, p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]))
    def iy(y):
        return lambda p, q: (p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]), y)
    r = ring
    r = clip(r, lambda p: p[0] >= x0, ix(x0))
    r = clip(r, lambda p: p[0] <= x1, ix(x1))
    r = clip(r, lambda p: p[1] >= y0, iy(y0))
    r = clip(r, lambda p: p[1] <= y1, iy(y1))
    return r

def enc(pts, q=1e4):
    out = []; px = py = 0
    for x, y in pts:
        X, Y = round(x * q), round(y * q)
        if out and X == px and Y == py: continue
        out += [X - px, Y - py]; px, py = X, Y
    return out

def bbox(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)

def rings_of(geom):
    if not geom: return []
    if geom['type'] == 'Polygon': return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon': return geom['coordinates']
    return []
def lines_of(geom):
    if not geom: return []
    if geom['type'] == 'LineString': return [geom['coordinates']]
    if geom['type'] == 'MultiLineString': return geom['coordinates']
    return []

tiles = {}
def tile_keys(b):
    for tx in range(int((b[0] + 180) // T), int((min(b[2], 179.999) + 180) // T) + 1):
        for ty in range(int((b[1] + 90) // T), int((min(b[3], 89.999) + 90) // T) + 1):
            yield tx, ty
def put(k, layer, item):
    tiles.setdefault(k, {}).setdefault(layer, []).append(item)

def add_polys(feats, layer, tol, minarea=0.0):
    n = 0
    for f in feats:
        for poly in rings_of(f['geometry']):
            rings = [dp([tuple(p[:2]) for p in r], tol) for r in poly]
            rings = [r for r in rings if len(r) >= 4]
            if not rings: continue
            b = bbox(rings[0])
            if (b[2] - b[0]) * (b[3] - b[1]) < minarea: continue
            for k in tile_keys(b):
                x0, y0 = k[0] * T - 180, k[1] * T - 90
                cl = []
                for r in rings:
                    c = clip_ring(r, x0, y0, x0 + T, y0 + T)
                    if len(c) >= 3: cl.append(enc(c))
                if cl: put(k, layer, cl); n += 1
    print(layer, n)

def add_lines(feats, layer, tol, cls=None):
    n = 0
    for f in feats:
        c = cls(f['properties']) if cls else 0
        if c is None: continue
        for ln in lines_of(f['geometry']):
            pts = dp([tuple(p[:2]) for p in ln], tol)
            if len(pts) < 2: continue
            b = bbox(pts)
            for k in tile_keys(b):
                put(k, layer, [c, enc(pts)]); n += 1
    print(layer, n)

def road_cls(p):
    t = (p.get('type') or '').lower()
    if 'ferry' in t: return None
    if 'major' in t or p.get('expressway') == 1: return 0
    if 'secondary' in t: return 1
    return 2

add_polys(load('ne_10m_land'), 'land', 0.002)
add_polys(load('ne_10m_lakes'), 'lake', 0.002)
add_polys(load('ne_10m_urban_areas'), 'urban', 0.001)
add_lines(load('ne_10m_admin_0_boundary_lines_land'), 'b0', 0.002)
add_lines(load('ne_10m_admin_1_states_provinces_lines'), 'b1', 0.003)
add_lines(load('ne_10m_roads'), 'road', 0.0008, road_cls)
add_lines(load('ne_10m_rivers_lake_centerlines'), 'river', 0.002, lambda p: 0 if (p.get('scalerank') or 9) <= 5 else 1)

total = 0
for (tx, ty), layers in tiles.items():
    fn = os.path.join(OUT, 't', f'{tx}_{ty}.json')
    with open(fn, 'w') as f: json.dump(layers, f, separators=(',', ':'))
    total += os.path.getsize(fn)
print('tiles', len(tiles), total)

# ---------- world ----------
world = {}
def wpolys(feats, tol):
    out = []
    for f in feats:
        for poly in rings_of(f['geometry']):
            rs = [enc(dp([tuple(p[:2]) for p in r], tol), 100) for r in poly]
            rs = [r for r in rs if len(r) >= 6]
            if rs: out.append(rs)
    return out
world['land'] = wpolys(load('ne_50m_land'), 0.04)
world['lake'] = wpolys(load('ne_50m_lakes'), 0.04)
world['b0'] = [enc(dp([tuple(p[:2]) for p in ln], 0.04), 100) for f in load('ne_50m_admin_0_boundary_lines_land') for ln in lines_of(f['geometry'])]
with open(os.path.join(OUT, 'world.json'), 'w') as f: json.dump(world, f, separators=(',', ':'))
print('world', os.path.getsize(os.path.join(OUT, 'world.json')))
