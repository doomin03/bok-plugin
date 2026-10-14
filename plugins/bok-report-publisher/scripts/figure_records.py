"""Read WMF/EMF vector figures into raw drawing records (text, lines, fills) without rendering.

DOCX chart figures are vector metafiles: tick values, legend text, annotations, pen colours and
dash styles are stored exactly. Read them instead of guessing from a rasterised image.
"""
import struct

PEN_STYLE = {0: 'solid', 1: 'dash', 2: 'dot', 3: 'dashdot', 4: 'dashdotdot', 5: 'none'}


def rgb(value):
    return '#%02x%02x%02x' % (value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF)


class Canvas:
    """Object table + current pen/brush/font/text colour shared by WMF and EMF readers."""

    def __init__(self):
        self.objects, self.pen, self.brush, self.font = {}, None, None, None
        self.text_colour, self.window, self.records, self.pos = '#000000', None, [], (0, 0)

    def select(self, obj):
        kind = obj.get('kind') if obj else None
        if kind in ('pen', 'brush', 'font'):
            setattr(self, kind, obj)

    def text(self, x, y, value, width=None):
        if value.strip():
            self.records.append({'type': 'text', 'x': x, 'y': y, 'text': value.strip(), 'width': width,
                                 'colour': self.text_colour, 'font': dict(self.font or {})})

    def shape(self, kind, points):
        pen, brush = self.pen or {}, self.brush or {}
        self.records.append({'type': kind, 'points': points,
                             'stroke': None if pen.get('style') == 'none' else pen.get('colour'),
                             'dash': pen.get('style', 'solid'), 'width': pen.get('width', 1),
                             'fill': brush.get('colour') if brush.get('solid') else None})


def decode(raw, charset):
    # 글꼴 문자셋이 ANSI(0)로 잘못 적힌 한글 그림이 있어 cp949 를 먼저 시도한다
    for codec in ('cp949', 'cp1252', 'latin-1'):
        try:
            return raw.decode(codec)
        except UnicodeDecodeError:
            continue
    return ''


def _store(canvas, obj):
    slot = 0
    while slot in canvas.objects:
        slot += 1
    canvas.objects[slot] = obj


def read_wmf(data):
    """Return (records, window) from a WMF byte string (placeable header optional)."""
    c, i = Canvas(), (22 if data[:4] == b'\xd7\xcd\xc6\x9a' else 0)
    lead = None
    i += struct.unpack_from('<H', data, i + 2)[0] * 2  # header size in words
    while i + 6 <= len(data):
        size, fn = struct.unpack_from('<IH', data, i)
        if size < 3 or fn == 0:
            break
        p, h = i + 6, lambda fmt, off=0: struct.unpack_from(fmt, data, i + 6 + off)
        if fn == 0x02FA:
            style, width, _, colour = h('<HhhI')
            _store(c, {'kind': 'pen', 'style': PEN_STYLE.get(style & 0xF, 'solid'), 'width': max(1, width), 'colour': rgb(colour)})
        elif fn == 0x02FC:
            style, colour = h('<HI')
            _store(c, {'kind': 'brush', 'solid': style == 0, 'colour': rgb(colour)})
        elif fn == 0x02FB:
            height, _, _, _, weight, _, _, _, charset = h('<hhhhhBBBB')
            face = data[p + 18:p + 50].split(b'\0')[0]
            _store(c, {'kind': 'font', 'size': abs(height), 'weight': weight, 'charset': charset, 'face': decode(face, charset),
                       'vertical': face.startswith(b'@')})
        elif fn in (0x00F7, 0x0142, 0x01F9, 0x06FF):
            _store(c, {'kind': 'other'})
        elif fn == 0x012D:
            c.select(c.objects.get(h('<H')[0]))
        elif fn == 0x01F0:
            c.objects.pop(h('<H')[0], None)
        elif fn == 0x0209:
            c.text_colour = rgb(h('<I')[0])
        elif fn == 0x020C:
            ey, ex = h('<hh'); c.window = (c.window or (0, 0, 0, 0))[:2] + (ex, ey)
        elif fn == 0x020B:
            oy, ox = h('<hh'); c.window = (ox, oy) + (c.window or (0, 0, 0, 0))[2:]
        elif fn == 0x0A32:
            y, x, n, opts = h('<hhhH'); off = 8 + (8 if opts & 0x0006 else 0)
            dx = off + n + (n & 1)  # per-character advances follow the padded string
            width = sum(h('<%dh' % n, dx)) if n and 6 + dx + 2 * n <= size * 2 else None
            raw, charset = data[p + off:p + off + n], (c.font or {}).get('charset', 129)
            # 세로쓰기 글꼴(@HY중고딕)은 한글 한 글자를 1바이트씩 두 레코드로 나눠 쓴다: 앞 바이트를 붙여 읽는다
            if lead:
                raw, (x, y), lead = lead[0] + raw, lead[1], None
            elif n == 1 and 0x81 <= raw[0] <= 0xFE and charset in (0, 129):
                lead = (raw, (x, y)); i += size * 2; continue
            c.text(x, y, decode(raw, charset), width)
        elif fn == 0x0521:
            n = h('<h')[0]; y, x = h('<hh', 2 + n + (n & 1))
            c.text(x, y, decode(data[p + 2:p + 2 + n], (c.font or {}).get('charset', 129)))
        elif fn in (0x0325, 0x0324):
            n = h('<h')[0]; pts = [h('<hh', 2 + 4 * k) for k in range(n)]
            c.shape('polyline' if fn == 0x0325 else 'polygon', pts)
        elif fn == 0x0538:
            n = h('<H')[0]; counts = [h('<H', 2 + 2 * k)[0] for k in range(n)]; off = 2 + 2 * n
            for cnt in counts:
                c.shape('polygon', [h('<hh', off + 4 * k) for k in range(cnt)]); off += 4 * cnt
        elif fn in (0x041B, 0x0418):
            b, r, t, l = h('<hhhh')
            c.shape('rect' if fn == 0x041B else 'ellipse', [(l, t), (r, t), (r, b), (l, b)])
        elif fn == 0x0214:
            y, x = h('<hh'); c.pos = (x, y)
        elif fn == 0x0213:
            y, x = h('<hh'); c.shape('polyline', [c.pos, (x, y)]); c.pos = (x, y)
        i += size * 2
    return c.records, c.window


