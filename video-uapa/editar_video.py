"""Edita el video reflexivo: portada, separadores, gráficos sincronizados y cierre.

Uso: python editar.py <carpeta_videos> <carpeta_trabajo> <salida.mp4>
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC, WORK, SALIDA = sys.argv[1], sys.argv[2], sys.argv[3]
SOLO = sys.argv[4] if len(sys.argv) > 4 else None  # renderizar solo una parte (pruebas)
os.makedirs(WORK, exist_ok=True)

W, H, FPS = 1920, 1080, 30
PAD = 0.6  # segundos de imagen congelada al inicio y al final de cada sección (para las transiciones)
XF = 0.5  # duración de cada transición

NAVY = (11, 31, 58)
NAVY2 = (18, 52, 96)
GOLD = (242, 183, 5)
WHITE = (255, 255, 255)
SOFT = (214, 225, 240)

FONT_DIR = "/usr/share/fonts/opentype/inter/"


def font(peso, tam):
    return ImageFont.truetype(os.path.join(FONT_DIR, f"Inter-{peso}.otf"), tam)


def ruta(*p):
    return os.path.join(WORK, *p)


def run(cmd):
    print(">", " ".join(cmd[:6]), "...", flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-4000:])
        raise SystemExit(1)


def envolver(texto, fnt, ancho):
    """Parte el texto en líneas que caben en `ancho` píxeles."""
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    lineas, actual = [], ""
    for palabra in texto.split():
        prueba = (actual + " " + palabra).strip()
        if d.textlength(prueba, font=fnt) <= ancho:
            actual = prueba
        else:
            lineas.append(actual)
            actual = palabra
    if actual:
        lineas.append(actual)
    return lineas


def espaciado(d, xy, texto, fnt, fill, track):
    """Texto con espaciado entre letras (para los títulos pequeños en mayúscula)."""
    x, y = xy
    for ch in texto:
        d.text((x, y), ch, font=fnt, fill=fill)
        x += d.textlength(ch, font=fnt) + track
    return x


def ancho_espaciado(texto, fnt, track):
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    return sum(d.textlength(ch, font=fnt) + track for ch in texto) - track


# ---------------------------------------------------------------------------
# Contenido (tiempos en segundos dentro de cada video ya recortado)
# ---------------------------------------------------------------------------
SECCIONES = [
    {
        "num": "01", "titulo": "Presentación personal",
        "archivo": "a6cc7c8e-WhatsApp_Video_2026-10-07_at_10.53.06_AM.mp4", "ss": 0.0, "to": 50.57,
        "lower_third": (0.5, 8.0),
        "grupos": [
            {"desde": 0.6, "hasta": None, "sub": "Quién soy", "items": [
                (8.4, "Desde Constanza, República Dominicana"),
                (12.5, "Asignatura: Orientación a la Educación a Distancia Virtual"),
                (25.6, "Mi meta: crear soluciones tecnológicas para empresas e instituciones"),
                (37.7, "DEXA Technologies: software a medida e inteligencia artificial"),
            ]},
        ],
    },
    {
        "num": "02", "titulo": "Sobre la universidad",
        "archivo": "a9a90e91-WhatsApp_Video_2026-10-07_at_10.53.07_AM.mp4", "ss": 0.0, "to": 99.92,
        "grupos": [
            {"desde": 2.6, "hasta": 65.2, "sub": "¿Por qué la UAPA?", "items": [
                (5.5, "Modalidad virtual: estudiar sin dejar el trabajo"),
                (20.1, "Más de 30 años formando profesionales"),
                (34.3, "Plataforma sólida y un plan de estudios actual"),
                (42.3, "El participante es el protagonista de su aprendizaje"),
                (50.3, "Todo en el EVA: lecciones, videos, foros y biblioteca virtual"),
            ]},
            {"desde": 65.5, "hasta": None, "sub": "El mayor reto", "items": [
                (65.7, "Organizar el tiempo entre trabajo, proyectos y tareas"),
                (75.7, "Solución: un horario fijo de estudio"),
                (79.5, "Recordatorios por WhatsApp 1, 3 y 5 días antes de cada entrega"),
                (92.2, "Resultado: todo entregado a tiempo y con más tranquilidad"),
            ]},
        ],
    },
    {
        "num": "03", "titulo": "Aprendizajes en esta asignatura",
        "archivo": "a769d7ac-WhatsApp_Video_2026-10-07_at_10.53.04_AM.mp4", "ss": 2.45, "to": 89.3,
        "grupos": [
            {"desde": 0.2, "hasta": 38.5, "sub": "Lo que aprendí", "items": [
                (0.3, "Historia, misión y modelo educativo de la UAPA"),
                (8.7, "Portal, plataforma virtual y correo institucional"),
                (14.45, "Reinscripción en línea, vías de pago, cambios y retiros"),
                (23.35, "Permanencia académica: índice de 69 puntos o más"),
            ]},
            {"desde": 38.8, "hasta": 53.9, "sub": "Estudio y evaluación", "items": [
                (38.9, "Técnicas y hábitos de estudio"),
                (43.6, "Evaluación diagnóstica, continua, sumativa, autoevaluación y coevaluación"),
                (48.6, "Comunicación sincrónica y asincrónica"),
            ]},
        ],
        "destacado": {"desde": 54.15, "kicker": "La habilidad más valiosa", "grande": "AUTODISCIPLINA",
                      "nota_t": 69.6,
                      "nota": "Clave en el desarrollo de software: aprender por cuenta propia, cumplir plazos y trabajar a distancia."},
    },
    {
        "num": "04", "titulo": "Recomendaciones para futuros participantes",
        "archivo": "733ddf90-WhatsApp_Video_2026-10-07_at_10.53.03_AM.mp4", "ss": 2.8, "to": 59.9,
        "consejos": {"desde": 0.2, "sub": "4 consejos para empezar", "items": [
            (5.1, "Organízate", "Revisa el cronograma cada lunes y ten un horario fijo."),
            (15.6, "No lo dejes para el último día", "Las actividades tienen fecha de cierre."),
            (26.25, "Participa y pregunta", "Foro de dudas, correo institucional y compañeros."),
            (43.45, "Cuida tu índice", "Conoce el Reglamento Académico: tus derechos y deberes."),
        ]},
    },
    {
        "num": "05", "titulo": "Reflexión final",
        "archivo": "4dbb4096-WhatsApp_Video_2026-10-07_at_10.53.02_AM.mp4", "ss": 0.0, "to": 26.2,
        "cita": {"desde": 0.4,
                 "texto": "Estudiar a distancia no significa estudiar solo: significa aprender con autonomía, pero acompañado.",
                 "sello_t": 16.9, "sello": "Orgulloso de ser uapiano"},
    },
]

NOMBRE = "Keury Manuel Durán García"
CARRERA = "Ingeniería de Software · UAPA"
CURSO = "ORIENTACIÓN A LA EDUCACIÓN A DISTANCIA VIRTUAL"

# Geometría
FG_H = 980
FG_W = round(480 / 864 * FG_H / 2) * 2  # 544
FG_X, FG_Y = 170, (H - FG_H) // 2
PX = 840  # inicio del panel derecho
PW = 1800 - PX  # ancho útil del panel


# ---------------------------------------------------------------------------
# Gráficos (PNG con transparencia)
# ---------------------------------------------------------------------------
def png_layout():
    """Capa fija: tinte del fondo, sombra y marco del video, curso y pie."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Degradado azul: más sólido en el panel de texto para que se lea bien.
    grad = Image.new("RGBA", (W, H))
    gd = ImageDraw.Draw(grad)
    for x in range(W):
        a = int(150 + 85 * min(1, max(0, (x - 600) / 500)))
        gd.line([(x, 0), (x, H)], fill=NAVY + (a,))
    im = Image.alpha_composite(im, grad)
    # Sombra del video
    sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle(
        [FG_X - 6 + 14, FG_Y - 6 + 18, FG_X + FG_W + 6 + 14, FG_Y + FG_H + 6 + 18], 18, fill=(0, 0, 0, 150))
    im = Image.alpha_composite(im, sombra.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(im)
    # Hueco transparente donde va el video, con marco dorado
    d.rounded_rectangle([FG_X - 5, FG_Y - 5, FG_X + FG_W + 4, FG_Y + FG_H + 4], 14, outline=GOLD + (255,), width=4)
    # Curso arriba del panel y pie de página
    espaciado(d, (PX, 62), CURSO, font("SemiBold", 20), SOFT + (190,), 3)
    pie = f"{NOMBRE}  ·  {CARRERA}"
    fp = font("Regular", 22)
    d.text((1800 - d.textlength(pie, font=fp), 1012), pie, font=fp, fill=SOFT + (170,))
    im.save(ruta("layout.png"))


def png_encabezado(sec):
    fk, ft = font("Bold", 26), font("ExtraBold", 58)
    lineas = envolver(sec["titulo"], ft, PW)
    alto = 40 + len(lineas) * 70 + 30
    im = Image.new("RGBA", (PW, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    espaciado(d, (0, 0), f"SECCIÓN {sec['num']}", fk, GOLD + (255,), 4)
    y = 40
    for l in lineas:
        d.text((0, y), l, font=ft, fill=WHITE + (255,))
        y += 70
    d.rounded_rectangle([0, y + 12, 110, y + 18], 3, fill=GOLD + (255,))
    nombre = ruta(f"enc_{sec['num']}.png")
    im.save(nombre)
    return nombre, alto


def png_sub(texto, idx):
    f = font("SemiBold", 28)
    t = texto.upper()
    im = Image.new("RGBA", (PW, 44), (0, 0, 0, 0))
    espaciado(ImageDraw.Draw(im), (0, 4), t, f, GOLD + (255,), 3)
    nombre = ruta(f"sub_{idx}.png")
    im.save(nombre)
    return nombre, 44


def png_item(texto, idx):
    f = font("Medium", 36)
    lineas = envolver(texto, f, PW - 70)
    alto = len(lineas) * 48 + 30
    im = Image.new("RGBA", (PW, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, PW, alto - 8], 14, fill=(255, 255, 255, 22))
    d.rounded_rectangle([0, 0, 7, alto - 8], 3, fill=GOLD + (255,))
    y = 10
    for l in lineas:
        d.text((32, y), l, font=f, fill=WHITE + (255,))
        y += 48
    nombre = ruta(f"item_{idx}.png")
    im.save(nombre)
    return nombre, alto


def png_consejo(n, titulo, detalle, idx):
    ft, fd, fn = font("Bold", 36), font("Regular", 27), font("ExtraBold", 40)
    det = envolver(detalle, fd, PW - 140)
    alto = 14 + 48 + len(det) * 34 + 16
    im = Image.new("RGBA", (PW, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, PW, alto - 6], 16, fill=(255, 255, 255, 24))
    d.ellipse([22, 18, 84, 80], fill=GOLD + (255,))
    tw = d.textlength(str(n), font=fn)
    d.text((53 - tw / 2, 23), str(n), font=fn, fill=NAVY + (255,))
    d.text((110, 12), titulo, font=ft, fill=WHITE + (255,))
    y = 62
    for l in det:
        d.text((110, y), l, font=fd, fill=SOFT + (255,))
        y += 34
    nombre = ruta(f"consejo_{idx}.png")
    im.save(nombre)
    return nombre, alto


def png_destacado(dest, idx):
    fk, fg = font("SemiBold", 34), font("Black", 104)
    im = Image.new("RGBA", (PW, 220), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((0, 0), dest["kicker"], font=fk, fill=SOFT + (255,))
    # Ajusta la palabra grande al ancho del panel
    tam = 104
    while d.textlength(dest["grande"], font=fg) > PW and tam > 60:
        tam -= 4
        fg = font("Black", tam)
    d.text((0, 56), dest["grande"], font=fg, fill=GOLD + (255,))
    a = ruta(f"dest_{idx}.png")
    im.save(a)
    fn = font("Regular", 32)
    lineas = envolver(dest["nota"], fn, PW - 40)
    im2 = Image.new("RGBA", (PW, len(lineas) * 44 + 40), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(im2)
    d2.rounded_rectangle([0, 0, PW, im2.height - 4], 14, fill=(255, 255, 255, 22))
    y = 16
    for l in lineas:
        d2.text((24, y), l, font=fn, fill=WHITE + (255,))
        y += 44
    b = ruta(f"destnota_{idx}.png")
    im2.save(b)
    return a, b


def png_cita(cita, idx):
    fq, fc = font("Black", 160), font("SemiBold", 46)
    lineas = envolver(cita["texto"], fc, PW - 40)
    alto = 120 + len(lineas) * 62
    im = Image.new("RGBA", (PW, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((-6, -40), "“", font=fq, fill=GOLD + (255,))
    y = 110
    for l in lineas:
        d.text((0, y), l, font=fc, fill=WHITE + (255,))
        y += 62
    a = ruta(f"cita_{idx}.png")
    im.save(a)
    fs = font("Bold", 34)
    tw = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(cita["sello"], font=fs)
    im2 = Image.new("RGBA", (int(tw) + 70, 74), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(im2)
    d2.rounded_rectangle([0, 0, im2.width - 1, 73], 37, fill=GOLD + (255,))
    d2.text((35, 16), cita["sello"], font=fs, fill=NAVY + (255,))
    b = ruta(f"sello_{idx}.png")
    im2.save(b)
    return a, alto, b


def png_lower_third():
    fn, fs = font("Bold", 44), font("Medium", 28)
    d0 = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    ancho = int(max(d0.textlength(NOMBRE, font=fn), d0.textlength(CARRERA, font=fs))) + 70
    im = Image.new("RGBA", (ancho + 30, 150), (0, 0, 0, 0))
    sombra = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle([8, 14, ancho + 8, 134], 14, fill=(0, 0, 0, 140))
    im = Image.alpha_composite(im, sombra.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, ancho, 122], 14, fill=NAVY + (240,))
    d.rounded_rectangle([0, 0, 10, 122], 4, fill=GOLD + (255,))
    d.text((34, 16), NOMBRE, font=fn, fill=WHITE + (255,))
    d.text((34, 72), CARRERA, font=fs, fill=GOLD + (255,))
    im.save(ruta("lower_third.png"))
    return ruta("lower_third.png")


def fondo_desde_video(archivo, t, nombre):
    """Fondo azul con un cuadro desenfocado del video (portada, separadores, cierre)."""
    tmp = ruta(f"cuadro_{nombre}.png")
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", os.path.join(SRC, archivo), "-frames:v", "1", tmp])
    fr = Image.open(tmp).convert("RGB")
    esc = W / fr.width
    fr = fr.resize((W, int(fr.height * esc)))
    top = int((fr.height - H) * 0.3)
    fr = fr.crop((0, top, W, top + H)).filter(ImageFilter.GaussianBlur(40))
    base = fr.convert("RGBA")
    capa = Image.new("RGBA", (W, H))
    cd = ImageDraw.Draw(capa)
    for y in range(H):
        k = y / H
        c = tuple(int(NAVY[i] * (1 - k) + NAVY2[i] * k) for i in range(3))
        cd.line([(0, y), (W, y)], fill=c + (225,))
    base = Image.alpha_composite(base, capa)
    out = ruta(f"fondo_{nombre}.png")
    base.save(out)
    return out


def png_centrado(texto, fnt, color, nombre, track=0, alto=None):
    d0 = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    ancho = ancho_espaciado(texto, fnt, track) if track else d0.textlength(texto, font=fnt)
    asc, desc = fnt.getmetrics()
    im = Image.new("RGBA", (W, alto or asc + desc + 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = (W - ancho) / 2
    if track:
        espaciado(d, (x, 0), texto, fnt, color, track)
    else:
        d.text((x, 0), texto, font=fnt, fill=color)
    out = ruta(f"{nombre}.png")
    im.save(out)
    return out, im.height


def png_barra(nombre, ancho=140, alto=6):
    im = Image.new("RGBA", (W, alto), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([(W - ancho) // 2, 0, (W + ancho) // 2, alto - 1], 3, fill=GOLD + (255,))
    out = ruta(f"{nombre}.png")
    im.save(out)
    return out


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------
class Capas:
    """Acumula imágenes que aparecen con fundido y deslizamiento."""

    def __init__(self, n_inputs_previos):
        self.inputs, self.filtros, self.n, self.cuenta = [], [], n_inputs_previos, 0

    def add(self, png, x, y, t0, t1, dur, slide=40, fade=0.45, eje="x"):
        idx = self.n + self.cuenta
        self.cuenta += 1
        self.inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", png]
        t1 = dur if t1 is None else t1
        fo = max(t0 + fade, t1 - 0.35)
        self.filtros.append(
            (idx, f"[{idx}:v]format=rgba,fade=t=in:st={t0:.3f}:d={fade}:alpha=1,"
                  f"fade=t=out:st={fo:.3f}:d=0.35:alpha=1[e{idx}]",
             x, y, t0, t1, slide, eje))

    def cadena(self, entrada):
        partes, actual = [], entrada
        for i, (idx, f, x, y, t0, t1, slide, eje) in enumerate(self.filtros):
            partes.append(f)
            mov = f"{slide}*pow(max(0\\,1-(t-{t0:.3f})/0.5)\\,3)"
            xs = f"{x}+{mov}" if eje == "x" else str(x)
            ys = f"{y}+{mov}" if eje == "y" else str(y)
            sig = f"v{idx}"
            partes.append(f"[{actual}][e{idx}]overlay=x='{xs}':y='{ys}':enable='between(t\\,{t0:.3f}\\,{t1:.3f})'[{sig}]")
            actual = sig
        return partes, actual


def codificar_video():
    return ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-r", str(FPS)]


def codificar_audio():
    return ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]


def render_seccion(k, sec, total_prog, prog_ini):
    src = os.path.join(SRC, sec["archivo"])
    dur_clip = sec["to"] - sec["ss"]
    D = dur_clip + 2 * PAD
    o = PAD  # desfase de todos los tiempos por la pausa inicial

    capas = Capas(2)  # 0 = video, 1 = layout
    y_panel = 120
    enc, alto_enc = png_encabezado(sec)
    capas.add(enc, PX, y_panel, 0.15, None, D)
    y0 = y_panel + alto_enc + 40

    if sec.get("lower_third"):
        a, b = sec["lower_third"]
        capas.add(png_lower_third(), 110, 850, a + o, b + o, D, slide=-60)

    for gi, g in enumerate(sec.get("grupos", [])):
        hasta = (g["hasta"] + o) if g["hasta"] is not None else None
        if sec.get("destacado") and g["hasta"] is None:
            hasta = sec["destacado"]["desde"] + o
        y = y0
        p, h = png_sub(g["sub"], f"{k}_{gi}")
        capas.add(p, PX, y, g["desde"] + o, hasta, D)
        y += h + 18
        for ii, (t, texto) in enumerate(g["items"]):
            p, h = png_item(texto, f"{k}_{gi}_{ii}")
            capas.add(p, PX, y, t + o, hasta, D)
            y += h + 10

    if sec.get("destacado"):
        dest = sec["destacado"]
        a, b = png_destacado(dest, k)
        capas.add(a, PX, y0 + 20, dest["desde"] + o, None, D, slide=30, eje="y")
        capas.add(b, PX, y0 + 280, dest["nota_t"] + o, None, D)

    if sec.get("consejos"):
        c = sec["consejos"]
        y = y0
        p, h = png_sub(c["sub"], f"{k}_c")
        capas.add(p, PX, y, c["desde"] + o, None, D)
        y += h + 18
        for ii, (t, tit, det) in enumerate(c["items"]):
            p, h = png_consejo(ii + 1, tit, det, f"{k}_{ii}")
            capas.add(p, PX, y, t + o, None, D)
            y += h + 10

    if sec.get("cita"):
        c = sec["cita"]
        a, alto, b = png_cita(c, k)
        capas.add(a, PX, y0, c["desde"] + o, None, D, slide=30, eje="y")
        capas.add(b, PX, y0 + alto + 40, c["sello_t"] + o, None, D, slide=30, eje="y")

    # Barra de progreso del video completo (abajo)
    p0, p1 = prog_ini / total_prog, (prog_ini + D) / total_prog

    fc = [
        f"[0:v]fps={FPS},setpts=PTS-STARTPTS,split=2[a][b]",
        "[a]scale=640:1152,crop=640:360:0:250,gblur=sigma=14,scale=1920:1080,eq=saturation=0.85[bg]",
        f"[b]scale={FG_W}:{FG_H}:flags=lanczos,eq=contrast=1.04:saturation=1.08,unsharp=5:5:0.6[fg]",
        f"[bg][1:v]overlay=0:0[bg2]",
        f"[bg2][fg]overlay={FG_X}:{FG_Y},format=yuv420p,"
        f"tpad=start_duration={PAD}:start_mode=clone:stop_duration={PAD}:stop_mode=clone[base]",
    ]
    partes, ult = capas.cadena("base")
    fc += partes
    fc.append(f"color=c=0x{GOLD[0]:02X}{GOLD[1]:02X}{GOLD[2]:02X}:s={W}x6:r={FPS}:d={D:.3f}[pb]")
    fc.append(f"color=c=0x000000@0.35:s={W}x6:r={FPS}:d={D:.3f},format=rgba[pbf]")
    fc.append(f"[{ult}][pbf]overlay=0:{H - 6}[pv1]")
    fc.append(f"[pv1][pb]overlay=x='-{W}+{W}*({p0:.5f}+{p1 - p0:.5f}*t/{D:.3f})':y={H - 6}[vout]")
    fc.append(
        "[0:a]aresample=48000,highpass=f=80,afftdn=nf=-25,"
        "acompressor=threshold=-20dB:ratio=3:attack=5:release=120,"
        "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,"
        f"afade=t=in:d=0.08,afade=t=out:st={dur_clip - 0.12:.3f}:d=0.12,"
        f"adelay={int(PAD * 1000)}:all=1,apad=whole_dur={D:.3f},"
        "aformat=sample_fmts=fltp:channel_layouts=stereo[aout]")

    out = ruta(f"sec_{k}.mp4")
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{sec['ss']:.3f}", "-to", f"{sec['to']:.3f}", "-i", src,
           "-loop", "1", "-framerate", str(FPS), "-t", f"{D:.3f}", "-i", ruta("layout.png")]
    cmd += capas.inputs
    script = ruta(f"sec_{k}.filtro")
    open(script, "w").write(";\n".join(fc))
    cmd += ["-filter_complex_script", script, "-map", "[vout]", "-map", "[aout]",
            "-t", f"{D:.3f}"] + codificar_video() + codificar_audio() + [out]
    run(cmd)
    return out, D


def musica(D, nombre, fade_in=0.6, fade_out=0.8, vol=0.9):
    """Colchón suave sintetizado (acorde abierto con trémolo lento) para portada y separadores."""
    out = ruta(f"mus_{nombre}.wav")
    expr = ("0.05*(sin(2*PI*130.81*t)+0.8*sin(2*PI*196.00*t)+0.7*sin(2*PI*261.63*t)"
            "+0.5*sin(2*PI*329.63*t)+0.35*sin(2*PI*392.00*t))*(0.75+0.25*sin(2*PI*0.5*t))")
    run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"aevalsrc='{expr}':s=48000:d={D:.3f}",
         "-af", f"lowpass=f=1800,aecho=0.8:0.6:90|180:0.3|0.2,volume={vol},"
                f"afade=t=in:d={fade_in},afade=t=out:st={D - fade_out:.3f}:d={fade_out},"
                "aformat=channel_layouts=stereo", out])
    return out


def render_tarjeta(nombre, fondo, elementos, D, total_prog, prog_ini, con_barra=True):
    """Portada, separadores y cierre: fondo con zoom lento + textos que entran escalonados."""
    capas = Capas(2)
    for (png, x, y, t0, slide, eje) in elementos:
        capas.add(png, x, y, t0, None, D, slide=slide, eje=eje, fade=0.6)
    frames = int(D * FPS)
    fc = [f"[0:v]scale=2304:1296,zoompan=z='1+0.06*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
          f":d=1:s={W}x{H}:fps={FPS},format=yuv420p[base]"]
    partes, ult = capas.cadena("base")
    fc += partes
    if con_barra:
        p0, p1 = prog_ini / total_prog, (prog_ini + D) / total_prog
        fc.append(f"color=c=0x{GOLD[0]:02X}{GOLD[1]:02X}{GOLD[2]:02X}:s={W}x6:r={FPS}:d={D:.3f}[pb]")
        fc.append(f"[{ult}][pb]overlay=x='-{W}+{W}*({p0:.5f}+{p1 - p0:.5f}*t/{D:.3f})':y={H - 6}[vout]")
    else:
        fc.append(f"[{ult}]null[vout]")
    fc.append("[1:a]anull[aout]")
    out = ruta(f"{nombre}.mp4")
    script = ruta(f"{nombre}.filtro")
    open(script, "w").write(";\n".join(fc))
    cmd = ["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", f"{D:.3f}", "-i", fondo,
           "-i", musica(D, nombre)] + capas.inputs
    cmd += ["-filter_complex_script", script, "-map", "[vout]", "-map", "[aout]", "-t", f"{D:.3f}"]
    cmd += codificar_video() + codificar_audio() + [out]
    run(cmd)
    return out


def main():
    png_layout()

    D_INTRO, D_BUMP, D_OUTRO = 5.5, 2.6, 6.0
    durs_sec = [s["to"] - s["ss"] + 2 * PAD for s in SECCIONES]
    partes_dur = [D_INTRO]
    for d in durs_sec:
        partes_dur += [D_BUMP, d]
    partes_dur.append(D_OUTRO)
    total = sum(partes_dur) - XF * (len(partes_dur) - 1)

    # Inicio de cada parte en la línea de tiempo final (para la barra de progreso)
    inicios, t = [], 0.0
    for d in partes_dur:
        inicios.append(t)
        t += d - XF

    archivos = []
    # --- Portada
    fondo = fondo_desde_video(SECCIONES[0]["archivo"], 3.0, "intro")
    k1, h1 = png_centrado("VIDEO REFLEXIVO", font("Bold", 30), GOLD + (255,), "i_k", track=8)
    t1, ht = png_centrado("Mi experiencia uapiana", font("Black", 104), WHITE + (255,), "i_t")
    bar = png_barra("i_bar", 160, 7)
    s1, hs = png_centrado("Orientación a la Educación a Distancia Virtual  ·  Proyecto final",
                          font("Medium", 34), SOFT + (255,), "i_s")
    n1, hn = png_centrado(NOMBRE, font("Bold", 40), WHITE + (255,), "i_n")
    c1, hc = png_centrado(CARRERA, font("Medium", 30), GOLD + (255,), "i_c")
    yb = 330
    elementos = [
        (k1, 0, yb, 0.3, 30, "y"),
        (t1, 0, yb + 60, 0.6, 40, "y"),
        (bar, 0, yb + 60 + ht + 20, 1.0, 0, "x"),
        (s1, 0, yb + 60 + ht + 50, 1.2, 30, "y"),
        (n1, 0, 760, 1.8, 30, "y"),
        (c1, 0, 815, 2.1, 30, "y"),
    ]
    if SOLO in (None, "intro"):
        archivos.append(render_tarjeta("intro", fondo, elementos, D_INTRO, total, inicios[0]))
    else:
        archivos.append(ruta("intro.mp4"))

    for k, sec in enumerate(SECCIONES):
        # --- Separador de sección
        fondo = fondo_desde_video(sec["archivo"], sec["ss"] + 1.0, f"b{k}")
        num, hnum = png_centrado(sec["num"], font("Black", 190), GOLD + (255,), f"b{k}_n")
        tl = envolver(sec["titulo"], font("ExtraBold", 70), 1500)
        tit, htit = png_centrado(" ".join(tl) if len(tl) == 1 else sec["titulo"],
                                 font("ExtraBold", 70 if len(tl) == 1 else 58), WHITE + (255,), f"b{k}_t")
        bar = png_barra(f"b{k}_bar", 120, 6)
        yb = 300
        elementos = [
            (num, 0, yb, 0.15, 40, "y"),
            (bar, 0, yb + hnum + 10, 0.45, 0, "x"),
            (tit, 0, yb + hnum + 40, 0.35, 40, "y"),
        ]
        nombre_b = f"bump_{k}"
        if SOLO in (None, nombre_b):
            archivos.append(render_tarjeta(nombre_b, fondo, elementos, D_BUMP, total, inicios[1 + 2 * k]))
        else:
            archivos.append(ruta(f"{nombre_b}.mp4"))
        # --- Sección
        if SOLO in (None, f"sec_{k}"):
            out, _ = render_seccion(k, sec, total, inicios[2 + 2 * k])
        else:
            out = ruta(f"sec_{k}.mp4")
        archivos.append(out)

    # --- Cierre
    fondo = fondo_desde_video(SECCIONES[-1]["archivo"], 20.0, "outro")
    g1, hg = png_centrado("¡Muchas gracias!", font("Black", 110), WHITE + (255,), "o_t")
    bar = png_barra("o_bar", 160, 7)
    n1, hn = png_centrado(NOMBRE, font("Bold", 44), WHITE + (255,), "o_n")
    c1, hc = png_centrado(CARRERA, font("Medium", 32), GOLD + (255,), "o_c")
    l1, hl = png_centrado("Constanza, República Dominicana  ·  2026", font("Regular", 28), SOFT + (255,), "o_l")
    elementos = [
        (g1, 0, 330, 0.3, 40, "y"),
        (bar, 0, 330 + hg + 25, 0.7, 0, "x"),
        (n1, 0, 540, 0.9, 30, "y"),
        (c1, 0, 600, 1.2, 30, "y"),
        (l1, 0, 650, 1.5, 30, "y"),
    ]
    if SOLO in (None, "outro"):
        archivos.append(render_tarjeta("outro", fondo, elementos, D_OUTRO, total, inicios[-1], con_barra=True))
    else:
        archivos.append(ruta("outro.mp4"))

    if SOLO and SOLO != "unir":
        return

    # --- Unir todo con transiciones (video: fundido / deslizamiento; audio: crossfade)
    tipos = ["fade", "smoothleft", "fade", "smoothleft", "fade", "smoothleft", "fade",
             "smoothleft", "fade", "smoothleft", "fadeblack"]
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for a in archivos:
        cmd += ["-i", a]
    fc, va, aa, acum = [], "0:v", "0:a", partes_dur[0]
    for i in range(1, len(archivos)):
        off = acum - XF
        tipo = tipos[(i - 1) % len(tipos)]
        fc.append(f"[{va}][{i}:v]xfade=transition={tipo}:duration={XF}:offset={off:.3f}[xv{i}]")
        fc.append(f"[{aa}][{i}:a]acrossfade=d={XF}:c1=tri:c2=tri[xa{i}]")
        va, aa = f"xv{i}", f"xa{i}"
        acum = off + partes_dur[i]
    fc.append(f"[{va}]fade=t=in:d=0.6,fade=t=out:st={acum - 0.8:.3f}:d=0.8[vfin]")
    fc.append(f"[{aa}]afade=t=in:d=0.4,afade=t=out:st={acum - 0.8:.3f}:d=0.8[afin]")
    script = ruta("final.filtro")
    open(script, "w").write(";\n".join(fc))
    cmd += ["-filter_complex_script", script, "-map", "[vfin]", "-map", "[afin]"]
    cmd += codificar_video() + codificar_audio() + ["-movflags", "+faststart", SALIDA]
    run(cmd)
    print("TOTAL", round(acum, 2), "s")


main()
