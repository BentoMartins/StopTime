import json
import logging
from typing import Any

import aio_pika
from aio_pika.abc import AbstractChannel, AbstractConnection, AbstractExchange, AbstractIncomingMessage, AbstractQueue

from app.config import settings

logger = logging.getLogger(__name__)


class RabbitPublisher:
    def __init__(self) -> None:
        self.connection: AbstractConnection | None = None
        self.channel: AbstractChannel | None = None
        self.exchange: AbstractExchange | None = None
        self.audit_queue: AbstractQueue | None = None

    async def connect(self) -> None:
        try:
            self.connection = await aio_pika.connect_robust(settings.rabbitmq_url)
            self.channel = await self.connection.channel()
            self.exchange = await self.channel.declare_exchange(
                settings.rabbitmq_exchange,
                aio_pika.ExchangeType.TOPIC,
                durable=True,
            )
            self.audit_queue = await self.channel.declare_queue(settings.rabbitmq_queue, durable=True)
            await self.audit_queue.bind(self.exchange, routing_key="room.*")
            await self.audit_queue.consume(self.consume_audit_event)
            logger.info("RabbitMQ conectado e fila de auditoria configurada.")
        except Exception:
            logger.exception("RabbitMQ indisponivel. A API continua funcionando sem publicar eventos.")

    async def publish(self, event_type: str, payload: dict[str, Any]) -> None:
        if self.exchange is None:
            return

        message = aio_pika.Message(
            body=json.dumps({"type": event_type, "payload": payload}, ensure_ascii=False).encode("utf-8"),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await self.exchange.publish(message, routing_key=event_type)

    async def consume_audit_event(self, message: AbstractIncomingMessage) -> None:
        async with message.process():
            payload = json.loads(message.body.decode("utf-8"))
            logger.info("Evento processado assincronamente: %s", payload.get("type"))

    async def close(self) -> None:
        if self.connection is not None:
            await self.connection.close()
