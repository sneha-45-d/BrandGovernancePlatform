from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import auth, brand, competitors, content, health, leaderboard, visual

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description='AI-powered brand governance and intelligence platform API.',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r'https:\/\/.*\.vercel\.app',
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(health.router, prefix='/api')
app.include_router(auth.router, prefix='/api')
app.include_router(brand.router, prefix='/api')
app.include_router(content.router, prefix='/api')
app.include_router(competitors.router, prefix='/api')
app.include_router(leaderboard.router, prefix='/api')
app.include_router(visual.router, prefix='/api')


@app.get('/')
def root():
    return {
        'name': settings.APP_NAME,
        'version': settings.APP_VERSION,
        'status': 'running',
        'message': 'Welcome to BRANDITHM API.'
    }
