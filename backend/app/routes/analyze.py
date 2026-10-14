from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Analysis
from ..schemas import BatchIn, BatchOut, HistoryItem, SentimentOut, TextIn, TopicItem, TrendItem, StatsOut
from ..security import current_user, optional_user
from ..sentiment import HASH, _keywords, analyze, summarize

router = APIRouter(prefix="/api", tags=["sentiment"])


@router.post("/sentiment", response_model=SentimentOut)
def single(body: TextIn, db: Session = Depends(get_db), user=Depends(optional_user)):
    result = analyze(body.text)
    if user:  # signed-in users get a history
        db.add(Analysis(user_id=user.id, text=body.text, label=result["label"], score=result["score"]))
        db.commit()
    return result


@router.post("/sentiment/batch", response_model=BatchOut)
def batch(body: BatchIn):
    results = [{**analyze(p.text), "platform": p.platform, "text": p.text} for p in body.posts]
    return {"results": results, "summary": summarize(results)}


@router.get("/history", response_model=list[HistoryItem])
def history(limit: int = 50, db: Session = Depends(get_db), user=Depends(current_user)):
    limit = max(1, min(limit, 100))
    return db.query(Analysis).filter(Analysis.user_id == user.id).order_by(Analysis.id.desc()).limit(limit).all()


@router.get("/trends", response_model=list[TrendItem])
def trends(days: int = 30, db: Session = Depends(get_db), user=Depends(current_user)):
    days = max(1, min(days, 365))
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    since = now - timedelta(days=days)
    rows = db.query(Analysis).filter(Analysis.user_id == user.id, Analysis.created_at >= since).order_by(Analysis.created_at.asc()).all()
    grouped: dict[str, list[float]] = {}
    for r in rows:
        d = r.created_at.strftime("%Y-%m-%d") if r.created_at else now.strftime("%Y-%m-%d")
        grouped.setdefault(d, []).append(r.score)
    return [
        {"date": d, "avg": round(sum(scores) / len(scores), 2), "count": len(scores)}
        for d, scores in grouped.items()
    ]


@router.get("/topics", response_model=list[TopicItem])
def topics(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.query(Analysis).filter(Analysis.user_id == user.id).all()
    term_scores: dict[str, list[float]] = {}
    for r in rows:
        for h in set(HASH.findall(r.text.lower())):
            term_scores.setdefault(h, []).append(r.score)
        for kw in _keywords(r.text):
            w = kw["word"].lower()
            term_scores.setdefault(w, []).append(r.score)
    items = [
        {"term": term, "count": len(scores), "avg": round(sum(scores) / len(scores), 2)}
        for term, scores in term_scores.items()
    ]
    items.sort(key=lambda x: (-x["count"], x["term"]))
    return items[:20]


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.query(Analysis).filter(Analysis.user_id == user.id).all()
    total = len(rows)
    counts = {"Positive": 0, "Neutral": 0, "Negative": 0}
    for r in rows:
        if r.label in counts:
            counts[r.label] += 1
    avg = round(sum(r.score for r in rows) / total, 2) if total else 0.0
    return {"total": total, "counts": counts, "average": avg}


