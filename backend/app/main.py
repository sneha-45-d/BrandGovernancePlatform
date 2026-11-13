from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.database.local_store import ensure_db_ready
from app.routes import auth, brand, competitors, content, health, leaderboard, social, visual


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up SQLite database and WAL mode once at startup rather than per request
    ensure_db_ready()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description='AI-powered brand governance and intelligence platform API.',
    lifespan=lifespan,
)

# Enable GZip compression for all responses > 1KB (reduces payload by 70-85%)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r'https:\/\/.*\.vercel\.app',
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)




app.include_router(health.router)
app.include_router(health.router, prefix='/api')
app.include_router(auth.router, prefix='/api')
app.include_router(brand.router, prefix='/api')
app.include_router(content.router, prefix='/api')
app.include_router(competitors.router, prefix='/api')
app.include_router(leaderboard.router, prefix='/api')
app.include_router(visual.router, prefix='/api')
app.include_router(social.router, prefix='/api')


@app.get('/')
def root():
    return {
        'name': settings.APP_NAME,
        'version': settings.APP_VERSION,
        'status': 'running',
        'message': 'Welcome to BRANDITHM API.'
    }
