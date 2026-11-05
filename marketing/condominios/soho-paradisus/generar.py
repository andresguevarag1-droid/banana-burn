"""Borradores Soho. Python 3 + ImageMagick, sin red ni paquetes externos."""
import argparse
import math
from pathlib import Path
import subprocess
import tempfile
import zlib

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
URL = 'https://www.bananaburn.app/c/soho-paradisus'
INK, PAPER, BANANA = '#1B1505', '#FFF8E3', '#FFD60A'
FONT = ROOT / 'src/app/og/jakarta-800.woff'
BODY = ROOT / 'src/app/og/jakarta-600.woff'


def run(*args):
    result = subprocess.run([str(x) for x in args], capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode())
    return result.stdout


def qr_matrix(payload):
    # ISO/IEC 18004: version 4, byte mode, correction L, mask 0.
    # One Reed-Solomon block: 80 data codewords + 20 parity codewords.
    data = payload.encode('utf-8')
    assert len(data) <= 78
    bits = [0, 1, 0, 0] + [(len(data) >> i) & 1 for i in range(7, -1, -1)]
    for b in data:
        bits += [(b >> i) & 1 for i in range(7, -1, -1)]
    bits += [0] * min(4, 640 - len(bits))
    bits += [0] * ((-len(bits)) % 8)
    words = [sum(bits[k + i] << (7 - i) for i in range(8)) for k in range(0, len(bits), 8)]
    while len(words) < 80:
        words.append(0xEC if (len(words) - math.ceil(len(bits) / 8)) % 2 == 0 else 0x11)

    def mul(a, b):
        result = 0
        for i in range(7, -1, -1):
            result = (result << 1) ^ ((result >> 7) * 0x11D)
            result ^= ((b >> i) & 1) * a
        return result

    divisor = [0] * 19 + [1]
    root = 1
    for _ in range(20):
        for j in range(20):
            divisor[j] = mul(divisor[j], root)
            if j < 19:
                divisor[j] ^= divisor[j + 1]
        root = mul(root, 2)
    parity = [0] * 20
    for b in words:
        factor = b ^ parity.pop(0)
        parity.append(0)
        parity = [x ^ mul(d, factor) for x, d in zip(parity, divisor)]
    stream = [(b >> i) & 1 for b in words + parity for i in range(7, -1, -1)]
    n = 33
    matrix = [[False] * n for _ in range(n)]
    reserved = [[False] * n for _ in range(n)]

    def put(x, y, value):
        if 0 <= x < n and 0 <= y < n:
            matrix[y][x], reserved[y][x] = bool(value), True

    for cx, cy in [(3, 3), (n - 4, 3), (3, n - 4)]:
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                put(cx + dx, cy + dy, max(abs(dx), abs(dy)) not in (2, 4))
    for i in range(8, n - 8):
        put(6, i, i % 2 == 0)
        put(i, 6, i % 2 == 0)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            put(26 + dx, 26 + dy, max(abs(dx), abs(dy)) != 1)
    value = 1 << 3  # L=01, mask=000
    remainder = value
    for _ in range(10):
        remainder = (remainder << 1) ^ ((remainder >> 9) * 0x537)
    fmt = ((value << 10) | remainder) ^ 0x5412
    bit = lambda i: (fmt >> i) & 1
    for i in range(6):
        put(8, i, bit(i))
    put(8, 7, bit(6))
    put(8, 8, bit(7))
    put(7, 8, bit(8))
    for i in range(9, 15):
        put(14 - i, 8, bit(i))
    for i in range(8):
        put(n - 1 - i, 8, bit(i))
    for i in range(8, 15):
        put(8, n - 15 + i, bit(i))
    put(8, n - 8, True)
    k, right = 0, n - 1
    while right >= 1:
        if right == 6:
            right = 5
        for vertical in range(n):
            y = n - 1 - vertical if ((right + 1) & 2) == 0 else vertical
            for x in (right, right - 1):
                if not reserved[y][x]:
                    b = stream[k] if k < len(stream) else 0
                    matrix[y][x] = bool(b ^ ((x + y) % 2 == 0))
                    k += 1
        right -= 2
    assert k == 807  # 800 encoded bits + seven remainder bits
    return matrix


