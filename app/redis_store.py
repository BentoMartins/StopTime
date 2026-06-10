import json
from typing import Any

from redis.asyncio import Redis

from app.config import settings


class RedisStore:
    def __init__(self) -> None:
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)

    async def get_room(self, room_id: str) -> dict[str, Any] | None:
        raw_room = await self.redis.get(self._room_key(room_id))
        if raw_room is None:
            return None
        return json.loads(raw_room)

    async def save_room(self, room: dict[str, Any]) -> None:
        await self.redis.set(self._room_key(room["id"]), json.dumps(room, ensure_ascii=False))

    async def delete_room(self, room_id: str) -> None:
        await self.redis.delete(self._room_key(room_id))

    async def close(self) -> None:
        await self.redis.aclose()

    @staticmethod
    def _room_key(room_id: str) -> str:
        return f"stop:room:{room_id}"
