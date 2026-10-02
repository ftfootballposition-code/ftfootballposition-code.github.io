"""
F.T Athletic Football Position — immagini procedurali (nessuna AI, nessun asset esterno).

Genera in ../img/:
  hero.jpg      campo di notte con i riflettori (2400x1500)
  field.jpg     coni per agility sull'erba, profondità di campo (1200x1600)
  gym.jpg       disco bumper + bilanciere, luce dura dall'alto (1200x1600)
  complete.jpg  vista dall'alto con tracce GPS (1200x1600)
  tunnel.jpg    tunnel verso il campo (1200x1500)

Uso:  python3 tools/render_images.py [nome ...]
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "img"))
os.makedirs(OUT, exist_ok=True)

F_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
F_MONO = "/System/Library/Fonts/Menlo.ttc"

GOLD = np.array([0.79, 0.66, 0.43], np.float32)


# ---------------------------------------------------------------- utils
def rng(seed):
    return np.random.default_rng(seed)


def box1d(a, r, axis):
    r = int(r)
    if r < 1:
        return a
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    p = np.pad(a, pad, mode="edge")
    c = np.cumsum(p, axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def blur(a, sigma, axes=(0, 1)):
    """Gaussiana approssimata con 3 passate di box blur."""
    if sigma < 0.5:
        return a
    w = math.sqrt(12 * sigma * sigma / 3 + 1)
    r = max(1, int((w - 1) / 2))
    for _ in range(3):
        for ax in axes:
            a = box1d(a, r, ax)
    return a


def noise(h, w, cell, seed, cell_y=None):
    cy = cell_y or cell
    g = rng(seed).random((h // cy + 3, w // cell + 3)).astype(np.float32)
    im = Image.fromarray(g).resize(((w // cell + 3) * cell, (h // cy + 3) * cy), Image.BICUBIC)
    return np.asarray(im, np.float32)[cy:cy + h, cell:cell + w] - 0.5


def fbm(h, w, cells, seed):
    out = np.zeros((h, w), np.float32)
    amp = 1.0
    for i, c in enumerate(cells):
        out += noise(h, w, c, seed + i * 17) * amp
        amp *= 0.55
    return out


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def stamp(buf, x, y, sigma, amp):
    """Aggiunge un punto gaussiano (luce) al buffer."""
    h, w = buf.shape[:2]
    r = int(sigma * 3.5) + 2
    x0, x1 = max(0, int(x) - r), min(w, int(x) + r + 1)
    y0, y1 = max(0, int(y) - r), min(h, int(y) + r + 1)
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32) + 0.5
    g = np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * sigma * sigma)) * amp
    if buf.ndim == 3:
        buf[y0:y1, x0:x1] += g[..., None]
    else:
        buf[y0:y1, x0:x1] += g


def coverage(d, fp, w):
    """Copertura esatta (box filter) di una linea larga w a distanza d, footprint fp."""
    fp = np.maximum(fp, 1e-5)
    ov = np.minimum(d + fp / 2, w / 2) - np.maximum(d - fp / 2, -w / 2)
    return np.clip(ov, 0, None) / fp


def tonemap(E, k=2.2):
    return 1 - np.exp(-np.maximum(E, 0) * k)


def grade(L, warmth=1.0):
    """Monocromatico con alte luci dorate (palette FT)."""
    L = np.clip(L, 0, 1.5)
    s = smoothstep(0.2, 0.9, L)[..., None] * warmth
    cool = np.array([0.93, 0.94, 0.95], np.float32)
    warm = np.array([1.0, 0.83, 0.56], np.float32)
    rgb = L[..., None] * (cool * (1 - s) + warm * s)
    hl = smoothstep(0.82, 1.25, L)[..., None]
    rgb = rgb + (np.array([1.0, 0.95, 0.86], np.float32) - rgb) * hl * 0.7
    return rgb


def finish(rgb, seed, vignette=0.4, grain=0.022, center=(0.5, 0.45)):
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    vx = (xx / w - center[0]) / 0.75
    vy = (yy / h - center[1]) / 0.95
    v = np.clip(1 - vignette * (vx * vx + vy * vy), 0, 1)
    rgb = rgb * v[..., None]
    g = rng(seed).normal(0, grain, (h, w)).astype(np.float32)
    g = g * 0.7 + blur(g, 0.8) * 0.6  # grana un po' morbida, come pellicola
    rgb = rgb + g[..., None] * (0.4 + 0.6 * (1 - np.clip(rgb.mean(-1, keepdims=True), 0, 1)))
    rgb = np.clip(rgb, 0, 1)
    return (rgb * 255 + 0.5).astype(np.uint8)


def save(arr, name):
    path = os.path.join(OUT, name)
    Image.fromarray(arr).save(path, quality=84, optimize=True, progressive=True)
    print("  ->", os.path.relpath(path), f"{os.path.getsize(path) // 1024} KB")


# ---------------------------------------------------------------- HERO
def hero():
    H, W = 1500, 2400
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    f, cx, yh, hc, camX = W * 0.56, W * 0.5, H * 0.43, 1.7, -9.0

    dy = np.maximum(yy - yh, 0.35)
    z = hc * f / dy
    X = camX + (xx - cx) * z / f
    s = z - 5.0  # linea di porta a 5 m dalla camera
    pw = z / f
    dzdy = z * z / (hc * f)
    ground = yy > yh

    lw = 0.12
    lines = np.zeros((H, W), np.float32)

    def seg_x(c, s0, s1):
        return coverage(np.abs(X - c), pw, lw) * ((s >= s0) & (s <= s1))

    def seg_s(c, x0, x1):
        return coverage(np.abs(s - c), dzdy, lw) * ((X >= x0) & (X <= x1))

    def circ(c0x, c0s, R, cond):
        dx, ds = X - c0x, s - c0s
        r = np.sqrt(dx * dx + ds * ds) + 1e-6
        fp = np.sqrt((dx / r * pw) ** 2 + (ds / r * dzdy) ** 2)
        return coverage(np.abs(r - R), fp, lw) * cond

    for L in [
        seg_s(0, -34, 34), seg_s(52.5, -34, 34), seg_s(105, -34, 34),
        seg_x(-34, 0, 105), seg_x(34, 0, 105),
        seg_x(-20.16, 0, 16.5), seg_x(20.16, 0, 16.5), seg_s(16.5, -20.16, 20.16),
        seg_x(-9.16, 0, 5.5), seg_x(9.16, 0, 5.5), seg_s(5.5, -9.16, 9.16),
        seg_x(-20.16, 88.5, 105), seg_x(20.16, 88.5, 105), seg_s(88.5, -20.16, 20.16),
        circ(0, 11, 9.15, s > 16.5), circ(0, 52.5, 9.15, np.ones_like(s, bool)),
        circ(0, 94, 9.15, s < 88.5),
        coverage(np.sqrt(X ** 2 + (s - 11) ** 2), pw, 0.22),
        coverage(np.sqrt(X ** 2 + (s - 52.5) ** 2), pw, 0.22),
    ]:
        lines = np.maximum(lines, L)
    lines *= ground & (s > -0.2)

    # erba: strisce di taglio + texture
    val = np.sin(np.pi * s / 5.25)
    aa = np.pi * dzdy / 5.25
    st = np.clip(0.5 + 0.5 * val / np.maximum(aa, 0.08), 0, 1)
    alb = 0.15 * (1 + 0.32 * (st - 0.5))
    near = np.clip(1 - z / 28, 0, 1)
    alb *= 1 + noise(H, W, 2, 1, 5) * 0.55 * near + noise(H, W, 14, 2) * 0.18 + noise(H, W, 160, 3) * 0.3
    alb = alb * (1 - lines) + 0.72 * lines

    # illuminazione: pozze dei riflettori + riflesso controluce verso il fondo
    pools = np.zeros((H, W), np.float32)
    for lx, ls in [(-38, -12), (38, -12), (-38, 117), (38, 117), (-44, 52), (44, 52)]:
        d2 = (X - lx) ** 2 + (s - ls) ** 2 + 38 ** 2
        pools += 38 / d2 ** 1.5 * 1800
    pools = pools / (pools + 1.2)
    G = alb * (0.35 + 0.95 * pools)

    lamp = np.zeros((H, W), np.float32)
    far_z = 122.0
    heads = []
    for lx in (-40, 40):
        zt = 117 + 5.0
        sx = cx + (lx - camX) * f / zt
        sy_top = yh - (42 - hc) * f / zt
        heads.append((sx, sy_top, zt))
        sheen = np.exp(-((xx - sx) / (W * 0.11)) ** 2) * smoothstep(12, 90, z)
        G += sheen * 0.10 * (1 + 0.5 * np.clip(noise(H, W, 30, 9) * 2, -1, 1))

    fog = 1 - np.exp(-z / 170)
    G = G * (1 - fog) + 0.11 * fog
    img = np.where(ground, G, 0)

    # tribune (pareti laterali e di fondo)
    zs = np.full((W,), np.inf, np.float32)
    col = xx[0]
    for wx in (-50.0, 50.0):
        with np.errstate(divide="ignore", invalid="ignore"):
            zc = (wx - camX) * f / (col - cx)
        zc = np.where(zc > 0, zc, np.inf)
        zs = np.minimum(zs, zc)
    zw = np.minimum(zs, far_z)[None, :]
    is_side = (zs < far_z)[None, :]
    Hw = np.where(is_side, 24.0, 17.0)
    top = yh - (Hw - hc) * f / zw
    bot = yh + hc * f / zw
    wall = (yy >= top) & (yy <= bot)
    wall &= ~(ground & (z < zw))
    hgt = hc + (yh - yy) * zw / f
    rows = 0.5 + 0.5 * np.sin(hgt / 0.8 * 2 * np.pi)
    rows_aa = np.clip(0.8 * f / zw / 3, 0, 1)
    rows = rows * rows_aa + 0.5 * (1 - rows_aa)
    specks = (rng(4).random((H, W)) > 0.9965).astype(np.float32) * smoothstep(1, 18, hgt)
    stand = 0.028 + 0.02 * rows + specks * 0.16
    stand *= 0.6 + 0.8 * smoothstep(Hw, 0, hgt)
    img = np.where(wall, stand, img)

    # cielo con foschia
    sky = (yy < top) & ~ground
    skyv = 0.012 + 0.05 * np.exp(-(yh - yy) / (H * 0.2))
    img = np.where(sky, skyv, img)

    # riflettori: lampade sul bordo del tetto laterale + torri d'angolo
    for side in (-50.0, 50.0):
        for sl in np.arange(-4, 112, 6.5):
            zl = sl + 5
            if zl < 3:
                continue
            sx = cx + (side * 0.98 - camX) * f / zl
            sy = yh - (24 - hc) * f / zl
            if -200 < sx < W + 200:
                stamp(lamp, sx, sy, max(1.2, 0.5 * f / zl * 0.12), 9.0)
    for sx, sy, zt in heads:
        # palo
        pole = coverage(np.abs(xx - sx), 1.0, max(1.2, 0.6 * f / zt)) * (yy > sy) * (yy < yh + hc * f / zt)
        img = np.maximum(img, pole * 0.07)
        for i in range(5):
            for j in range(3):
                stamp(lamp, sx + (i - 2) * 1.1 * f / zt, sy + (j - 1) * 1.1 * f / zt, 0.35 * f / zt + 1, 14.0)

    bloom = (blur(lamp, 2) * 0.9 + blur(lamp, 10) * 0.6 + blur(lamp, 40) * 0.45 + blur(lamp, 140) * 0.55)
    streak = blur(lamp, 60, axes=(1,)) * 0.25
    beams = blur(blur(lamp, 18), 220, axes=(0,)) * 0.5 * (yy > np.min([h[1] for h in heads]))
    E = img + lamp + bloom + streak + beams
    L = tonemap(E, 2.35)
    rgb = grade(L, 1.0)
    save(finish(rgb, 11, vignette=0.55, center=(0.55, 0.4)), "hero.jpg")


# ---------------------------------------------------------------- FIELD
def field():
    H, W = 1600, 1200
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    f, cx, yh, hc, camX = W * 1.05, W * 0.5, H * 0.46, 0.3, 0.05
    dy = np.maximum(yy - yh, 0.3)
    z = hc * f / dy
    X = camX + (xx - cx) * z / f
    pw = z / f
    ground = yy > yh

    # erba ravvicinata: fili allungati in verticale
    blades = noise(H, W, 3, 21, 14) * 0.9 + noise(H, W, 2, 22, 6) * 0.6
    near = np.clip(1 - z / 9, 0, 1)
    alb = 0.17 * (1 + 0.28 * np.sign(np.sin(X / 2.6 * np.pi)) * smoothstep(0.5, 3, z))
    alb *= 1 + blades * 0.7 * near + noise(H, W, 40, 23) * 0.25
    line = coverage(np.abs(X + 0.62), pw, 0.1) * (z > 0.5)
    alb = alb * (1 - line) + 0.8 * line * (1 + blades * 0.15)

    cones = [(0.3, 0.95), (-0.26, 1.5), (0.34, 2.2), (-0.22, 3.1), (0.36, 4.2), (-0.2, 5.6), (0.38, 7.4), (-0.18, 9.8)]
    sun = np.array([0.55, 1.0])  # sole alle spalle dei coni, a destra
    sdir = -sun / np.linalg.norm(sun)
    for (px, pz) in cones:
        dx, dz = X - px, z - pz
        t = np.clip(dx * sdir[0] + dz * sdir[1], 0, 0.75)
        ex, ez = dx - t * sdir[0], dz - t * sdir[1]
        width = 0.1 * (1 - t / 0.85) + 0.012
        sh = smoothstep(width + 0.03, width - 0.02, np.sqrt(ex * ex + ez * ez))
        alb *= 1 - 0.55 * sh

    # controluce: l'erba brilla verso l'orizzonte
    rim = smoothstep(1.5, 25, z) * (0.6 + 0.4 * np.exp(-((xx - W * 0.72) / (W * 0.35)) ** 2))
    G = alb * (0.8 + 0.4 * near) + rim * 0.2
    fog = 1 - np.exp(-z / 30)
    G = G * (1 - fog) + 0.5 * fog

    # sfondo: cielo luminoso, sagome e bokeh
    skyv = 0.62 + 0.3 * np.exp(-(yh - yy) / (H * 0.06)) - 0.35 * smoothstep(yh, 0, yy)
    sil = (yy > yh - H * 0.05 * (1 + 0.6 * noise(1, W, 60, 30)[0][None, :] + 0.3 * noise(1, W, 12, 31)[0][None, :]))
    skyv = np.where(sil & (yy < yh + 2), 0.32, skyv)
    img = np.where(ground, G, skyv)

    # profondità di campo sul fondo
    zf, K = 1.5, f * 0.02
    sig = np.where(ground, K * np.abs(1 / z - 1 / zf), K / zf)
    levels = [0, 2, 4, 7, 11, 16, 22]
    stack = [img] + [blur(img, s) for s in levels[1:]]
    sig = np.clip(sig, 0, levels[-1])
    # interpolazione lineare tra i livelli dello stack
    out = np.zeros_like(img)
    idx = np.searchsorted(levels, sig, side="right") - 1
    idx = np.clip(idx, 0, len(levels) - 2)
    lv = np.array(levels, np.float32)
    t = (sig - lv[idx]) / (lv[idx + 1] - lv[idx])
    for i in range(len(levels) - 1):
        m = idx == i
        out[m] = stack[i][m] * (1 - t[m]) + stack[i + 1][m] * t[m]

    bok = np.zeros((H, W), np.float32)
    r = rng(33)
    for _ in range(38):
        bx, by = r.uniform(0, W), yh - r.uniform(-10, H * 0.1)
        rad = r.uniform(10, 34)
        d = np.sqrt((xx - bx) ** 2 + (yy - by) ** 2)
        bok += smoothstep(rad + 1.5, rad - 1.5, d) * r.uniform(0.05, 0.22) * (1 + 0.4 * smoothstep(rad * 0.5, rad, d))
    out = out + bok * (yy < yh + 60)

    rgb = grade(tonemap(out * 1.15, 1.9) * 1.05, 0.85)

    # coni (dal più lontano al più vicino), colore oro FT
    cone_col = np.array([0.88, 0.66, 0.34], np.float32)
    for (px, pz) in sorted(cones, key=lambda c: -c[1]):
        sx = cx + (px - camX) * f / pz
        by = yh + hc * f / pz
        hgt, R, Rt = 0.23, 0.095, 0.016
        ty = yh + (hc - hgt) * f / pz
        # ellisse della base vista dall'alto per effetto della camera bassa
        er = R * f / pz
        ev = er * hc / pz * 0.9
        t = np.clip((yy - ty) / (by - ty), 0, 1)
        half = (Rt + (R - Rt) * t) * f / pz
        u = (xx - sx) / np.maximum(half, 1e-3)
        body = (yy >= ty) & (yy <= by) & (np.abs(u) <= 1)
        base = ((xx - sx) / (er * 1.12)) ** 2 + ((yy - by) / max(ev, 1)) ** 2 <= 1
        a = (body | base).astype(np.float32)
        a = blur(a, 0.6)
        shade = 0.42 + 1.05 * smoothstep(0.35, 1.0, u) + 0.2 * np.exp(-((u + 0.2) / 0.25) ** 2)
        shade *= 0.85 + 0.15 * (1 - t)
        band = (np.abs(t - 0.55) < 0.07) & body
        c = cone_col[None, None, :] * shade[..., None]
        c = np.where(band[..., None], np.array([0.93, 0.92, 0.88])[None, None, :] * shade[..., None] * 0.9, c)
        s = K * abs(1 / pz - 1 / zf)
        if s > 0.6:
            c = blur(c * a[..., None], s) / np.maximum(blur(a, s), 1e-4)[..., None]
            a = blur(a, s)
        rgb = rgb * (1 - a[..., None]) + np.clip(c, 0, 1.4) * a[..., None]

    save(finish(rgb, 12, vignette=0.45, center=(0.5, 0.5)), "field.jpg")


# ---------------------------------------------------------------- GYM
def gym():
    H, W = 1600, 1200
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    floorY = 1390.0
    R = 600.0
    cx, cy = 360.0, floorY - R
    a, b = R * 0.36, R
    t = 150.0

    # sfondo palestra buia: luce dall'alto + bokeh caldi
    bg = 0.018 + 0.12 * np.exp(-(((xx - 640) / 520) ** 2 + ((yy - 120) / 700) ** 2))
    r = rng(41)
    bok = np.zeros((H, W), np.float32)
    for _ in range(26):
        bx, by, rad = r.uniform(500, W + 50), r.uniform(80, 900), r.uniform(18, 60)
        d = np.sqrt((xx - bx) ** 2 + (yy - by) ** 2)
        bok += smoothstep(rad + 2, rad - 2, d) * r.uniform(0.03, 0.14)
    bg += blur(bok, 3)
    beam = np.clip(1 - np.abs(xx - (620 + (yy - 0) * -0.18)) / (140 + yy * 0.45), 0, 1) * (yy < floorY) * 0.1
    bg += beam * smoothstep(floorY, 0, yy)
    img = bg

    # pavimento in gomma
    fl = yy >= floorY
    speck = noise(H, W, 2, 42) * 0.5 + (rng(43).random((H, W)) > 0.985) * 0.4
    img = np.where(fl, 0.03 + speck * 0.015 + 0.05 * np.exp(-((xx - 600) / 500) ** 2) * smoothstep(H, floorY, yy), img)

    # bordo (spessore) del disco
    q = np.clip(((yy - cy) / b) ** 2, 0, 1)
    ex = a * np.sqrt(1 - q)
    inside_y = np.abs(yy - cy) <= b
    swept = inside_y & (xx >= cx - t - ex) & (xx <= cx + ex)
    u, v = (xx - cx) / a, (yy - cy) / b
    rr = np.sqrt(u * u + v * v)
    face = rr <= 1
    rim = swept & ~face
    ny = (yy - cy) / b
    circ = noise(H, W, 400, 44, 2) * 0.8
    rimv = 0.03 + 0.3 * smoothstep(-0.2, -1.0, ny) ** 1.5 + circ * 0.03
    rimv += 0.25 * np.exp(-((ny + 0.97) / 0.03) ** 2)
    img = np.where(rim, rimv, img)

    # faccia del disco: profilo radiale -> normali -> luce
    def hprof(r_):
        h = np.zeros_like(r_)
        h += smoothstep(0.235, 0.205, r_) * 0.03              # mozzo in acciaio rialzato
        h += -0.012 * smoothstep(0.26, 0.85, r_)               # leggera concavità
        h += 0.03 * smoothstep(0.86, 0.9, r_) * smoothstep(1.0, 0.95, r_)  # labbro esterno
        h += -0.006 * np.exp(-((r_ - 0.42) / 0.008) ** 2)      # scanalature
        h += -0.006 * np.exp(-((r_ - 0.66) / 0.008) ** 2)
        return h

    eps = 0.0025
    dh = (hprof(rr + eps) - hprof(rr - eps)) / (2 * eps)
    ang = np.arctan2(v, u)
    nx_, ny_ = -dh * np.cos(ang) * 6, -dh * np.sin(ang) * 6
    nz_ = np.ones_like(nx_)
    nn = np.sqrt(nx_ ** 2 + ny_ ** 2 + nz_ ** 2)
    Ld = np.array([-0.15, -0.82, 0.55])
    Ld = Ld / np.linalg.norm(Ld)
    lam = np.clip((nx_ * Ld[0] + ny_ * Ld[1] + nz_ * Ld[2]) / nn, 0, 1)
    hv = np.array([Ld[0], Ld[1], Ld[2] + 1.0])
    hv /= np.linalg.norm(hv)
    spec = np.clip((nx_ * hv[0] + ny_ * hv[1] + nz_ * hv[2]) / nn, 0, 1)
    topl = smoothstep(0.6, -1.0, v)  # la luce dall'alto cade sulla parte superiore

    rubber = 0.028 + 0.1 * lam * topl + 0.08 * spec ** 30 * topl + noise(H, W, 3, 45) * 0.012
    hub = rr < 0.215
    ring = 0.5 + 0.5 * np.sin(rr * 900)
    steel = 0.25 + 0.55 * lam * (0.5 + 0.5 * topl) + 0.9 * spec ** 60 + ring * 0.06
    facev = np.where(hub, steel, rubber)
    facev = np.where(hub & (rr < 0.12), 0.05 + 0.1 * topl, facev)  # foro del mozzo

    # scritte dipinte in oro sul disco
    S = int(2 * R)
    canvas = Image.new("L", (S, S), 0)
    dr = ImageDraw.Draw(canvas)
    big = ImageFont.truetype(F_BLACK, int(R * 0.27))
    small = ImageFont.truetype(F_BLACK, int(R * 0.11))
    dr.text((S * 0.5, S * 0.64), "20", font=big, fill=255, anchor="mm")
    dr.text((S * 0.5, S * 0.8), "KG", font=small, fill=255, anchor="mm")
    dr.text((S * 0.5, S * 0.3), "FT", font=ImageFont.truetype(F_BLACK, int(R * 0.12)), fill=255, anchor="mm")
    cm = np.asarray(canvas, np.float32) / 255
    ci = np.clip(((v + 1) * R).astype(int), 0, S - 1)
    cj = np.clip(((u + 1) * R).astype(int), 0, S - 1)
    paint = cm[ci, cj] * face * ~hub
    paint *= np.clip(0.75 + noise(H, W, 5, 46) * 2.5, 0, 1)  # vernice consumata

    # composizione faccia
    img = np.where(face, facev, img)
    img = img[..., None] * np.ones(3, np.float32)
    gold_lit = GOLD * (0.35 + 0.9 * (lam * topl)[..., None])
    img = img * (1 - paint[..., None]) + gold_lit * paint[..., None]

    # manicotto + collare + asta zigrinata verso destra
    def cyl(y0, y1, x0, x1, base, hi, knurl=False):
        nonlocal img
        m = (yy >= y0) & (yy <= y1) & (xx >= x0) & (xx <= x1)
        vv = (yy - (y0 + y1) / 2) / ((y1 - y0) / 2)
        env = base + hi * np.exp(-((vv + 0.5) / 0.13) ** 2) + 0.28 * np.exp(-((vv - 0.45) / 0.22) ** 2)
        env -= 0.12 * np.exp(-((vv + 0.05) / 0.12) ** 2)
        env *= 0.35 + 0.65 * np.sqrt(np.clip(1 - vv * vv, 0, 1))
        env += noise(H, W, 60, 47, 1) * 0.05
        if knurl:
            k = (np.sin((xx + yy * 0.9) * 1.6) * np.sin((xx - yy * 0.9) * 1.6)) > 0.2
            env = env * (0.75 + 0.25 * k)
        col = np.clip(env, 0, 2)[..., None] * np.array([0.98, 0.97, 0.95], np.float32)
        img = np.where(m[..., None], col, img)

    rs = R * 0.115
    cyl(cy - rs, cy + rs, cx, cx + 380, 0.2, 1.3)
    rc = R * 0.2
    cyl(cy - rc, cy + rc, cx + 380, cx + 440, 0.12, 0.9)
    rb = R * 0.062
    cyl(cy - rb, cy + rb, cx + 440, W + 10, 0.14, 0.8, knurl=True)

    # riflesso sul pavimento
    refl_src = img[int(2 * floorY - H):int(floorY)][::-1]
    refl = blur(refl_src, 6) * 0.14
    img[int(floorY):] = img[int(floorY):] + refl[: H - int(floorY)]
    contact = np.exp(-((xx - cx + t / 2) / 260) ** 2 - ((yy - floorY) / 14) ** 2) * 0.6
    img = img * (1 - contact[..., None])

    # profondità di campo: l'asta verso la camera va fuori fuoco
    far = blur(img, 9)
    m = smoothstep(cx + 520, W, xx)[..., None]
    img = img * (1 - m) + far * m

    L = tonemap(img.mean(-1) * 1.0, 2.6)
    col = img / np.maximum(img.mean(-1, keepdims=True), 1e-4)
    rgb = grade(L, 0.9) * np.clip(col, 0.6, 1.6) ** 0.6
    save(finish(rgb, 13, vignette=0.5, center=(0.45, 0.55)), "gym.jpg")


# ---------------------------------------------------------------- COMPLETE
def complete():
    H, W = 1600, 1200
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    px = 16.0  # pixel per metro, vista dall'alto
    X, Y = xx / px, yy / px
    st = np.sign(np.sin((Y + X * 0.0) / 5.25 * np.pi))
    alb = 0.12 * (1 + 0.14 * st) * (1 + noise(H, W, 3, 51) * 0.5 + noise(H, W, 60, 52) * 0.3)

    lw, fp = 0.12, 1 / px
    lines = np.zeros((H, W), np.float32)
    # area di rigore ruotata/decentrata per una composizione dinamica
    ox, oy = 8.0, 12.0
    lines = np.maximum(lines, coverage(np.abs(Y - oy), fp, lw) * (X > ox - 30))
    lines = np.maximum(lines, coverage(np.abs(X - (ox + 40.3)), fp, lw) * (Y > oy) * (Y < oy + 16.5))
    lines = np.maximum(lines, coverage(np.abs(Y - (oy + 16.5)), fp, lw) * (X < ox + 40.3))
    rr = np.sqrt((X - (ox + 20.15)) ** 2 + (Y - (oy + 11)) ** 2)
    lines = np.maximum(lines, coverage(np.abs(rr - 9.15), fp, lw) * (Y > oy + 16.5))
    rr2 = np.sqrt((X - (ox + 20.15)) ** 2 + (Y - (oy + 52.5)) ** 2)
    lines = np.maximum(lines, coverage(np.abs(rr2 - 9.15), fp, lw))
    lines = np.maximum(lines, coverage(np.abs(Y - (oy + 52.5)), fp, lw))
    img = alb * (1 - lines) + 0.55 * lines
    img *= 0.7 + 0.5 * np.exp(-(((xx - W * 0.6) / (W * 0.7)) ** 2 + ((yy - H * 0.4) / (H * 0.7)) ** 2))

    # tracce GPS
    def catmull(pts, n=40):
        pts = [pts[0]] + pts + [pts[-1]]
        out = []
        for i in range(1, len(pts) - 2):
            p0, p1, p2, p3 = map(np.array, pts[i - 1:i + 3])
            for tt in np.linspace(0, 1, n, endpoint=False):
                t2, t3 = tt * tt, tt * tt * tt
                out.append(0.5 * ((2 * p1) + (-p0 + p2) * tt + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
        return [tuple(p) for p in out]

    SS = 2
    trails = Image.new("L", (W * SS, H * SS), 0)
    hot = Image.new("L", (W * SS, H * SS), 0)
    dots = Image.new("L", (W * SS, H * SS), 0)
    d1, d2, d3 = ImageDraw.Draw(trails), ImageDraw.Draw(hot), ImageDraw.Draw(dots)
    r = rng(53)
    for k in range(4):
        pts = [(r.uniform(0.08, 0.92) * W, r.uniform(0.08, 0.92) * H) for _ in range(4)]
        c = catmull(pts)
        d1.line([(x * SS, y * SS) for x, y in c], fill=int(r.uniform(90, 160)), width=3 * SS, joint="curve")
    sprint = catmull([(W * 0.12, H * 0.9), (W * 0.3, H * 0.72), (W * 0.52, H * 0.6), (W * 0.66, H * 0.38), (W * 0.74, H * 0.16)])
    d2.line([(x * SS, y * SS) for x, y in sprint], fill=255, width=6 * SS, joint="curve")
    for i in range(0, len(sprint), 12):
        x, y = sprint[i]
        d3.ellipse([(x - 7) * SS, (y - 7) * SS, (x + 7) * SS, (y + 7) * SS], fill=255)
    tr = np.asarray(trails.resize((W, H), Image.LANCZOS), np.float32) / 255
    ht = np.asarray(hot.resize((W, H), Image.LANCZOS), np.float32) / 255
    dt = np.asarray(dots.resize((W, H), Image.LANCZOS), np.float32) / 255

    L = tonemap(img, 2.4)
    rgb = grade(L, 0.6)
    glow = blur(ht, 14) * 1.1 + blur(ht, 50) * 0.6 + blur(tr, 8) * 0.35
    rgb = rgb + glow[..., None] * GOLD * 0.8
    rgb = rgb * (1 - tr[..., None] * 0.6) + tr[..., None] * np.array([0.8, 0.78, 0.74]) * 0.6
    rgb = rgb * (1 - ht[..., None]) + ht[..., None] * np.array([1.0, 0.86, 0.6])
    rgb = rgb * (1 - dt[..., None]) + dt[..., None] * np.array([1.0, 0.97, 0.9])

    # etichette dati in stile Salah
    im = Image.fromarray(np.clip(rgb * 255, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(im)
    mono = ImageFont.truetype(F_MONO, 22)
    ex, ey = sprint[-1]
    dr.text((ex + 22, ey - 10), "MAX 32.4 KM/H", font=mono, fill=(236, 214, 170))
    mx, my = sprint[len(sprint) // 2]
    dr.text((mx + 22, my), "SPRINT 07 · 41 M", font=mono, fill=(210, 205, 196))
    dr.text((40, 40), "GPS · 10 HZ     WK 08 · BLOCK 02", font=mono, fill=(170, 165, 158))
    rgb = np.asarray(im, np.float32) / 255
    save(finish(rgb, 14, vignette=0.35), "complete.jpg")


# ---------------------------------------------------------------- TUNNEL
def tunnel():
    H, W = 1500, 1200
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    f, vx, vy = W * 0.85, W * 0.5, H * 0.47
    hw, fh, ch, Z_END = 1.7, 1.25, 1.35, 16.0
    with np.errstate(divide="ignore"):
        zf_ = np.where(yy > vy, fh * f / (yy - vy), np.inf)
        zc_ = np.where(yy < vy, ch * f / (vy - yy), np.inf)
        zw_ = np.where(xx != vx, hw * f / np.abs(xx - vx), np.inf)
    z = np.minimum(np.minimum(zf_, zc_), zw_)
    which = np.argmin(np.stack([zf_, zc_, zw_]), 0)
    exitm = z > Z_END
    zc = np.minimum(z, Z_END)
    Xs = (xx - vx) * zc / f
    Ys = (vy - yy) * zc / f  # altezza rispetto alla camera

    # luci a soffitto (strisce) ogni 4 m
    emis = np.zeros((H, W), np.float32)
    ceil = (which == 1) & ~exitm
    zl = np.mod(zc, 4.0)
    strip = ceil & (np.abs(Xs) < 0.14) & (zl > 1.2) & (zl < 2.6)
    emis += strip * 7.0

    # illuminazione delle superfici
    li = np.zeros((H, W), np.float32)
    for k in np.arange(1.9, Z_END, 4.0):
        li += np.exp(-((zc - k) / 1.6) ** 2)
    spill = np.exp(-(Z_END - zc) / 5.0) * 2.2
    base = 0.05 + 0.18 * li / (1 + zc * 0.03) + spill * 0.25
    wall = (which == 2) & ~exitm
    floor = (which == 0) & ~exitm
    panel = 0.5 + 0.5 * np.cos(zc / 2.5 * 2 * np.pi)
    panel_aa = np.clip(1 - zc / 18, 0, 1)
    wallv = base * (0.94 + 0.06 * panel * panel_aa) * (1 + noise(H, W, 4, 62) * 0.15)
    # fascia oro sul muro a 1 m da terra
    band = wall & (np.abs(Ys + fh - 1.0) < 0.06)
    floorv = base * 0.8 * (1 + noise(H, W, 3, 61) * 0.2)
    ceilv = base * 0.5
    img = np.where(wall, wallv, np.where(floor, floorv, ceilv))

    # uscita: campo sovraesposto
    ex_bright = 2.4 + 0.8 * smoothstep(vy + 5, vy - 80, yy) - 0.6 * smoothstep(vy, vy + 60, yy)
    img = np.where(exitm, ex_bright, img)
    img = img + emis

    # riflesso delle luci sul pavimento lucido
    mir = np.clip((vy - (yy - vy) * (ch / fh)).astype(int), 0, H - 1)
    refl = (emis + exitm * ex_bright)[mir, np.arange(W)[None, :].repeat(H, 0)]
    refl = blur(refl, 5)
    refl = blur(refl, 26, axes=(0,))
    img = img + refl * floor * 0.22

    # foschia verso l'uscita
    fog = 1 - np.exp(-zc / 22)
    img = img * (1 - fog * 0.6) + fog * 0.6 * 0.5 * (1 + spill)

    bright = np.maximum(img - 1.0, 0)
    img = img + blur(bright, 8) * 0.5 + blur(bright, 40) * 0.5 + blur(bright, 140) * 0.6
    L = tonemap(img, 1.7)
    rgb = grade(L, 1.0)
    bandc = GOLD * (0.3 + 0.9 * np.clip(base * 3, 0, 1))[..., None]
    bm = blur(band.astype(np.float32), 0.7)[..., None]
    rgb = rgb * (1 - bm) + bandc * bm
    save(finish(rgb, 15, vignette=0.6, center=(0.5, 0.47)), "tunnel.jpg")


SCENES = {"hero": hero, "field": field, "gym": gym, "complete": complete, "tunnel": tunnel}

if __name__ == "__main__":
    names = sys.argv[1:] or list(SCENES)
    for n in names:
        print("render", n)
        SCENES[n]()