def quote(s):
    return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"


def art(story, scene, tmp):
    w, h = (1080, 1920) if story else (2480, 3508)
    scale = 1 if story else w / 1080
    cmds = [f'scale {scale},{scale}', f'fill {PAPER} rectangle 0,0,1080,1920']

    def rect(x, y, width, height, fill, radius=0):
        if radius:
            cmds.append(f'fill {fill} stroke none roundrectangle {x},{y} {x+width},{y+height} {radius},{radius}')
        else:
            cmds.append(f'fill {fill} stroke none rectangle {x},{y} {x+width},{y+height}')

    def text(s, x, y, size, color=INK, bold=False):
        cmds.append(f'font {quote(FONT if bold else BODY)} font-size {size} fill {color} stroke none text {x},{y} {quote(s)}')

    if story:
        rect(0, 0, 1080, 1920, BANANA)
        text('SOHO PARADISUS', 64, 282, 24, bold=True)
        text('El gimnasio', 64, 380, 58, bold=True)
        text('del condominio,', 64, 452, 58, bold=True)
        text('ahora con', 64, 524, 58, bold=True)
        text('entrenador', 64, 596, 58, bold=True)
        run('convert', scene, '-auto-orient', '-resize', '460x490', tmp / 'scene.png')
        cmds.append(f'image over 570,310 0,0 {quote(tmp / "scene.png")}')
        text('Tu plan listo antes de bajar.', 64, 744, 34, bold=True)
        text('En el gimnasio o en casa.', 64, 790, 29)
        rect(48, 842, 984, 230, PAPER, 28)
        text('Prueba 7 días sin tarjeta.', 74, 900, 44, bold=True)
        text('Deja tu tarjeta y sigue gratis', 74, 964, 36)
        text('hasta el 31 de diciembre.', 74, 1018, 36, bold=True)
        rect(48, 1100, 984, 340, INK, 28)
        cmds.append(f'image over 68,1120 300,300 {quote(OUT / "qr.png")}')
        text('Regístrate y haz', 402, 1192, 40, PAPER, True)
        text('tu primer entreno.', 402, 1246, 40, PAPER, True)
        text('Escanea el QR', 402, 1320, 28, PAPER)
        text('para empezar.', 402, 1362, 28, PAPER)
        text('bananaburn.app/c/soho-paradisus', 64, 1476, 27, bold=True)
        text('Al guardar tarjeta: primer cobro el 1 de enero de 2027.', 64, 1508, 23)
        text('Entreno $9.99/mes o Entreno + Nutrición $14.99/mes.', 64, 1538, 23)
        text('IVA incluido. Aviso 2 días antes. Cancela cuando quieras.', 64, 1568, 23)
    else:
        top = 265 if story else 64
        rect(0, 0, 1080, 1920 if story else 1528, BANANA)
        text('SOHO PARADISUS', 64, top + 22, 22, bold=True)
        text('El gimnasio', 60, top + 104, 76, bold=True)
        text('del condominio,', 60, top + 188, 76, bold=True)
        text('ahora con entrenador', 60, top + 264, 65, bold=True)
        text('Tu rutina, la técnica y un coach en tu celular.', 64, top + 318, 27)
        # Approved art only. A supplied official scene replaces the local Coach.
        imgy = top + 346
        run('convert', scene, '-auto-orient', '-resize', '410x370', tmp / 'scene.png')
        cmds.append(f'image over 610,{imgy} 0,0 {quote(tmp / "scene.png")}')
        text('Tu plan listo', 64, imgy + 98, 38, bold=True)
        text('antes de bajar.', 64, imgy + 148, 38, bold=True)
        text('En el gimnasio o en casa.', 64, imgy + 211, 27)
        offer_y = 970 if story else 820
        rect(48, offer_y, 984, 142, PAPER, 28)
        text('Prueba 7 días sin tarjeta.', 74, offer_y + 48, 40, bold=True)
        text('Deja tu tarjeta y sigue gratis hasta el 31 de diciembre.', 74, offer_y + 103, 28)
        cta_y = offer_y + 190
        rect(48, cta_y - 12, 984, 262, INK, 28)
        cmds.append(f'image over 68,{cta_y+6} 225,225 {quote(OUT / "qr.png")}')
        text('Regístrate y haz', 330, cta_y + 62, 43, PAPER, True)
        text('tu primer entreno.', 330, cta_y + 116, 43, PAPER, True)
        text('Escanea el QR para empezar.', 330, cta_y + 175, 25, PAPER)
        text('bananaburn.app/c/soho-paradisus', 64, cta_y + 290, 27, bold=True)
        foot = cta_y + 335
        text('Al guardar tarjeta: primer cobro el 1 de enero de 2027.', 64, foot, 23)
        text('Entreno $9.99/mes o Entreno + Nutrición $14.99/mes.', 64, foot + 34, 23)
        text('IVA incluido. Aviso 2 días antes. Cancela cuando quieras.', 64, foot + 68, 23)
        if not story:
            text('Banana', 64, 1453, 33, bold=True)
            text('Burn', 193, 1453, 33, '#8A5300', True)
            text('Solo para residentes de Soho Paradisus.', 402, 1453, 25)
        else:
            # Keep footer at y <=1570, clear of Instagram controls.
            assert foot + 68 <= 1570
    mvg = tmp / ('story.mvg' if story else 'poster.mvg')
    mvg.write_text('\n'.join(cmds), encoding='utf-8')
    dest = OUT / ('historia.png' if story else 'afiche-a4.png')
    run('convert', '-size', f'{w}x{h}', 'xc:' + PAPER, '-draw', mvg.read_text(encoding='utf-8'),
        '-units', 'PixelsPerInch', '-density', '300' if not story else '72', dest)
    return dest


