import os
import re
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_vader = SentimentIntensityAnalyzer()
WORD = re.compile(r"[A-Za-z']+")
HASH = re.compile(r"#\w+")
_pipe = None


def label_for(score: float) -> str:
    return "Positive" if score >= 0.05 else "Negative" if score <= -0.05 else "Neutral"


def _keywords(text: str) -> list[dict]:
    out, seen = [], set()
    for w in WORD.findall(text.lower()):
        v = _vader.lexicon.get(w)
        if v and w not in seen:
            seen.add(w)
            out.append({"word": w, "polarity": round(v / 4, 2)})
    return out


def _transformer(text: str):
    global _pipe
    if _pipe is None:
        from transformers import pipeline
        _pipe = pipeline("sentiment-analysis", model="cardiffnlp/twitter-roberta-base-sentiment-latest", top_k=None)
    scores = {d["label"].lower(): d["score"] for d in _pipe(text[:1500])[0]}
    return scores.get("positive", 0.0), scores.get("neutral", 0.0), scores.get("negative", 0.0)


def analyze(text: str) -> dict:
    engine = os.getenv("SENTIMENT_ENGINE", "vader").lower()
    if engine == "transformer":
        try:
            pos, neu, neg = _transformer(text)
            score = pos - neg
            return _out(score, pos, neu, neg, text, "transformer")
        except Exception:  # model missing or no network: fall back to VADER
            pass
    s = _vader.polarity_scores(text)
    return _out(s["compound"], s["pos"], s["neu"], s["neg"], text, "vader")


def _out(score, pos, neu, neg, text, engine):
    return {
        "label": label_for(score), "score": round(score, 4),
        "positive": round(pos, 4), "neutral": round(neu, 4), "negative": round(neg, 4),
        "keywords": _keywords(text), "engine": engine,
    }


def summarize(results: list[dict]) -> dict:
    counts = {"Positive": 0, "Neutral": 0, "Negative": 0}
    plat: dict[str, list[float]] = {}
    tags: dict[str, list[float]] = {}
    for r in results:
        counts[r["label"]] += 1
        plat.setdefault(r["platform"], []).append(r["score"])
        for h in set(HASH.findall(r["text"].lower())):
            tags.setdefault(h, []).append(r["score"])
    avg = lambda v: round(sum(v) / len(v), 4) if v else 0.0
    return {
        "counts": counts,
        "average": avg([r["score"] for r in results]),
        "by_platform": {k: avg(v) for k, v in plat.items()},
        "hashtags": sorted(({"tag": k, "count": len(v), "avg": avg(v)} for k, v in tags.items()),
                           key=lambda x: (-x["count"], x["tag"])),
    }
