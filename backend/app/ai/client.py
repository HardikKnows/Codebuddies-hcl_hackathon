"""Thin wrapper around the OpenAI SDK; the only module that talks to the provider.

Uses the Responses API (structured outputs via `responses.parse`, strict function tools) and the
Embeddings API. Model IDs come from configuration only; nothing here assumes a specific model.
"""

import logging
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Protocol, TypeVar

from pydantic import BaseModel, ValidationError

from app.core.config import Settings, get_settings
from app.core.errors import AppError

T = TypeVar("T", bound=BaseModel)
logger = logging.getLogger("retailpulse.ai")


class AINotConfigured(AppError):
    def __init__(self, what: str = "AI assistant", missing: str = "OPENAI_API_KEY and OPENAI_MODEL"):
        super().__init__(503, "AI_NOT_CONFIGURED", f"The {what} is not configured yet. Set {missing} in backend/.env.")


class AIUnavailable(AppError):
    def __init__(self, message: str = "The AI service is temporarily unavailable. Please try again.", **details):
        super().__init__(503, "AI_UNAVAILABLE", message, details)


class AIClient(Protocol):
    model: str
    embedding_model: str

    def parse(self, *, instructions: str, input: str | list[dict], schema: type[T]) -> T: ...

    def run_tools(
        self,
        *,
        instructions: str,
        input: list[dict],
        tools: list[dict],
        call_tool: Callable[[str, str], str],
        max_steps: int = 4,
    ) -> str: ...

    def embed(self, texts: list[str]) -> list[list[float]]: ...


@contextmanager
def _provider_errors(model: str) -> Iterator[None]:
    import openai

    try:
        yield
    except openai.AuthenticationError:
        raise AIUnavailable("The OpenAI API key was rejected. Check OPENAI_API_KEY in backend/.env.")
    except openai.NotFoundError:
        raise AIUnavailable(
            f"Model '{model}' is not available to this API key. Run `python -m scripts.check_openai` to list models.",
            model=model,
        )
    except openai.RateLimitError:
        raise AIUnavailable("The AI service is rate limited right now. Please retry in a moment.")
    except (openai.APIConnectionError, openai.APITimeoutError):
        raise AIUnavailable("Couldn't reach the AI service. Check the network connection and retry.")
    except openai.BadRequestError as exc:
        logger.warning("OpenAI rejected a request for %s: %s", model, exc)
        raise AIUnavailable("The AI provider rejected the request.", provider_message=str(exc.message)[:300])
    except openai.APIStatusError as exc:
        logger.warning("OpenAI error %s for %s", exc.status_code, model)
        raise AIUnavailable(f"The AI service returned an error ({exc.status_code}). Please retry.")
    except (openai.OpenAIError, ValidationError) as exc:  # e.g. truncated or filtered structured output
        logger.warning("Unusable AI response from %s: %s", model, exc)
        raise AIUnavailable("The AI response was incomplete. Please try again.")


class OpenAIClient:
    def __init__(self, settings: Settings):
        from openai import OpenAI

        self._client = OpenAI(api_key=settings.openai_api_key, timeout=60.0, max_retries=2)
        self.model = settings.openai_model
        self.embedding_model = settings.openai_embedding_model
        self._dim = settings.embedding_dim
        self._reasoning = {"effort": settings.openai_reasoning_effort} if settings.openai_reasoning_effort else None

    def _model_args(self) -> dict:
        if not self.model:
            raise AINotConfigured(missing="OPENAI_MODEL")
        args = {"model": self.model}
        if self._reasoning:
            args["reasoning"] = self._reasoning
        return args

    def parse(self, *, instructions: str, input: str | list[dict], schema: type[T]) -> T:
        args = self._model_args()
        with _provider_errors(self.model):
            response = self._client.responses.parse(instructions=instructions, input=input, text_format=schema, **args)
        if response.output_parsed is None:
            raise AIUnavailable("The AI response could not be understood. Please rephrase and try again.")
        return response.output_parsed

    def run_tools(
        self,
        *,
        instructions: str,
        input: list[dict],
        tools: list[dict],
        call_tool: Callable[[str, str], str],
        max_steps: int = 4,
    ) -> str:
        """Tool loop with a hard step cap. Every call goes through `call_tool`, which validates and authorizes it."""
        args = self._model_args()
        items: list = list(input)
        for _ in range(max_steps):
            with _provider_errors(self.model):
                response = self._client.responses.create(instructions=instructions, input=items, tools=tools, **args)
            calls = [item for item in response.output if item.type == "function_call"]
            if not calls:
                return response.output_text
            items += response.output
            for call in calls:
                items.append({"type": "function_call_output", "call_id": call.call_id, "output": call_tool(call.name, call.arguments)})
        return "I couldn't complete that request. Please try again, or raise a ticket from the support page."

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not self.embedding_model:
            raise AINotConfigured("policy search", missing="OPENAI_EMBEDDING_MODEL")
        vectors: list[list[float]] = []
        for start in range(0, len(texts), 96):
            args = {"model": self.embedding_model, "input": texts[start : start + 96]}
            if self.embedding_model.startswith("text-embedding-3"):
                args["dimensions"] = self._dim  # these models can shorten their output to the schema's size
            with _provider_errors(self.embedding_model):
                response = self._client.embeddings.create(**args)
            vectors += [item.embedding for item in sorted(response.data, key=lambda item: item.index)]
        if vectors and len(vectors[0]) != self._dim:
            raise AIUnavailable(
                f"The embedding model returns {len(vectors[0])} dimensions but EMBEDDING_DIM is {self._dim}."
            )
        return vectors


_client: OpenAIClient | None = None


def get_ai() -> AIClient:
    """FastAPI dependency (overridden in tests). Raises 503 AI_NOT_CONFIGURED when no key is set."""
    global _client
    settings = get_settings()
    if not settings.openai_api_key:
        raise AINotConfigured()
    if _client is None:
        _client = OpenAIClient(settings)
    return _client
