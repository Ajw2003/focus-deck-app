from PIL import Image, ImageDraw

def make_icon(path, size, maskable=False):
    """Generate a compass rose icon with white lines on accent blue background."""
    img = Image.new('RGB', (size, size), '#3D5A80')
    draw = ImageDraw.Draw(img)

    # For maskable icons, use 20% padding; for regular icons, use 16% padding
    padding_factor = 0.2 if maskable else 0.16
    center = size / 2
    outer_radius = (size / 2) * (1 - padding_factor)
    inner_radius = outer_radius * 0.4
    needle_length = outer_radius * 0.7

    # Draw outer circle (compass rose boundary)
    circle_margin = outer_radius * 0.05
    draw.ellipse(
        [center - outer_radius, center - outer_radius,
         center + outer_radius, center + outer_radius],
        outline='white',
        width=max(1, int(size / 256))  # Scale line width
    )

    # Draw cardinal direction lines (N, S, E, W)
    line_width = max(1, int(size / 128))

    # North line (top)
    draw.line(
        [(center, center - outer_radius), (center, center - inner_radius)],
        fill='white',
        width=line_width
    )

    # South line (bottom)
    draw.line(
        [(center, center + outer_radius), (center, center + inner_radius)],
        fill='white',
        width=line_width
    )

    # East line (right)
    draw.line(
        [(center + outer_radius, center), (center + inner_radius, center)],
        fill='white',
        width=line_width
    )

    # West line (left)
    draw.line(
        [(center - outer_radius, center), (center - inner_radius, center)],
        fill='white',
        width=line_width
    )

    # Draw compass needle (north arrow) - diamond/arrow shape pointing up
    needle_tip = center - needle_length
    needle_base = center - inner_radius * 0.8
    needle_width = inner_radius * 0.3

    # Draw a diamond needle shape
    points = [
        (center, needle_tip),  # tip (north)
        (center + needle_width, needle_base),  # right
        (center, center - inner_radius * 0.3),  # center
        (center - needle_width, needle_base),  # left
    ]
    draw.polygon(points, fill='white')

    img.save(path)

make_icon('icons/icon-192.png', 192)
make_icon('icons/icon-512.png', 512)
make_icon('icons/icon-maskable-512.png', 512, maskable=True)
