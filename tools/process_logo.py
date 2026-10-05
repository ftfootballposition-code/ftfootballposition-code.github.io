"""
Logo FT: rimozione dello sfondo bianco + varianti per il sito.

Input:  tools/logo-source.jpg (logo originale su bianco)
Output in ../img/:
  logo.png             logo completo, colori originali (per sfondi chiari)
  logo-light.png       logo completo con nero -> panna (per sfondi scuri)
  logo-mark.png        solo monogramma FT + atleta (sfondi chiari)
  logo-mark-light.png  monogramma per sfondi scuri
  logo-lockup-light.png          orizzontale: monogramma + scritte + tagline (nav desktop)
  logo-lockup-compact-light.png  orizzontale senza tagline (nav tablet/mobile)
  favicon-32.png, favicon-180.png (apple-touch-icon), favicon-512.png
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "logo-source.jpg")
OUT = os.path.normpath(os.path.join(HERE, "..", "img"))

CREAM = np.array([244, 241, 234], np.float32)
BG = (10, 10, 10)

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.float32)
H, W = a.shape[:2]

# ---- 1. regioni bianche: esterno (collegato ai bordi) vs. zone chiuse --------
def label(mask):
    """Etichetta le componenti connesse (4-vicini) di una maschera booleana."""
    lab_ = np.zeros(mask.shape, np.int32)
    run_id = np.zeros(mask.shape, np.int32)
    # union-find su "run" orizzontali: veloce anche in Python puro
    parent = [0]

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    prev_runs = []
    for y in range(mask.shape[0]):
        row = mask[y]
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
        cur = []
        j = 0
        for s0, e0 in zip(starts, ends):
            parent.append(len(parent))
            rid = len(parent) - 1
            while j < len(prev_runs) and prev_runs[j][1] <= s0:
                j += 1
            k = j
            while k < len(prev_runs) and prev_runs[k][0] < e0:
                a_, b_ = find(rid), find(prev_runs[k][2])
                if a_ != b_:
                    parent[max(a_, b_)] = min(a_, b_)
                k += 1
            run_id[y, s0:e0] = rid
            cur.append((s0, e0, rid))
        prev_runs = cur
    roots = np.array([find(i) for i in range(len(parent))], np.int32)
    lab_ = roots[run_id] * mask
    return lab_


white = a.min(-1) > 232
lab = label(white)
border_ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}

# pallone: il cerchio con contorno nero (centro/raggio misurati sull'originale)
BALL_C, BALL_R = (851.0, 645.0), 50.0
yy, xx = np.mgrid[0:H, 0:W]
in_ball = (xx - BALL_C[0]) ** 2 + (yy - BALL_C[1]) ** 2 <= BALL_R ** 2

keep_white = np.zeros((H, W), bool)
for cid in set(np.unique(lab)) - {0} - border_ids:
    comp = lab == cid
    cy, cx = np.argwhere(comp).mean(0)
    if in_ball[int(cy), int(cx)]:
        keep_white |= comp  # spicchi bianchi del pallone: restano opachi

# ---- 2. trasparenza: solo sfondo e bordi, l'interno del logo resta opaco -----
# (un "color to alpha" su tutto il logo renderebbe l'oro semitrasparente e,
#  su fondo nero, più scuro e aranciato)
protect = Image.fromarray((keep_white * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
protect = np.asarray(protect) > 0
bg = white & ~protect
ring = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
soft = (ring | (a.min(-1) > 190)) & ~bg & ~protect

c2a = (255 - a).max(-1) / 255.0
c2a = np.clip((c2a - 0.025) / (1 - 0.025), 0, 1)
alpha = np.where(bg, 0.0, np.where(soft, c2a, 1.0))

safe = np.maximum(alpha, 1e-4)[..., None]
unmult = np.clip(255 - (255 - a) / safe, 0, 255)
rgb = np.where(soft[..., None], unmult, a)

# ---- 2b. oro del logo = oro del sito (#D9AE4F) --------------------------------
BRAND_GOLD = np.array([0xD9, 0xAE, 0x4F], np.float32)
HILITE = np.array([255, 241, 206], np.float32)
L_REF = 127.0  # luminanza media dell'oro piatto di "FOOTBALL POSITION" nell'originale
ch_ = rgb.max(-1) - rgb.min(-1)
Lp = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
w_gold = np.clip((ch_ - 22) / 30, 0, 1) * ~protect
k = (Lp / L_REF)[..., None]
dark_side = BRAND_GOLD * np.clip(k, 0, 1)
t = np.clip((Lp - L_REF) / (255 - L_REF), 0, 1)[..., None]
light_side = BRAND_GOLD + (HILITE - BRAND_GOLD) * t * 0.75
gold_rgb = np.where(k <= 1, dark_side, light_side)
rgb = rgb * (1 - w_gold[..., None]) + gold_rgb * w_gold[..., None]


def crop_box(alpha_, pad=12, y0=0, y1=None):
    m = alpha_[y0:y1] > 0.04
    ys, xs = np.where(m)
    return (max(0, xs.min() - pad), max(0, ys.min() + y0 - pad),
            min(W, xs.max() + pad + 1), min(H, ys.max() + y0 + pad + 1))


def to_img(rgb_, alpha_, box):
    x0, y0, x1, y1 = box
    out = np.dstack([rgb_, alpha_[..., None] * 255])[y0:y1, x0:x1]
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGBA")


# ---- 3. variante chiara: il nero diventa panna, l'oro resta oro ---------------
mx, mn = rgb.max(-1), rgb.min(-1)
chroma = mx - mn
gold = (chroma > 40) & (alpha > 0.3)
near_gold = np.asarray(Image.fromarray((gold * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
neutral_w = np.clip(1 - (chroma - 18) / 30, 0, 1)
# solo le lettere: componenti scure grandi (F, T) o sotto il monogramma (scritte)
lum0 = rgb @ np.array([0.299, 0.587, 0.114], np.float32) / 255
dark = (alpha > 0.35) & (chroma < 30) & (lum0 < 0.5)
dlab = label(dark)
ids, counts = np.unique(dlab, return_counts=True)
letters = np.zeros((H, W), bool)
ys_min = {}
for cid, cnt in zip(ids, counts):
    if cid == 0:
        continue
    comp = dlab == cid
    if cnt > 15000 or np.argwhere(comp)[:, 0].min() > 735:
        letters |= comp
letters = np.asarray(Image.fromarray((letters * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
recolor = neutral_w * letters * (~near_gold) * (~in_ball)
lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32)) / 255
light_rgb = rgb * (1 - recolor[..., None]) + (CREAM * (0.92 + 0.08 * lum[..., None])) * recolor[..., None]

full_box = crop_box(alpha)
MARK_Y1 = 735  # fine del monogramma, sopra "F.T ATHLETIC"
mark_box = crop_box(alpha, y1=MARK_Y1)

os.makedirs(OUT, exist_ok=True)
variants = {
    "logo.png": (rgb, full_box),
    "logo-light.png": (light_rgb, full_box),
    "logo-mark.png": (rgb, mark_box),
    "logo-mark-light.png": (light_rgb, mark_box),
}
for name, (c, box) in variants.items():
    img = to_img(c, alpha, box)
    img.save(os.path.join(OUT, name), optimize=True)
    print(name, img.size)

# ---- 4. versioni orizzontali per la navbar ------------------------------------
TEXT_Y0, NAME_Y1, TAG_Y1 = 738, 892, 962  # righe: F.T ATHLETIC / FOOTBALL POSITION / tagline


def lockup(y1, name, text_ratio):
    mark_ = to_img(light_rgb, alpha, mark_box)
    text_ = to_img(light_rgb, alpha, crop_box(alpha, pad=4, y0=TEXT_Y0, y1=y1))
    Hm = 300  # altezza di lavoro (3x rispetto alla nav)
    m = mark_.resize((round(mark_.width * Hm / mark_.height), Hm), Image.LANCZOS)
    th = round(Hm * text_ratio)
    t = text_.resize((round(text_.width * th / text_.height), th), Image.LANCZOS)
    gap = round(Hm * 0.1)
    out = Image.new("RGBA", (m.width + gap + t.width, Hm), (0, 0, 0, 0))
    out.alpha_composite(m, (0, 0))
    # testo centrato sulle lettere F/T (non sulla testa dell'atleta)
    cy = round(Hm * 0.6)
    out.alpha_composite(t, (m.width + gap, max(0, min(Hm - th, cy - th // 2))))
    out.save(os.path.join(OUT, name), optimize=True)
    print(name, out.size)


lockup(TAG_Y1, "logo-lockup-light.png", 0.74)
lockup(NAME_Y1, "logo-lockup-compact-light.png", 0.6)

# ---- 5. favicon: monogramma chiaro su quadrato nero ---------------------------
mark = to_img(light_rgb, alpha, mark_box)
for size in (32, 180, 512):
    canvas = Image.new("RGBA", (size, size), BG + (255,))
    pad = int(size * 0.1)
    m = mark.copy()
    m.thumbnail((size - 2 * pad, size - 2 * pad), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    canvas.convert("RGB").save(os.path.join(OUT, f"favicon-{size}.png"), optimize=True)
    print(f"favicon-{size}.png")
