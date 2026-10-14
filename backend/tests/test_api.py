def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_positive_negative_neutral(client):
    pos = client.post("/api/sentiment", json={"text": "I absolutely love this product, it works perfectly!"}).json()
    neg = client.post("/api/sentiment", json={"text": "Terrible experience. The staff were rude and nothing worked."}).json()
    neu = client.post("/api/sentiment", json={"text": "The package arrived on Tuesday in a brown box."}).json()
    assert (pos["label"], neg["label"], neu["label"]) == ("Positive", "Negative", "Neutral")
    assert -1 <= neg["score"] < 0 < pos["score"] <= 1


def test_negation_and_keywords(client):
    r = client.post("/api/sentiment", json={"text": "This is not good at all"}).json()
    assert r["label"] == "Negative"
    assert any(k["word"] == "good" and k["polarity"] > 0 for k in r["keywords"])


def test_validation(client):
    assert client.post("/api/sentiment", json={"text": "   "}).status_code == 422
    assert client.post("/api/sentiment", json={"text": "a" * 5001}).status_code == 422
    assert client.post("/api/sentiment/batch", json={"posts": []}).status_code == 422


def test_batch_summary(client):
    posts = [
        {"platform": "X", "text": "Fantastic update, love it! #launch"},
        {"platform": "X", "text": "Worst crash ever, I hate this. #launch #bugs"},
        {"platform": "Reddit", "text": "Delivery arrived on Tuesday. #bugs"},
    ]
    d = client.post("/api/sentiment/batch", json={"posts": posts}).json()
    assert len(d["results"]) == 3 and d["results"][0]["platform"] == "X"
    assert sum(d["summary"]["counts"].values()) == 3
    assert set(d["summary"]["by_platform"]) == {"X", "Reddit"}
    tags = {h["tag"]: h["count"] for h in d["summary"]["hashtags"]}
    assert tags == {"#launch": 2, "#bugs": 2}


def test_auth_flow_and_history(client):
    body = {"name": "Khushi", "email": "K@Example.com", "password": "password123"}
    r = client.post("/auth/register", json=body)
    assert r.status_code == 201 and r.json()["user"]["email"] == "k@example.com"
    assert client.post("/auth/register", json=body).status_code == 409
    assert client.post("/auth/login", json={"email": "k@example.com", "password": "wrong-pass"}).status_code == 401
    token = client.post("/auth/login", json={"email": "k@example.com", "password": "password123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/history").status_code == 401
    client.post("/api/sentiment", json={"text": "Great service, thank you!"}, headers=h)
    hist = client.get("/api/history", headers=h).json()
    assert len(hist) == 1 and hist[0]["label"] == "Positive"


def test_register_validation(client):
    assert client.post("/auth/register", json={"name": "A", "email": "bad", "password": "password123"}).status_code == 422
    assert client.post("/auth/register", json={"name": "A", "email": "a@b.co", "password": "short"}).status_code == 422


def test_history_limit_and_user_isolation(client):
    r1 = client.post("/auth/register", json={"name": "User 1", "email": "u1@example.com", "password": "password123"})
    t1 = r1.json()["access_token"]
    h1 = {"Authorization": f"Bearer {t1}"}

    r2 = client.post("/auth/register", json={"name": "User 2", "email": "u2@example.com", "password": "password123"})
    t2 = r2.json()["access_token"]
    h2 = {"Authorization": f"Bearer {t2}"}

    # Add 12 analyses for user 1
    for i in range(12):
        client.post("/api/sentiment", json={"text": f"User 1 sentiment review number {i} - awesome!"}, headers=h1)

    # Add 1 analysis for user 2
    client.post("/api/sentiment", json={"text": "User 2 sentiment post - terrible crash!"}, headers=h2)

    # User 1 fetches history with limit=10
    hist1 = client.get("/api/history?limit=10", headers=h1).json()
    assert len(hist1) == 10
    assert "number 11" in hist1[0]["text"]  # latest first

    # User 2 only sees their own analysis
    hist2 = client.get("/api/history", headers=h2).json()
    assert len(hist2) == 1
    assert "User 2" in hist2[0]["text"]


def test_engine_fallback(client, monkeypatch):
    from app import sentiment

    # Test when engine is transformer and it succeeds (if available) or falls back
    monkeypatch.setenv("SENTIMENT_ENGINE", "transformer")
    res = client.post("/api/sentiment", json={"text": "Superb experience!"}).json()
    assert res["label"] == "Positive"
    assert res["engine"] in ("transformer", "vader")

    # Test fallback to vader when transformer throws error
    def broken_transformer(text):
        raise RuntimeError("Model download failed")

    monkeypatch.setattr(sentiment, "_transformer", broken_transformer)
    res_fallback = client.post("/api/sentiment", json={"text": "Superb experience!"}).json()
    assert res_fallback["label"] == "Positive"
    assert res_fallback["engine"] == "vader"


def test_trends_topics_stats(client):
    # Unauthorized checks
    assert client.get("/api/trends").status_code == 401
    assert client.get("/api/topics").status_code == 401
    assert client.get("/api/stats").status_code == 401

    # Register user
    r = client.post("/auth/register", json={"name": "Alice Trends", "email": "alice@trends.com", "password": "password123"})
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # Empty states
    empty_trends = client.get("/api/trends", headers=h).json()
    assert empty_trends == []

    empty_topics = client.get("/api/topics", headers=h).json()
    assert empty_topics == []

    empty_stats = client.get("/api/stats", headers=h).json()
    assert empty_stats == {"total": 0, "counts": {"Positive": 0, "Neutral": 0, "Negative": 0}, "average": 0.0}

    # Add analyses
    client.post("/api/sentiment", json={"text": "I absolutely love this amazing product! #love #happy"}, headers=h)
    client.post("/api/sentiment", json={"text": "Horrible failure, terrible support. #fail"}, headers=h)
    client.post("/api/sentiment", json={"text": "The box arrived on Wednesday."}, headers=h)

    # Check stats
    stats = client.get("/api/stats", headers=h).json()
    assert stats["total"] == 3
    assert stats["counts"]["Positive"] == 1
    assert stats["counts"]["Negative"] == 1
    assert stats["counts"]["Neutral"] == 1
    assert isinstance(stats["average"], float)

    # Check trends
    trends = client.get("/api/trends?days=30", headers=h).json()
    assert len(trends) >= 1
    assert trends[0]["count"] == 3
    assert "date" in trends[0] and "avg" in trends[0]

    # Check topics
    topics = client.get("/api/topics", headers=h).json()
    assert len(topics) > 0
    terms = [t["term"] for t in topics]
    assert any(tag in terms for tag in ["#love", "#happy", "#fail"])
    for t in topics:
        assert "term" in t and "count" in t and "avg" in t


