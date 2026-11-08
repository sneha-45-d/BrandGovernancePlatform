from fastapi import APIRouter, Query

from app.database import local_store
from app.services.scoring_service import BADGE_CATALOG

router = APIRouter()


@router.get('/leaderboard')
def get_leaderboard(limit: int = Query(10, ge=1, le=50)):
    items = local_store.get_leaderboard(limit=limit)
    return {
        'leaderboard': items,
        'badge_catalog': BADGE_CATALOG,
        'total_participants': len(items),
    }


@router.get('/leaderboard/me')
def get_my_champion_stats(user_id: str = Query(...)):
    stats = local_store.get_user_champion_stats(user_id)
    all_users = local_store.get_leaderboard(limit=100)

    # Calculate user rank
    user_rank = 1
    found = False
    for item in all_users:
        if item.get('id') == user_id:
            user_rank = item.get('rank', 1)
            found = True
            break
    if not found:
        user_rank = len(all_users) + 1

    score = stats.get('champion_score') or 0
    # Level calculation: Level 1 = 0-99, Level 2 = 100-249, Level 3 = 250-499, Level 4 = 500-999, Level 5 = 1000+
    level = 1
    next_threshold = 100
    if score >= 1000:
        level = 5
        next_threshold = 2000
    elif score >= 500:
        level = 4
        next_threshold = 1000
    elif score >= 250:
        level = 3
        next_threshold = 500
    elif score >= 100:
        level = 2
        next_threshold = 250

    badges_detailed = []
    for badge_id in stats.get('badges') or []:
        if badge_id in BADGE_CATALOG:
            badges_detailed.append(BADGE_CATALOG[badge_id])

    return {
        'user_id': user_id,
        'display_name': stats.get('full_name') or 'Champion',
        'rank': user_rank,
        'champion_score': score,
        'streak_days': stats.get('streak_days') or 0,
        'total_submissions': stats.get('total_submissions') or 0,
        'level': level,
        'points_to_next_level': max(0, next_threshold - score),
        'next_threshold': next_threshold,
        'badges': stats.get('badges') or [],
        'badges_detailed': badges_detailed,
    }

