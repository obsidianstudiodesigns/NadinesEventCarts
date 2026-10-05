# Builds every image the site uses from the source files in tools/src and the workspace logo.
#   python tools/make-assets.py   (needs Pillow, numpy and opencv-python)
#
#   assets/photos/   photos cut out of the Facebook posts
#   assets/3d/       procedural foil, sponge and frosting normal maps; recompressed wood textures
#   assets/brand/    round logo cut-out, favicons, app icons and the link-preview image
import os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

SRC = 'tools/src/'
PHOTOS = 'assets/photos/'
TEX = 'assets/3d/'
BRAND = 'assets/brand/'
for d in (PHOTOS, TEX, BRAND):
    os.makedirs(d, exist_ok=True)

# ------------------------------------------------------------------ photos
# (source flyer, crop box). The flyers mix real photos with artwork; these boxes keep only the photos.
CROPS = {
    'cake-cart': ('fb-01.jpg', (40, 768, 436, 1150)),
    'charcuterie-box': ('fb-01.jpg', (48, 358, 447, 660)),
    'dessert-trays': ('fb-01.jpg', (476, 480, 800, 800)),
    'mini-pink': ('fb-08.jpg', (0, 898, 322, 1218)),
    'mini-nut': ('fb-08.jpg', (332, 1012, 712, 1392)),
    'mini-choc': ('fb-08.jpg', (726, 952, 1024, 1394)),
    'birthday-boxes': ('fb-04.jpg', (27, 6, 322, 290)),
    'gift-box': ('fb-04.jpg', (336, 268, 532, 486)),
    'boxes-open': ('fb-04.jpg', (292, 478, 532, 650)),
    'charcuterie-cup': ('fb-03.jpg', (286, 432, 446, 766)),
}


def upscale(im, factor=2):
    im = im.resize((im.width * factor, im.height * factor), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=2))


for name, (f, box) in CROPS.items():
    im = Image.open(SRC + f).convert('RGB').crop(box)
    upscale(im).save(PHOTOS + name + '.jpg', quality=86, optimize=True, progressive=True)

# ------------------------------------------------------------------ procedural normal maps
rng = np.random.default_rng(7)


def band_noise(n, lo, hi):
    """Tileable band-limited noise, normalised to -1..1."""
    f = np.fft.fft2(rng.standard_normal((n, n)))
    fy = np.fft.fftfreq(n)[:, None] * n
    fx = np.fft.fftfreq(n)[None, :] * n
    r = np.sqrt(fx * fx + fy * fy)
    f *= np.exp(-((r - (lo + hi) / 2) / ((hi - lo) / 2 + 1e-6)) ** 2)
    h = np.real(np.fft.ifft2(f))
    return h / (np.abs(h).max() + 1e-9)


def to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + nz)
    rgb = np.stack([(-dx / l) * 0.5 + 0.5, (dy / l) * 0.5 + 0.5, (nz / l) * 0.5 + 0.5], -1)
    return Image.fromarray((rgb * 255).astype(np.uint8))


N = 1024
# foil: sharp ridged creases at two scales plus a fine rolled-metal grain
crease = 1 - np.abs(band_noise(N, 3, 7))
crease2 = 1 - np.abs(band_noise(N, 10, 22))
grain = band_noise(N, 120, 260)
foil = crease ** 3 * 1.0 + crease2 ** 3 * 0.45 + grain * 0.04
to_normal(foil, 9).save(TEX + 'foil-normal.jpg', quality=90)
# foil roughness: slightly rougher in the folds
rough = np.clip(0.22 + (1 - crease2) * 0.18 + band_noise(N, 40, 90) * 0.05, 0, 1)
Image.fromarray((rough * 255).astype(np.uint8)).save(TEX + 'foil-rough.jpg', quality=90)

# sponge crumb: open pores (dark blobs) in a soft bumpy crumb
pores = band_noise(N, 40, 110)
crumb = band_noise(N, 12, 40) * 0.5 + band_noise(N, 90, 200) * 0.25
sponge = crumb - np.clip(pores - 0.35, 0, 1) * 2.2
to_normal(sponge, 5).save(TEX + 'sponge-normal.jpg', quality=90)
# crumb colour: pores and crust speckle darken the sponge colour (used as a multiply map)
shade = 0.9 + crumb * 0.12 - np.clip(pores - 0.25, 0, 1) * 0.9 + band_noise(N, 150, 300) * 0.05
Image.fromarray((np.clip(shade, 0, 1) * 255).astype(np.uint8)).convert('RGB').save(TEX + 'sponge-color.jpg', quality=88)

