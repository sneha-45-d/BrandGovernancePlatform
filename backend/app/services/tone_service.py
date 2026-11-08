import math
import re

ARCHETYPES = {
    "Trusted Advisor": {
        "dimensions": {"formality": 75, "warmth": 75, "confidence": 80, "urgency": 25, "technicality": 55},
        "description": "Authoritative yet deeply approachable; guides customers with empathy and proven expertise.",
        "icon": "shield-check"
    },
    "Bold Innovator": {
        "dimensions": {"formality": 50, "warmth": 55, "confidence": 92, "urgency": 55, "technicality": 70},
        "description": "Cutting-edge, disruptive, and visionary; inspires action with confident breakthroughs.",
        "icon": "zap"
    },
    "Warm Companion": {
        "dimensions": {"formality": 35, "warmth": 90, "confidence": 60, "urgency": 30, "technicality": 25},
        "description": "Friendly, relatable, and inclusive; creates an immediate human connection and emotional trust.",
        "icon": "heart"
    },
    "Professional Expert": {
        "dimensions": {"formality": 85, "warmth": 40, "confidence": 80, "urgency": 30, "technicality": 80},
        "description": "Rigorous, data-driven, and objective; speaks with executive clarity and deep domain depth.",
        "icon": "briefcase"
    },
    "Dynamic Challenger": {
        "dimensions": {"formality": 55, "warmth": 45, "confidence": 88, "urgency": 80, "technicality": 50},
        "description": "Energetic, urgent, and competitive; challenges the status quo and moves audiences to immediate change.",
        "icon": "flame"
    }
}

DIMENSION_KEYS = ["formality", "warmth", "confidence", "urgency", "technicality"]


def derive_target_tone(guidelines: dict) -> dict:
    preferred = ((guidelines or {}).get("preferred_tone") or "").lower()
    style = ((guidelines or {}).get("writing_style") or "").lower()
    combined = f"{preferred} {style}"

    # Default targets
    target = {
        "formality": 65,
        "warmth": 60,
        "confidence": 75,
        "urgency": 35,
        "technicality": 50
    }

    if any(w in combined for w in ["formal", "professional", "serious", "executive", "corporate"]):
        target["formality"] = min(95, target["formality"] + 20)
    if any(w in combined for w in ["casual", "playful", "friendly", "conversational", "relaxed"]):
        target["formality"] = max(20, target["formality"] - 30)

    if any(w in combined for w in ["warm", "empathetic", "caring", "friendly", "human", "inclusive"]):
        target["warmth"] = min(95, target["warmth"] + 25)
    if any(w in combined for w in ["objective", "direct", "matter-of-fact", "clinical", "neutral"]):
        target["warmth"] = max(25, target["warmth"] - 20)

    if any(w in combined for w in ["confident", "bold", "authoritative", "assertive", "strong"]):
        target["confidence"] = min(95, target["confidence"] + 15)
    if any(w in combined for w in ["humble", "modest", "understated", "gentle"]):
        target["confidence"] = max(40, target["confidence"] - 20)

    if any(w in combined for w in ["urgent", "action-oriented", "fast-paced", "direct", "high-energy"]):
        target["urgency"] = min(90, target["urgency"] + 30)
    if any(w in combined for w in ["calm", "patient", "reflective", "measured"]):
        target["urgency"] = max(15, target["urgency"] - 15)

    if any(w in combined for w in ["technical", "engineering", "precise", "data-driven", "scientific"]):
        target["technicality"] = min(95, target["technicality"] + 25)
    if any(w in combined for w in ["simple", "plain language", "accessible", "easy"]):
        target["technicality"] = max(20, target["technicality"] - 20)

    return target


