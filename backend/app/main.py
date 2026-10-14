import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import Base, engine
from .routes import analyze, auth, upload

Base.metadata.create_all(engine)

app = FastAPI(title="Sentiment Pulse API", version="1.0.0")
raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:80,http://localhost,http://127.0.0.1,http://localhost:4173",
)
if raw_origins.strip() == "*":
    origins = ["*"]
    allow_credentials = False
else:
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(upload.router)



@app.get("/health")
def health():
    return {"status": "ok"}
