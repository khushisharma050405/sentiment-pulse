import os
import time
from collections import defaultdict, deque
from fastapi import HTTPException, Request

_hits: dict = defaultdict(deque)


def limit(window: int = 60):
    def dep(request: Request):
        max_calls = int(os.getenv("AUTH_RATE_LIMIT", "10"))
        client_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or request.headers.get("x-real-ip")
            or (request.client.host if request.client else "x")
        )
        key = (client_ip, request.url.path)
        now, q = time.time(), _hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= max_calls:
            raise HTTPException(429, "Too many attempts. Try again in a minute.")
        q.append(now)
    return dep
