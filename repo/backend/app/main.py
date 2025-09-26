from fastapi import FastAPI
from app.routers import health, ingest, plan, solve, critic, apply, learn

app = FastAPI()
app.include_router(health.router, prefix="/healthz")
app.include_router(ingest.router, prefix="/api")
app.include_router(plan.router, prefix="/api")
app.include_router(solve.router, prefix="/api")
app.include_router(critic.router, prefix="/api")
app.include_router(apply.router, prefix="/api")
app.include_router(learn.router, prefix="/api")
