#!/usr/bin/env python3
"""
Glow Asset Generator
====================
Este script toma una imagen de entrada y genera de manera automatizada todos los formatos,
resoluciones y tamaños de favicon, logos y assets PWA necesarios para el proyecto frontend Glow.

RECOMENDACIONES PARA LA IMAGEN DE PARTIDA (IDEAL SOURCE IMAGE):
---------------------------------------------------------------
1. FORMATO: PNG con fondo transparente (.png de modo RGBA). Esto permite que el logotipo se
   integre perfectamente tanto en fondos claros como oscuros sin recuadros feos de fondo.
2. RESOLUCIÓN: Alta resolución (mínimo 512x512 píxeles, recomendado 1024x1024 píxeles).
   Las imágenes de alta resolución garantizan que el escalado hacia abajo (a 16x16 o 32x32)
   sea nítido y libre de artefactos.
3. COMPOSICIÓN: Diseño centrado y con suficiente margen. Al hacer la imagen cuadrada,
   el script añadirá márgenes transparentes (o de color) en los lados más cortos. Si el diseño
   está bien centrado, el resultado final lucirá perfectamente equilibrado.
"""
import os
import sys
import argparse
from PIL import Image

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Glow Asset Generator: Genera favicons, logos e iconos de manifest PWA a partir de una imagen.\n\n"
            "ESPECIFICACIONES DE IMAGEN RECOMENDADAS:\n"
            "  * Formato: PNG con fondo transparente (.png RGBA)\n"
            "  * Resolución: Alta resolución (ej. 1024x1024 px)\n"
            "  * Composición: Elementos visuales principales centrados"
        ),
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("image_path", help="Ruta de la imagen de origen (PNG, JPG, WEBP, etc.)")
    parser.add_argument(
        "--bg", 
        help="Color de fondo de relleno personalizado. Formato: HEX (#0E081B) o RGB (14,8,27).\nSi no se define, se autodetecta del píxel de la esquina."
    )
    parser.add_argument(
        "--transparent", 
        action="store_true", 
        help="Fuerza a que los márgenes de relleno sean transparentes (canal alfa = 0)."
    )
    
    args = parser.parse_args()
    
    input_path = os.path.abspath(args.image_path)
    if not os.path.exists(input_path):
        print(f"Error: Source image not found at {input_path}")
        sys.exit(1)

    # Convert SVG if detected
    is_svg = input_path.lower().endswith('.svg')
    temp_png_path = None
    if is_svg:
        temp_png_path = input_path + ".temp.png"
        print(f"SVG input detected. Rendering SVG to temporary PNG using macOS sips...")
        import subprocess
        try:
            subprocess.run(["sips", "-s", "format", "png", input_path, "--out", temp_png_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            # Use the rendered PNG as input
            input_path = temp_png_path
        except Exception as e:
            print(f"Error rendering SVG with sips: {e}")
            sys.exit(1)
        
    # Determine base directories relative to script location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    web_dir = os.path.dirname(script_dir)
    app_dir = os.path.join(web_dir, "app")
    public_dir = os.path.join(web_dir, "public")
    
    print(f"Processing source image: {input_path}")
    
    try:
        original = Image.open(input_path)
    except Exception as e:
        print(f"Error opening image: {e}")
        sys.exit(1)
        
    w, h = original.size
    print(f"Original dimensions: {w}x{h} ({original.format}, mode={original.mode})")
    
    # Determine background color for padding
    if args.transparent:
        bg_color = (0, 0, 0, 0)
        print("Using transparent background for padding.")
    elif args.bg:
        try:
            bg_color = parse_color(args.bg)
            print(f"Using custom background color: {bg_color}")
        except Exception as e:
            print(f"Error parsing custom background color: {e}")
            sys.exit(1)
    else:
        # Auto-detect corner pixel color
        try:
            corner_pixel = original.getpixel((0, 0))
            # Handle grayscale, RGB or RGBA modes
            if isinstance(corner_pixel, int):
                # Grayscale
                bg_color = (corner_pixel, corner_pixel, corner_pixel, 255)
            elif len(corner_pixel) == 3:
                bg_color = corner_pixel + (255,)
            elif len(corner_pixel) == 4:
                # If corner is transparent/semi-transparent, use transparency
                if corner_pixel[3] < 128:
                    bg_color = (0, 0, 0, 0)
                else:
                    bg_color = corner_pixel
            else:
                bg_color = (0, 0, 0, 255)
        except Exception:
            bg_color = (0, 0, 0, 255)
            
        if bg_color == (0, 0, 0, 0):
            print("Auto-detected transparent/semi-transparent corner. Padding with transparency.")
        else:
            print(f"Auto-detected corner background color: {bg_color}")
            
    # Create the squared image
    square_size = max(w, h)
    squared = Image.new("RGBA", (square_size, square_size), bg_color)
    
    # Paste the original centered
    offset_x = (square_size - w) // 2
    offset_y = (square_size - h) // 2
    
    # If the original has transparency, paste using it as mask
    if original.mode in ("RGBA", "LA") or (original.mode == "P" and "transparency" in original.info):
        squared.paste(original, (offset_x, offset_y), original.convert("RGBA"))
    else:
        squared.paste(original, (offset_x, offset_y))
        
    print(f"Squared image created: {square_size}x{square_size}")
    
    # Ensure folders exist
    os.makedirs(app_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)
    
    # Define targets
    targets = [
        # (output_path, width, height, format, optional_extra_args)
        (os.path.join(app_dir, "favicon.ico"), 32, 32, "ICO"),
        (os.path.join(app_dir, "icon.png"), 512, 512, "PNG"),
        (os.path.join(app_dir, "apple-icon.png"), 180, 180, "PNG"),
        (os.path.join(public_dir, "icon-192.png"), 192, 192, "PNG"),
        (os.path.join(public_dir, "icon-512.png"), 512, 512, "PNG"),
        (os.path.join(public_dir, "logo.png"), 512, 512, "PNG"),
    ]
    
    # Generate standard squared sizes
    for path, width, height, fmt in targets:
        try:
            resized = squared.resize((width, height), Image.Resampling.LANCZOS)
            if fmt == "ICO":
                # Save as ICO containing both 16x16 and 32x32 sizes
                resized.save(path, format="ICO", sizes=[(16, 16), (32, 32)])
            else:
                resized.save(path, format=fmt)
            print(f"✓ Saved {os.path.basename(path)} ({width}x{height})")
        except Exception as e:
            print(f"✗ Failed to save {os.path.basename(path)}: {e}")
            
    # Save optimized original landscape version
    try:
        logo_wide_path = os.path.join(public_dir, "logo-wide.png")
        original.save(logo_wide_path, format="PNG")
        print(f"✓ Saved logo-wide.png ({w}x{h})")
    except Exception as e:
        print(f"✗ Failed to save logo-wide.png: {e}")
        
    # Clean up temporary PNG if we created one
    if temp_png_path and os.path.exists(temp_png_path):
        try:
            os.remove(temp_png_path)
        except Exception:
            pass
            
    print("\nAll assets successfully generated!")

def parse_color(color_str):
    color_str = color_str.strip()
    if color_str.startswith('#'):
        h = color_str.lstrip('#')
        if len(h) == 3:
            h = ''.join([c*2 for c in h])
        rgb = tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
        return rgb + (255,)
    else:
        parts = [int(x.strip()) for x in color_str.split(',')]
        if len(parts) == 3:
            return tuple(parts) + (255,)
        elif len(parts) == 4:
            return tuple(parts)
    raise ValueError("Color must be hex (#FFF or #FFFFFF) or RGB/A (R,G,B[,A])")

if __name__ == "__main__":
    main()
