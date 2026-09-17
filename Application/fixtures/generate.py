"""Regenerate small, local media used by the renderer Storybook stories."""

from pathlib import Path
import math
import struct
import subprocess
import wave
import zlib


ROOT = Path(__file__).parent


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))


width, height = 160, 96
rows = []
for y in range(height):
    row = bytearray([0])
    for x in range(width):
        row.extend((50 + x // 2, 95 + y, 155, 255))
    rows.append(bytes(row))
png = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
png += png_chunk(b"IDAT", zlib.compress(b"".join(rows))) + png_chunk(b"IEND", b"")
(ROOT / "preview.png").write_bytes(png)

with wave.open(str(ROOT / "preview.wav"), "wb") as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(16000)
    samples = [int(5000 * math.sin(2 * math.pi * 440 * index / 16000)) for index in range(16000)]
    audio.writeframes(struct.pack("<" + "h" * len(samples), *samples))

pdf_stream = b"BT /F1 18 Tf 30 120 Td (Local PDF preview) Tj ET"
objects = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    f"<< /Length {len(pdf_stream)} >>\nstream\n".encode() + pdf_stream + b"\nendstream",
    b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
]
pdf = bytearray(b"%PDF-1.4\n")
offsets = [0]
for index, item in enumerate(objects, 1):
    offsets.append(len(pdf))
    pdf.extend(f"{index} 0 obj\n".encode() + item + b"\nendobj\n")
start = len(pdf)
pdf.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
for offset in offsets[1:]:
    pdf.extend(f"{offset:010d} 00000 n \n".encode())
pdf.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode())
(ROOT / "preview.pdf").write_bytes(pdf)

try:
    import imageio_ffmpeg

    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-f", "lavfi", "-i", "color=c=#4b6b8b:s=320x180:d=2",
        "-c:v", "mpeg4", "-pix_fmt", "yuv420p", "-an", str(ROOT / "preview.mp4")
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
except ImportError:
    print("Install imageio-ffmpeg to regenerate preview.mp4")
