from app.database import local_store

BADGE_CATALOG = {
    'first_check': {
        'id': 'first_check',
        'title': 'First Scan',
        'description': 'Submitted your very first piece of content for brand analysis.',
        'icon': 'flag',
        'rarity': 'common',
    },
    'zero_violations': {
        'id': 'zero_violations',
        'title': 'Clean Slate',
        'description': 'Submitted copy that produced zero brand violations.',
        'icon': 'shield-check',
        'rarity': 'uncommon',
    },
    'perfect_compliance': {
        'id': 'perfect_compliance',
        'title': 'Brand Perfectionist',
        'description': 'Achieved an outstanding 95%+ brand compliance score.',
        'icon': 'sparkles',
        'rarity': 'rare',
    },
    'streak_3': {
        'id': 'streak_3',
        'title': 'Consistency Champion',
        'description': 'Maintained a 3-day content governance streak.',
        'icon': 'flame',
        'rarity': 'uncommon',
    },
    'streak_7': {
        'id': 'streak_7',
        'title': 'Week Warrior',
        'description': 'Completed brand checks 7 days in a row.',
        'icon': 'trophy',
        'rarity': 'epic',
    },
    'prolific_creator': {
        'id': 'prolific_creator',
        'title': 'Prolific Author',
        'description': 'Completed 5 or more comprehensive brand compliance audits.',
        'icon': 'file-check-2',
        'rarity': 'rare',
    },
    'centurion': {
        'id': 'centurion',
        'title': 'Centurion Guard',
        'description': 'Completed 25+ institutional brand audits.',
        'icon': 'crown',
        'rarity': 'legendary',
    },
}


def calculate_points(overall_score: int, compliance_score: int, violation_count: int) -> int:
    base = 15
    compliance_bonus = round((compliance_score / 100) * 15)
    overall_bonus = round((overall_score / 100) * 10)
    penalty = violation_count * 3
    points = base + compliance_bonus + overall_bonus - penalty
    return max(5, points)


def process_analysis_score(user_id: str, analysis: dict) -> dict:
    if not user_id or user_id == 'demo-user':
        return {
            'points_earned': 15,
            'champion_score': 15,
            'streak_days': 1,
            'badges': ['first_check'],
            'new_badges': ['first_check'],
        }

    overall_score = int(analysis.get('overall_score') or 0)
    compliance_score = int(analysis.get('brand_compliance_score') or overall_score)
    violations = analysis.get('violations') or []
    violation_count = len(violations)

    points = calculate_points(overall_score, compliance_score, violation_count)

    # Current stats
    stats = local_store.get_user_champion_stats(user_id)
    existing_badges = set(stats.get('badges') or [])

    new_badges = []
    # Badge evaluation
    if 'first_check' not in existing_badges:
        new_badges.append('first_check')

    if violation_count == 0 and 'zero_violations' not in existing_badges:
        new_badges.append('zero_violations')

    if compliance_score >= 95 and 'perfect_compliance' not in existing_badges:
        new_badges.append('perfect_compliance')

    current_streak = stats.get('streak_days') or 0
    if (current_streak + 1) >= 3 and 'streak_3' not in existing_badges:
        new_badges.append('streak_3')

    if (current_streak + 1) >= 7 and 'streak_7' not in existing_badges:
        new_badges.append('streak_7')

    total_submissions = (stats.get('total_submissions') or 0) + 1
    if total_submissions >= 5 and 'prolific_creator' not in existing_badges:
        new_badges.append('prolific_creator')

    if total_submissions >= 25 and 'centurion' not in existing_badges:
        new_badges.append('centurion')

    record = local_store.record_submission_and_score(user_id, points, new_badges)
    record['new_badges'] = new_badges
    return record

