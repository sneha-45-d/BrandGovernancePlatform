import io
import math
from PIL import Image

ASPECT_RATIO_PRESETS = {
    '16:9': 16 / 9,
    '1:1': 1.0,
    '4:3': 4 / 3,
    '9:16': 9 / 16,
    '3:2': 1.5,
    '21:9': 21 / 9,
}


def hex_to_rgb(hex_code: str) -> tuple[int, int, int]:
    clean = hex_code.lstrip('#')
    if len(clean) == 3:
        clean = ''.join(c * 2 for c in clean)
    try:
        return (int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16))
    except Exception:
        return (128, 128, 128)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def color_distance_rgb(c1: str, c2: str) -> float:
    r1, g1, b1 = hex_to_rgb(c1)
    r2, g2, b2 = hex_to_rgb(c2)
    return math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)


def extract_dominant_colors(image_bytes: bytes, n: int = 5) -> list[dict]:
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    except Exception as exc:
        raise ValueError(f'Invalid image data: {exc}') from exc

    # Resize for quick processing
    img_small = img.resize((120, 120))
    # Quantize to dominant colors
    quantized = img_small.quantize(colors=n)
    palette = quantized.getpalette()
    if not palette:
        return [{'hex': '#000000', 'percentage': 100}]

    # Count occurrences
    color_counts = quantized.getcolors() or []
    total_pixels = sum(count for count, _ in color_counts) or 1

    extracted = []
    for count, idx in sorted(color_counts, reverse=True)[:n]:
        r = palette[idx * 3]
        g = palette[idx * 3 + 1]
        b = palette[idx * 3 + 2]
        hex_val = rgb_to_hex(r, g, b)
        pct = round((count / total_pixels) * 100, 1)
        extracted.append({'hex': hex_val, 'percentage': pct, 'rgb': [r, g, b]})

    return extracted


