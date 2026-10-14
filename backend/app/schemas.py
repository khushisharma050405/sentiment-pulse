from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


def _clean(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("Text cannot be empty.")
    return v


class TextIn(BaseModel):
    text: str = Field(max_length=5000)
    _v = field_validator("text")(_clean)


class PostIn(BaseModel):
    platform: str = Field(default="Other", max_length=30)
    text: str = Field(max_length=5000)
    _v = field_validator("text")(_clean)


class BatchIn(BaseModel):
    posts: list[PostIn] = Field(min_length=1, max_length=200)


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(pattern=EMAIL, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: str = Field(pattern=EMAIL, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class Keyword(BaseModel):
    word: str
    polarity: float


class SentimentOut(BaseModel):
    label: str
    score: float
    positive: float
    neutral: float
    negative: float
    keywords: list[Keyword]
    engine: str


class PostResult(SentimentOut):
    platform: str
    text: str


class Hashtag(BaseModel):
    tag: str
    count: int
    avg: float


class Summary(BaseModel):
    counts: dict[str, int]
    average: float
    by_platform: dict[str, float]
    hashtags: list[Hashtag]


class BatchOut(BaseModel):
    results: list[PostResult]
    summary: Summary


class HistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    text: str
    label: str
    score: float
    created_at: datetime


class TrendItem(BaseModel):
    date: str
    avg: float
    count: int


class TopicItem(BaseModel):
    term: str
    count: int
    avg: float


class StatsOut(BaseModel):
    total: int
    counts: dict[str, int]
    average: float