STOCK = {0x80000000: {'kind': 'brush', 'solid': True, 'colour': '#ffffff'}, 0x80000004: {'kind': 'brush', 'solid': True, 'colour': '#000000'},
         0x80000005: {'kind': 'brush', 'solid': False}, 0x80000007: {'kind': 'pen', 'style': 'solid', 'width': 1, 'colour': '#000000'},
         0x80000008: {'kind': 'pen', 'style': 'none'}}


def read_emf(data):
    """Return (records, window) from an EMF byte string (core GDI records only)."""
    c, i, org, ext = Canvas(), 0, (0, 0), None
    while i + 8 <= len(data):
        typ, size = struct.unpack_from('<II', data, i)
        if size < 8:
            break
        u = lambda fmt, off: struct.unpack_from(fmt, data, i + off)
        if typ == 38:
            ih, style, width, _, colour = u('<IIiiI', 8); c.objects[ih] = {'kind': 'pen', 'style': PEN_STYLE.get(style & 0xF, 'solid'), 'width': max(1, width), 'colour': rgb(colour)}
        elif typ == 95:
            ih = u('<I', 8)[0]; style, width, _, colour = u('<IIII', 28)
            c.objects[ih] = {'kind': 'pen', 'style': PEN_STYLE.get(style & 0xF, 'solid'), 'width': max(1, width), 'colour': rgb(colour)}
        elif typ == 39:
            ih, style, colour = u('<III', 8); c.objects[ih] = {'kind': 'brush', 'solid': style == 0, 'colour': rgb(colour)}
        elif typ == 82:
            ih, height = u('<Ii', 8); weight = u('<i', 28)[0]; face = data[i + 40:i + 104].decode('utf-16le', 'ignore').split('\0')[0]
            c.objects[ih] = {'kind': 'font', 'size': abs(height), 'weight': weight, 'charset': 1, 'face': face}
        elif typ == 37:
            ih = u('<I', 8)[0]; c.select(STOCK.get(ih) or c.objects.get(ih))
        elif typ == 40:
            c.objects.pop(u('<I', 8)[0], None)
        elif typ == 24:
            c.text_colour = rgb(u('<I', 8)[0])
        elif typ == 9:
            ext = u('<ii', 8)
        elif typ == 10:
            org = u('<ii', 8)
        elif typ == 84:
            x, y, n, off = u('<iiII', 36); odx = u('<I', 72)[0]
            width = sum(u('<%dI' % n, odx)) if n and odx and odx + 4 * n <= size else None
            c.text(x, y, data[i + off:i + off + 2 * n].decode('utf-16le', 'ignore'), width)
        elif typ in (85, 86, 87, 89):
            n = u('<I', 24)[0]; pts = [u('<hh', 28 + 4 * k) for k in range(n)]
            c.shape('polygon' if typ == 86 else 'polyline', pts)
        elif typ in (3, 4):
            n = u('<I', 24)[0]; pts = [u('<ii', 28 + 8 * k) for k in range(n)]
            c.shape('polygon' if typ == 3 else 'polyline', pts)
        elif typ in (90, 91):
            npoly = u('<I', 24)[0]; counts = [u('<I', 32 + 4 * k)[0] for k in range(npoly)]; off = 32 + 4 * npoly
            for cnt in counts:
                c.shape('polygon' if typ == 91 else 'polyline', [u('<hh', off + 4 * k) for k in range(cnt)]); off += 4 * cnt
        elif typ in (42, 43):
            l, t, r, b = u('<iiii', 8); c.shape('rect' if typ == 43 else 'ellipse', [(l, t), (r, t), (r, b), (l, b)])
        elif typ == 27:
            c.pos = u('<ii', 8)
        elif typ == 54:
            p = u('<ii', 8); c.shape('polyline', [c.pos, p]); c.pos = p
        elif typ == 14:
            break
        i += size
    return c.records, (org + ext) if ext else None