def pdf(png):
    # A single lossless RGB image on an exact A4 page, no printer margins.
    rgb = run('convert', png, '-alpha', 'off', '-depth', '8', 'rgb:-')
    compressed = zlib.compress(rgb, 9)
    content = b'q 595.275591 0 0 841.889764 0 0 cm /Im0 Do Q'
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>',
               b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.275591 841.889764] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
               b'<< /Type /XObject /Subtype /Image /Width 2480 /Height 3508 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ' + str(len(compressed)).encode() + b' >>\nstream\n' + compressed + b'\nendstream',
               b'<< /Length ' + str(len(content)).encode() + b' >>\nstream\n' + content + b'\nendstream']
    result = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
    start = len(result)
    result += b'xref\n0 6\n0000000000 65535 f \n'
    result += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
    result += f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode()
    (OUT / 'afiche-a4.pdf').write_bytes(result)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--escena', type=Path, default=ROOT / 'public/brand/mascota-sola.webp')
    args = parser.parse_args()
    matrix = qr_matrix(URL)
    with tempfile.TemporaryDirectory() as folder:
        tmp = Path(folder)
        # 4-module quiet zone; 12 pixels per module, no smoothing.
        raw = bytearray()
        for y in range(-4, 37):
            row = bytearray()
            for x in range(-4, 37):
                black = 0 <= x < 33 and 0 <= y < 33 and matrix[y][x]
                row.extend(bytes([0 if black else 255]) * 12)
            raw.extend(row * 12)
        pgm = tmp / 'qr.pgm'
        pgm.write_bytes(b'P5\n492 492\n255\n' + raw)
        run('convert', pgm, OUT / 'qr.png')
        poster = art(False, args.escena.resolve(), tmp)
        art(True, args.escena.resolve(), tmp)
        pdf(poster)
    print('Generados: afiche-a4.png, afiche-a4.pdf, historia.png y qr.png')


if __name__ == '__main__':
    main()