# frosting: very soft, slightly grainy surface
icing = band_noise(512, 30, 80) * 0.6 + band_noise(512, 120, 240) * 0.25
to_normal(icing, 2.2).save(TEX + 'icing-normal.jpg', quality=90)

# wood textures from Poly Haven, recompressed for the web
for name in ('coated-pine-color', 'coated-pine-normal', 'coated-pine-rough'):
    p = TEX + name + '.jpg'
    im = Image.open(p)
    if im.width > 1536:
        im = im.resize((1536, 1536), Image.LANCZOS)
        if name.endswith('rough'):
            im = im.convert('L')
        im.save(p, quality=82, optimize=True)

# the real cart top is a pale, honey-coloured pine; the Poly Haven pine is darker and more orange
im = Image.open(TEX + 'coated-pine-color.jpg').convert('HSV')
h_, s_, v_ = [np.asarray(c, dtype=np.float32) for c in im.split()]
s_ *= 0.62; v_ = np.clip(v_ * 1.28 + 14, 0, 255)
Image.merge('HSV', [Image.fromarray(c.astype(np.uint8)) for c in (h_, s_, v_)]).convert('RGB').save(TEX + 'cart-top-color.jpg', quality=84, optimize=True)

# ------------------------------------------------------------------ brand
# The sticker in logo.jpg is photographed slightly from below, so it reads as an ellipse.
# Cut out an ellipse just outside the gold ring and stretch it back to a circle.
CX, CY, RX, RY = 367, 422, 336, 360
logo = Image.open('logo.jpg').convert('RGB')
S = 1024
disc = logo.crop((CX - RX, CY - RY, CX + RX, CY + RY)).resize((S, S), Image.LANCZOS).convert('RGBA')
mask = Image.new('L', (S * 4, S * 4), 0)
ImageDraw.Draw(mask).ellipse([0, 0, S * 4 - 1, S * 4 - 1], fill=255)
disc.putalpha(mask.resize((S, S), Image.LANCZOS))
disc.save(BRAND + 'logo-round.png', optimize=True)
disc.resize((512, 512), Image.LANCZOS).save(BRAND + 'logo-round-512.png', optimize=True)
disc.resize((256, 256), Image.LANCZOS).save(BRAND + 'logo-round-256.png', optimize=True)

ROSE = (246, 236, 236, 255)


def icon(size, pad, radius):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], int(size * radius), fill=255)
    im.paste(Image.new('RGBA', (size, size), ROSE), (0, 0), m)
    a = disc.resize((int(size * (1 - 2 * pad)),) * 2, Image.LANCZOS)
    im.alpha_composite(a, ((size - a.width) // 2,) * 2)
    return im


disc.resize((32, 32), Image.LANCZOS).save(BRAND + 'favicon-32.png')
icon(180, 0.04, 0).convert('RGB').save(BRAND + 'apple-touch-icon.png')
icon(192, 0.04, 0.22).save(BRAND + 'icon-192.png')
icon(512, 0.04, 0.22).save(BRAND + 'icon-512.png')

# link preview: cart photo on the right, logo on blush on the left
og = Image.new('RGBA', (1200, 630), ROSE)
photo = Image.open(PHOTOS + 'cake-cart.jpg').convert('RGBA')
photo = photo.resize((int(photo.width * 630 / photo.height), 630), Image.LANCZOS)
pw = min(photo.width, 640)
og.alpha_composite(photo.crop((0, 0, pw, 630)), (1200 - pw, 0))
fade = Image.new('L', (200, 630))
for x in range(200):
    ImageDraw.Draw(fade).line([(x, 0), (x, 630)], fill=int(255 * (1 - x / 199)))
og.paste(Image.new('RGBA', (200, 630), ROSE), (1200 - pw, 0), fade)
l = disc.resize((470, 470), Image.LANCZOS)
og.alpha_composite(l, (70, 80))
og.convert('RGB').save(BRAND + 'og-image.jpg', quality=88, optimize=True)
print('assets written')
