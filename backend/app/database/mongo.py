from pymongo import MongoClient

from app.config import settings

client = MongoClient(settings.MONGO_URI)
db = client[settings.DB_NAME]


def get_db():
    return db
