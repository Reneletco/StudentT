from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, events, rooms, bookings, mentors, admin, analytics, forum, support, chat
from websocket_manager import manager
from auth import get_current_user
from database import get_db
import models
import json
from init_db import init_db
import os

app = FastAPI(title="Студент & Т API")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(events.router)
app.include_router(rooms.router)
app.include_router(bookings.router)
app.include_router(mentors.router)
app.include_router(admin.router)
app.include_router(analytics.router)
app.include_router(forum.router)
app.include_router(support.router)
app.include_router(chat.router)

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    from auth import SECRET_KEY, ALGORITHM
    from jose import jwt
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        db = next(get_db())
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            await websocket.close()
            return
        await manager.connect(websocket, user.id)
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id if user else None)
    except Exception:
        await websocket.close()

frontend_out_dir = os.path.join("frontend", "out")
static_dir = "static"

# Если фронт уже экспортирован в статические файлы — раздаем его.
# Роуты `/api/*` и `ws/*` остаются приоритетнее, потому что они добавлены выше.
serve_dir = frontend_out_dir if os.path.isdir(frontend_out_dir) else static_dir
app.mount("/", StaticFiles(directory=serve_dir, html=True), name="static")

# Legacy UI (включая админ-конструктор) — доступен всегда.
app.mount(
    "/legacy",
    StaticFiles(directory=static_dir, html=True),
    name="legacy_static",
)