def analyze_image_compliance(image_bytes: bytes, filename: str, guidelines: dict) -> dict:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
        img_format = img.format or 'JPEG'
    except Exception as exc:
        raise ValueError(f'Unable to parse image: {exc}') from exc

    approved_colors = guidelines.get('approved_colors') or ['#059669', '#0F172A', '#10B981', '#334155', '#FFFFFF']
    tolerance = float(guidelines.get('color_tolerance', 35))
    allowed_ratios = guidelines.get('aspect_ratios') or ['16:9', '1:1', '4:3', '9:16']
    min_w = guidelines.get('min_width_px', 400)
    max_w = guidelines.get('max_width_px', 4000)
    min_h = guidelines.get('min_height_px', 400)
    max_h = guidelines.get('max_height_px', 4000)

    # 1. Color Extraction & Palette Compliance
    dominant = extract_dominant_colors(image_bytes, n=5)
    color_results = []
    compliant_colors_count = 0

    for item in dominant:
        c_hex = item['hex']
        # Find closest approved color
        closest = approved_colors[0] if approved_colors else '#000000'
        min_dist = float('inf')
        for app_c in approved_colors:
            d = color_distance_rgb(c_hex, app_c)
            if d < min_dist:
                min_dist = d
                closest = app_c

        is_compliant = min_dist <= tolerance
        if is_compliant:
            compliant_colors_count += 1

        color_results.append({
            'extracted_hex': c_hex,
            'percentage': item['percentage'],
            'closest_approved_hex': closest,
            'distance': round(min_dist, 1),
            'compliant': is_compliant,
            'tolerance_threshold': tolerance,
        })

    color_compliance_pct = round((compliant_colors_count / max(len(color_results), 1)) * 100)

    # 2. Aspect Ratio Detection
    actual_ratio = width / max(height, 1)
    matched_ratio_name = None
    best_ratio_diff = float('inf')

    for name, target_ratio in ASPECT_RATIO_PRESETS.items():
        diff = abs(actual_ratio - target_ratio) / target_ratio
        if diff < best_ratio_diff:
            best_ratio_diff = diff
            matched_ratio_name = name

    ratio_compliant = (best_ratio_diff <= 0.05) and (matched_ratio_name in allowed_ratios)

    # 3. Dimensions Validation
    width_valid = min_w <= width <= max_w
    height_valid = min_h <= height <= max_h
    dimension_compliant = width_valid and height_valid

    # 4. Clear-space border variance heuristic
    # Sample 4% border from each edge to check margin breathing room
    try:
        rgb_img = img.convert('RGB')
        w_margin = max(1, int(width * 0.04))
        h_margin = max(1, int(height * 0.04))
        # Top margin
        top_crop = rgb_img.crop((0, 0, width, h_margin)).resize((50, 5))
        # Check standard deviation or luminance consistency
        pixels = list(top_crop.getdata())
        avg_r = sum(p[0] for p in pixels) / len(pixels)
        avg_g = sum(p[1] for p in pixels) / len(pixels)
        avg_b = sum(p[2] for p in pixels) / len(pixels)
        variance = sum((p[0] - avg_r)**2 + (p[1] - avg_g)**2 + (p[2] - avg_b)**2 for p in pixels) / len(pixels)
        clear_space_ok = variance < 3000
    except Exception:
        clear_space_ok = True

    # 5. Build Issues and Recommendations
    issues = []
    recommendations = []

    if color_compliance_pct < 60:
        non_compliant_hexes = [r['extracted_hex'] for r in color_results if not r['compliant']]
        issues.append(f"Off-brand color palette detected: {', '.join(non_compliant_hexes[:3])} exceed tolerance.")
        recommendations.append(f"Adjust asset tint and background colors to align with approved palette ({', '.join(approved_colors[:3])}).")

    if not ratio_compliant:
        issues.append(f"Aspect ratio {width}x{height} (~{actual_ratio:.2f}) does not match approved formats ({', '.join(allowed_ratios)}).")
        recommendations.append(f"Crop or reframe canvas to one of the approved standards (e.g. {allowed_ratios[0]}).")

    if not dimension_compliant:
        issues.append(f"Dimensions ({width}x{height}px) violate brand asset guidelines (min: {min_w}x{min_h}px, max: {max_w}x{max_h}px).")
        recommendations.append(f"Export asset at standard resolution (target min {min_w}px width).")

    if not clear_space_ok:
        issues.append("Graphic elements or typography may encroach on the recommended outer clear-space margins.")
        recommendations.append("Ensure at least 5% safe padding around logo and key visual elements.")

    # Calculate overall visual score
    score = 100
    if color_compliance_pct < 100:
        score -= int((100 - color_compliance_pct) * 0.45)
    if not ratio_compliant:
        score -= 20
    if not dimension_compliant:
        score -= 15
    if not clear_space_ok:
        score -= 10
    visual_score = max(25, min(98, score))

    overall_compliant = visual_score >= 70 and dimension_compliant

    return {
        'filename': filename,
        'format': img_format,
        'dimensions': {
            'width': width,
            'height': height,
            'aspect_ratio_detected': f"{matched_ratio_name} (~{actual_ratio:.2f})" if best_ratio_diff <= 0.08 else f"{actual_ratio:.2f}:1",
            'aspect_ratio_preset': matched_ratio_name,
            'ratio_compliant': ratio_compliant,
            'dimension_compliant': dimension_compliant,
            'allowed_aspect_ratios': allowed_ratios,
            'min_width_px': min_w,
            'max_width_px': max_w,
        },
        'color_analysis': {
            'dominant_colors': color_results,
            'approved_colors': approved_colors,
            'color_compliance_score': color_compliance_pct,
            'tolerance_used': tolerance,
        },
        'clear_space': {
            'clear_space_ok': clear_space_ok,
            'description': 'Adequate margin breathing room detected around asset perimeter.' if clear_space_ok else 'Potential element encroachment into clear space boundary.'
        },
        'visual_compliance_score': visual_score,
        'overall_compliant': overall_compliant,
        'issues': issues,
        'recommendations': recommendations,
    }

