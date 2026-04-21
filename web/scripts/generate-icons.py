"""Generate PWA icons as simple PNG files using PIL."""
import sys
try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow not installed, generating placeholder icons")
    # Create minimal valid PNG files as placeholders
    import struct, zlib

    def create_png(size, path):
        """Create a simple solid-color PNG."""
        bg = (129, 182, 76)  # accent green
        width = height = size
        raw = b''
        for y in range(height):
            raw += b'\x00'  # filter byte
            for x in range(width):
                raw += bytes(bg)
        compressed = zlib.compress(raw)

        def chunk(ctype, data):
            c = ctype + data
            crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
            return struct.pack('>I', len(data)) + c + crc

        header = b'\x89PNG\r\n\x1a\n'
        ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
        png = header + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
        with open(path, 'wb') as f:
            f.write(png)
        print(f"Created {path} ({size}x{size})")

    create_png(192, 'public/icons/icon-192.png')
    create_png(512, 'public/icons/icon-512.png')
    sys.exit(0)

# If PIL is available, make nicer icons
for size in [192, 512]:
    img = Image.new('RGB', (size, size), (38, 36, 33))
    draw = ImageDraw.Draw(img)
    # Green circle
    margin = size // 8
    draw.ellipse([margin, margin, size - margin, size - margin], fill=(129, 182, 76))
    # Chess knight silhouette (simplified)
    cx, cy = size // 2, size // 2
    s = size // 6
    draw.polygon([
        (cx - s, cy + s),
        (cx - s, cy - s),
        (cx, cy - s * 1.5),
        (cx + s * 0.5, cy - s),
        (cx + s, cy),
        (cx + s, cy + s),
    ], fill=(38, 36, 33))
    path = f'public/icons/icon-{size}.png'
    img.save(path)
    print(f"Created {path} ({size}x{size})")
