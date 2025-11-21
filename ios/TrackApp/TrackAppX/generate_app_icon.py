#!/usr/bin/env python3
"""
Generate a simple placeholder app icon for TrackApp
Creates a blue background with a white flag/checkered flag symbol
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_app_icon(size=1024):
    """Create a simple app icon with a blue background and white 'T' or flag symbol"""

    # Create image with blue background
    # Using a nice track/racing blue color
    bg_color = (33, 150, 243)  # Material Blue
    img = Image.new('RGB', (size, size), bg_color)
    draw = ImageDraw.Draw(img)

    # Draw a simple checkered flag icon
    flag_color = (255, 255, 255)  # White
    pole_color = (60, 60, 60)  # Dark gray

    # Calculate dimensions
    flag_width = int(size * 0.5)
    flag_height = int(size * 0.35)
    square_size = flag_width // 5

    # Position flag in center-upper area
    flag_x = (size - flag_width) // 2
    flag_y = int(size * 0.25)

    # Draw checkered pattern (5x3 grid)
    for row in range(3):
        for col in range(5):
            # Checkered pattern
            if (row + col) % 2 == 0:
                x1 = flag_x + col * square_size
                y1 = flag_y + row * square_size
                x2 = x1 + square_size
                y2 = y1 + square_size
                draw.rectangle([x1, y1, x2, y2], fill=flag_color)

    # Draw flag pole
    pole_width = int(size * 0.03)
    pole_height = int(size * 0.5)
    pole_x = flag_x - pole_width
    pole_y = flag_y
    draw.rectangle(
        [pole_x, pole_y, pole_x + pole_width, pole_y + pole_height],
        fill=pole_color
    )

    # Draw shadow/depth effect
    shadow_offset = int(size * 0.015)
    draw.rectangle(
        [pole_x + pole_width, pole_y + shadow_offset,
         pole_x + pole_width + shadow_offset, pole_y + pole_height],
        fill=(0, 0, 0, 40)
    )

    return img

def main():
    # Create the icon
    print("🎨 Generating app icon...")
    icon = create_app_icon(1024)

    # Save to the AppIcon.appiconset directory
    output_dir = os.path.join(
        os.path.dirname(__file__),
        'TrackAppX',
        'Assets.xcassets',
        'AppIcon.appiconset'
    )

    output_path = os.path.join(output_dir, 'icon-1024.png')
    icon.save(output_path, 'PNG')
    print(f"✅ App icon saved to: {output_path}")

    print("📝 Icon features:")
    print("   - Blue background (racing theme)")
    print("   - White checkered flag (finish line symbol)")
    print("   - 1024x1024 resolution")
    print("\n💡 Remember to update Contents.json to reference this file!")

if __name__ == '__main__':
    main()
