"""Provider abstraction layer for the AfriTech Bridge LMS AI agent."""

from .base import (
    AIProvider,
    AIResponse,
    StreamEvent,
    StreamEventType,
    ProviderError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderTemporaryError,
    ProviderAuthError,
    ProviderInvalidRequestError,
    ProviderContextOverflowError,
    ProviderMalformedResponseError,
    ProviderUnavailableError,
    ProviderCancelledError,
)
from . import config
from .resolver import (
    resolve_provider_config,
    is_provider_configured,
    ProviderConfig,
)
from .factory import (
    build_provider,
    get_provider,
    available_providers,
    run_with_fallback,
    PROVIDER_CLASSES,
)
from .nvidia import NVIDIAProvider
from .openrouter import OpenRouterProvider
from .gemini import GeminiProvider

__all__ = [
    "AIProvider",
    "AIResponse",
    "StreamEvent",
    "StreamEventType",
    "ProviderError",
    "ProviderRateLimitError",
    "ProviderTimeoutError",
    "ProviderTemporaryError",
    "ProviderAuthError",
    "ProviderInvalidRequestError",
    "ProviderContextOverflowError",
    "ProviderMalformedResponseError",
    "ProviderUnavailableError",
    "ProviderCancelledError",
    "config",
    "resolve_provider_config",
    "is_provider_configured",
    "ProviderConfig",
    "build_provider",
    "get_provider",
    "available_providers",
    "run_with_fallback",
    "PROVIDER_CLASSES",
    "NVIDIAProvider",
    "OpenRouterProvider",
    "GeminiProvider",
]