def analyze_tone_local(content: str, guidelines: dict) -> dict:
    text = (content or "").strip()
    words = re.findall(r"\b[a-zA-Z']+\b", text.lower())
    total_words = max(len(words), 1)

    target = derive_target_tone(guidelines)

    # 1. Formality heuristic
    contractions = len(re.findall(r"\b(can't|won't|don't|it's|you're|we're|i'm|they're|couldn't|shouldn't)\b", text.lower()))
    formal_words = len(re.findall(r"\b(furthermore|moreover|consequently|therefore|demonstrates|utilize|established|substantial|comprehensive)\b", text.lower()))
    avg_word_len = sum(len(w) for w in words) / total_words
    formality = 50 + (avg_word_len - 4.5) * 12 + (formal_words * 5) - (contractions * 6)
    formality = max(10, min(95, round(formality)))

    # 2. Warmth heuristic
    warm_words = len(re.findall(r"\b(welcome|help|care|love|together|support|partner|community|friend|delighted|pleased|thank|inspire|share)\b", text.lower()))
    pronouns_warm = len(re.findall(r"\b(we|our|us|you|your)\b", text.lower()))
    warmth = 35 + (warm_words * 8) + min(25, (pronouns_warm / total_words) * 120)
    warmth = max(10, min(95, round(warmth)))

    # 3. Confidence heuristic
    confident_words = len(re.findall(r"\b(will|guarantee|proven|leading|definitely|excel|unmatched|secure|master|deliver|certainly|always)\b", text.lower()))
    hedge_words = len(re.findall(r"\b(maybe|perhaps|might|could|try|hopefully|somewhat|possibly)\b", text.lower()))
    confidence = 65 + (confident_words * 6) - (hedge_words * 8)
    confidence = max(20, min(98, round(confidence)))

    # 4. Urgency heuristic
    urgency_words = len(re.findall(r"\b(now|today|immediately|hurry|instant|instantly|fast|deadline|limited|quick|act|start)\b", text.lower()))
    exclamations = text.count("!")
    urgency = 25 + (urgency_words * 10) + (exclamations * 6)
    urgency = max(10, min(95, round(urgency)))

    # 5. Technicality heuristic
    tech_words = len(re.findall(r"\b(architecture|algorithm|governance|compliance|infrastructure|framework|pipeline|analytics|database|parameter|api|latency|security|automated)\b", text.lower()))
    long_words = sum(1 for w in words if len(w) >= 8)
    technicality = 30 + (tech_words * 8) + min(35, (long_words / total_words) * 80)
    technicality = max(15, min(95, round(technicality)))

    detected = {
        "formality": formality,
        "warmth": warmth,
        "confidence": confidence,
        "urgency": urgency,
        "technicality": technicality
    }

    # Find deviations
    deviations = []
    for dim in DIMENSION_KEYS:
        gap = detected[dim] - target[dim]
        if abs(gap) >= 15:
            direction = "higher" if gap > 0 else "lower"
            severity = "high" if abs(gap) >= 28 else "medium"
            suggestion = _generate_tone_suggestion(dim, gap)
            deviations.append({
                "dimension": dim,
                "gap": gap,
                "direction": direction,
                "severity": severity,
                "suggestion": suggestion
            })

    # Find closest archetype
    archetype_name, match_score = _match_archetype(detected)

    return {
        "detected": detected,
        "target": target,
        "deviations": deviations,
        "archetype": archetype_name,
        "archetype_description": ARCHETYPES[archetype_name]["description"],
        "archetype_match_score": match_score
    }


def _match_archetype(detected: dict) -> tuple[str, int]:
    best_name = "Professional Expert"
    min_dist = float("inf")

    for name, data in ARCHETYPES.items():
        dims = data["dimensions"]
        dist = math.sqrt(sum((detected.get(k, 50) - dims.get(k, 50)) ** 2 for k in DIMENSION_KEYS))
        if dist < min_dist:
            min_dist = dist
            best_name = name

    # max possible distance across 5 dimensions with 0-100 range is sqrt(5 * 100^2) ~ 223.6
    match_score = max(40, min(98, round(100 - (min_dist / 1.8))))
    return best_name, match_score


def _generate_tone_suggestion(dimension: str, gap: int) -> str:
    suggestions = {
        ("formality", True): "Tone is stiffer than targeted. Use clearer, conversational sentences and contractions.",
        ("formality", False): "Tone is too informal. Elevate phrasing to sound more authoritative and brand-appropriate.",
        ("warmth", True): "Tone is overly emotional. Ensure directness and clarity are preserved.",
        ("warmth", False): "Tone feels cold or clinical. Introduce empathetic vocabulary and acknowledge the reader's perspective.",
        ("confidence", True): "Phrasing may sound over-promising or aggressive. Balance bold claims with factual clarity.",
        ("confidence", False): "Tone contains hesitation or hedging words. Strengthen language with assertive, definitive verbs.",
        ("urgency", True): "Copy feels high-pressure or pushy. Soften urgency words to maintain brand trust and credibility.",
        ("urgency", False): "Lacks compelling energy. Add a clear, prompt call to action or timeline relevance.",
        ("technicality", True): "Dense with jargon. Simplify terms so non-technical audiences can easily grasp the message.",
        ("technicality", False): "Language is overly generic. Include specific product capabilities or concrete terminology."
    }
    return suggestions.get((dimension, gap > 0), f"Adjust {dimension} to better balance brand requirements.")

