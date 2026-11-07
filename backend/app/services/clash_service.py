from difflib import SequenceMatcher
import re


def _normalize(text: str) -> str:
    return re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower()).strip()


def fuzzy_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


def check_competitor_clashes(content: str, competitors: list[dict], threshold: float = 0.65) -> dict:
    if not content or not competitors:
        return {
            'has_clashes': False,
            'risk_level': 'none',
            'clashes': [],
            'summary': 'No competitor IP conflicts detected.',
        }

    clashes = []
    content_clean = content.strip()
    sentences = re.split(r'[.!?\n]+', content_clean)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 3]

    normalized_content = _normalize(content)

    for comp in competitors:
        comp_name = comp.get('name', 'Competitor')
        slogans = comp.get('slogans') or []
        keywords = comp.get('keywords') or []

        # 1. Check brand name mention
        norm_comp_name = _normalize(comp_name)
        if norm_comp_name and re.search(r'\b' + re.escape(norm_comp_name) + r'\b', normalized_content):
            clashes.append({
                'competitor': comp_name,
                'clash_type': 'direct_brand_mention',
                'matched_text': comp_name,
                'similarity': 100.0,
                'severity': 'high',
                'context': f"Direct mention of competitor brand name '{comp_name}' in marketing copy.",
                'recommendation': f"Remove direct reference to '{comp_name}' unless explicit comparative advertising is legally cleared.",
            })

        # 2. Check slogan clashes (exact & fuzzy)
        for slogan in slogans:
            slogan_clean = slogan.strip()
            if not slogan_clean:
                continue

            norm_slogan = _normalize(slogan_clean)
            if not norm_slogan:
                continue

            # Exact phrase match in content
            if norm_slogan in normalized_content:
                clashes.append({
                    'competitor': comp_name,
                    'clash_type': 'exact_slogan_match',
                    'matched_text': slogan_clean,
                    'similarity': 100.0,
                    'severity': 'high',
                    'context': f"Exact match with trademarked slogan: '{slogan_clean}'",
                    'recommendation': f"Rewrite copy immediately to avoid infringement on '{comp_name}' trademarked slogan.",
                })
                continue

            # Check sentence-level fuzzy similarity
            best_sentence = None
            best_sim = 0.0
            for sent in sentences:
                sim = fuzzy_similarity(sent, slogan_clean)
                if sim > best_sim:
                    best_sim = sim
                    best_sentence = sent

            # Also check sliding window across words if sentence is long
            words = content_clean.split()
            slogan_word_count = len(slogan_clean.split())
            if slogan_word_count > 1 and len(words) >= slogan_word_count:
                for i in range(len(words) - slogan_word_count + 1):
                    window = ' '.join(words[i:i + slogan_word_count + 1])
                    window_sim = fuzzy_similarity(window, slogan_clean)
                    if window_sim > best_sim:
                        best_sim = window_sim
                        best_sentence = window

            if best_sim >= threshold:
                severity = 'high' if best_sim >= 0.85 else 'medium'
                clashes.append({
                    'competitor': comp_name,
                    'clash_type': 'fuzzy_slogan_collision',
                    'matched_text': slogan_clean,
                    'detected_phrase': best_sentence,
                    'similarity': round(best_sim * 100, 1),
                    'severity': severity,
                    'context': f"Phrase '{best_sentence}' has {round(best_sim * 100, 1)}% similarity to '{comp_name}' slogan: '{slogan_clean}'",
                    'recommendation': f"Rephrase '{best_sentence}' to differentiate your positioning from '{comp_name}'.",
                })

        # 3. Check proprietary keywords
        matched_keywords = []
        for kw in keywords:
            kw_clean = kw.strip()
            if not kw_clean:
                continue
            norm_kw = _normalize(kw_clean)
            if norm_kw and re.search(r'\b' + re.escape(norm_kw) + r'\b', normalized_content):
                matched_keywords.append(kw_clean)

        if len(matched_keywords) >= 2:
            clashes.append({
                'competitor': comp_name,
                'clash_type': 'proprietary_keyword_cluster',
                'matched_text': ', '.join(matched_keywords),
                'similarity': 80.0,
                'severity': 'medium',
                'context': f"Multiple proprietary competitor keywords detected: {', '.join(matched_keywords)}",
                'recommendation': f"Verify if terms ({', '.join(matched_keywords)}) are distinctive to '{comp_name}' market positioning.",
            })
        elif len(matched_keywords) == 1:
            clashes.append({
                'competitor': comp_name,
                'clash_type': 'keyword_collision',
                'matched_text': matched_keywords[0],
                'similarity': 65.0,
                'severity': 'low',
                'context': f"Detected competitor term: '{matched_keywords[0]}'",
                'recommendation': f"Ensure use of '{matched_keywords[0]}' does not cause market confusion with '{comp_name}'.",
            })

    # Deduplicate clashes by matched_text & competitor
    seen = set()
    deduped_clashes = []
    for c in clashes:
        key = (c['competitor'], c['matched_text'])
        if key not in seen:
            seen.add(key)
            deduped_clashes.append(c)

    has_clashes = len(deduped_clashes) > 0
    if not has_clashes:
        risk_level = 'none'
        summary = 'No competitor slogans, trademarks, or positioning conflicts detected.'
    elif any(c['severity'] == 'high' for c in deduped_clashes):
        risk_level = 'high'
        summary = f"High competitor IP clash risk: {len(deduped_clashes)} critical collision(s) detected with registered competitor messaging."
    elif any(c['severity'] == 'medium' for c in deduped_clashes):
        risk_level = 'medium'
        summary = f"Moderate competitor clash risk: {len(deduped_clashes)} messaging or keyword overlap(s) found."
    else:
        risk_level = 'low'
        summary = f"Low competitor clash risk: {len(deduped_clashes)} minor keyword overlap(s) noted."

    return {
        'has_clashes': has_clashes,
        'risk_level': risk_level,
        'clashes': deduped_clashes,
        'summary': summary,
    }

