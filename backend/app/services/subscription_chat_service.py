"""
KI-Chat Service für Subscription-Erstellung.

Nutzt Gemini Function Calling, um natürlichsprachliche Anfragen
in strukturierte Subscription-Konfigurationen zu übersetzen.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

# ============================================================================
# Task 5.1: Function Definitions für Gemini
# ============================================================================

SUBSCRIPTION_FUNCTIONS = [
    {
        "name": "set_channels",
        "description": "Setzt die Kanäle für das Abo. Leeres Array bedeutet alle Kanäle.",
        "parameters": {
            "type": "object",
            "properties": {
                "channel_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Liste von Kanal-Namen oder @handles. Z.B. ['Fireship', '@lexfridman']",
                }
            },
            "required": ["channel_names"],
        },
    },
    {
        "name": "set_keywords",
        "description": "Setzt die Themen/Keywords für die Suche.",
        "parameters": {
            "type": "object",
            "properties": {
                "keywords": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Suchbegriffe für YouTube. Z.B. ['FastAPI', 'Python Tutorial']",
                }
            },
            "required": ["keywords"],
        },
    },
    {
        "name": "set_duration_filter",
        "description": "Setzt Filter für Video-Dauer.",
        "parameters": {
            "type": "object",
            "properties": {
                "min_minutes": {
                    "type": "number",
                    "description": "Mindestdauer in Minuten. Optional.",
                },
                "max_minutes": {
                    "type": "number",
                    "description": "Maximaldauer in Minuten. Optional.",
                },
            },
        },
    },
    {
        "name": "set_views_filter",
        "description": "Setzt Filter für Mindest-Views.",
        "parameters": {
            "type": "object",
            "properties": {
                "min_views": {
                    "type": "integer",
                    "description": "Mindestanzahl Views",
                }
            },
            "required": ["min_views"],
        },
    },
    {
        "name": "set_quality_filter",
        "description": "Aktiviert Qualitäts-Filter basierend auf KI-Bewertung.",
        "parameters": {
            "type": "object",
            "properties": {
                "min_quality_score": {
                    "type": "number",
                    "description": "Mindest-Qualitätsscore (1-10)",
                },
                "filter_clickbait": {
                    "type": "boolean",
                    "description": "Clickbait-Videos herausfiltern",
                },
            },
        },
    },
    {
        "name": "set_name",
        "description": "Setzt den Namen für das Abo.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name des Abos",
                }
            },
            "required": ["name"],
        },
    },
    {
        "name": "set_poll_interval",
        "description": "Setzt wie oft nach neuen Videos gesucht wird.",
        "parameters": {
            "type": "object",
            "properties": {
                "interval": {
                    "type": "string",
                    "enum": ["hourly", "twice_daily", "daily"],
                    "description": "Polling-Intervall",
                }
            },
            "required": ["interval"],
        },
    },
    {
        "name": "confirm_subscription",
        "description": "Bestätigt dass das Abo bereit zur Erstellung ist.",
        "parameters": {
            "type": "object",
            "properties": {
                "ready": {
                    "type": "boolean",
                    "description": "True wenn bereit",
                }
            },
            "required": ["ready"],
        },
    },
]


# ============================================================================
# Task 5.2: SubscriptionChatService
# ============================================================================


@dataclass
class ChatResponse:
    """Response from subscription chat service."""

    message: str
    subscription_preview: dict[str, Any]
    ready_to_create: bool
    conversation_history: list[dict[str, str]]


class SubscriptionChatService:
    """
    Service for handling natural language subscription creation via chat.

    Uses Gemini Function Calling to interpret user requests and build
    subscription configurations incrementally.
    """

    # System prompt for the chat assistant
    SYSTEM_PROMPT = """Du bist ein Assistent der hilft YouTube-Abonnements zu erstellen.

DEINE AUFGABE:
1. Interpretiere die User-Anfrage
2. Rufe die passenden Funktionen auf um die Konfiguration zu aktualisieren
3. Fasse zusammen was du verstanden hast
4. Frage nach wenn etwas unklar ist

INTERPRETATIONS-REGELN:
- "ca. 5 Minuten" → min_minutes: 4, max_minutes: 6
- "kurze Videos" → max_minutes: 5
- "lange Videos" → min_minutes: 20
- "mindestens 10 Minuten" → min_minutes: 10
- "bis zu 30 Minuten" → max_minutes: 30
- "populäre Videos" → min_views: 10000
- "hochwertige Videos" → aktiviere Qualitäts-Filter

BEISPIEL-DIALOG:
User: "Ich möchte FastAPI Videos die mindestens 10 Minuten lang sind"
Assistant: *ruft set_keywords(["FastAPI"]) und set_duration_filter(min_minutes=10) auf*
"Verstanden! Ich suche nach FastAPI-Videos mit mindestens 10 Minuten Länge.
Soll ich noch weitere Filter hinzufügen? Zum Beispiel bestimmte Kanäle oder Mindest-Views?"

WICHTIG:
- Antworte immer auf Deutsch
- Sei hilfreich und frage nach bei Unklarheiten
- Schlage einen Namen vor wenn der User keinen nennt
- Wenn genug Informationen vorhanden sind (Name + Quelle), rufe confirm_subscription(ready=true) auf"""

    def __init__(self) -> None:
        """Initialize the chat service with Gemini client."""
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is required for subscription chat")

        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = "gemini-2.0-flash-exp"

    def _build_tools(self) -> list[types.Tool]:
        """Build Gemini tools from function definitions."""
        function_declarations = []

        for func in SUBSCRIPTION_FUNCTIONS:
            properties = {}
            for prop_name, prop_def in func["parameters"].get("properties", {}).items():
                prop_type = prop_def.get("type", "string")

                # Map JSON Schema types to Gemini Schema
                if prop_type == "array":
                    schema = types.Schema(
                        type=types.Type.ARRAY,
                        items=types.Schema(type=types.Type.STRING),
                        description=prop_def.get("description", ""),
                    )
                elif prop_type == "integer":
                    schema = types.Schema(
                        type=types.Type.INTEGER,
                        description=prop_def.get("description", ""),
                    )
                elif prop_type == "number":
                    schema = types.Schema(
                        type=types.Type.NUMBER,
                        description=prop_def.get("description", ""),
                    )
                elif prop_type == "boolean":
                    schema = types.Schema(
                        type=types.Type.BOOLEAN,
                        description=prop_def.get("description", ""),
                    )
                else:
                    schema = types.Schema(
                        type=types.Type.STRING,
                        description=prop_def.get("description", ""),
                    )

                properties[prop_name] = schema

            function_declarations.append(
                types.FunctionDeclaration(
                    name=func["name"],
                    description=func["description"],
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties=properties,
                        required=func["parameters"].get("required", []),
                    ),
                )
            )

        return [types.Tool(function_declarations=function_declarations)]

    async def process_message(
        self,
        message: str,
        current_config: dict[str, Any],
        list_id: UUID,
        conversation_history: list[dict[str, str]],
    ) -> ChatResponse:
        """
        Process a user message and update subscription configuration.

        Args:
            message: User's message
            current_config: Current subscription configuration
            list_id: Target list ID for the subscription
            conversation_history: Previous messages in the conversation

        Returns:
            ChatResponse with updated config and assistant message
        """
        # Build context message with current config
        context_message = f"""{self.SYSTEM_PROMPT}

AKTUELLE KONFIGURATION:
{json.dumps(current_config, indent=2, default=str)}

ZIELLISTE: {list_id}"""

        # Convert history to Gemini format
        contents = []

        # Add previous messages
        for msg in conversation_history:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part(text=msg["content"])])
            )

        # Add current user message with context (for first message) or just the message
        if not conversation_history:
            user_message = f"{context_message}\n\nUser: {message}"
        else:
            user_message = message

        contents.append(
            types.Content(role="user", parts=[types.Part(text=user_message)])
        )

        # Build tools
        tools = self._build_tools()

        try:
            # Call Gemini with function calling
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    tools=tools,
                    temperature=0.7,
                ),
            )

            # Process function calls and extract text
            updated_config = current_config.copy()
            text_response = ""

            for candidate in response.candidates:
                for part in candidate.content.parts:
                    # Handle function calls
                    if part.function_call:
                        updated_config = self._apply_function_call(
                            updated_config, part.function_call
                        )
                        logger.info(
                            f"Applied function call: {part.function_call.name} "
                            f"with args: {part.function_call.args}"
                        )

                    # Extract text
                    if part.text:
                        text_response += part.text

            # If no text response, generate a summary
            if not text_response:
                text_response = self._generate_summary(updated_config)

            # Update conversation history
            new_history = [
                *conversation_history,
                {"role": "user", "content": message},
                {"role": "assistant", "content": text_response},
            ]

            return ChatResponse(
                message=text_response,
                subscription_preview=updated_config,
                ready_to_create=self._is_ready(updated_config),
                conversation_history=new_history,
            )

        except Exception as e:
            logger.error(f"Gemini chat error: {e}")
            error_message = (
                "Entschuldigung, es gab einen Fehler bei der Verarbeitung. "
                "Bitte versuche es erneut."
            )
            return ChatResponse(
                message=error_message,
                subscription_preview=current_config,
                ready_to_create=False,
                conversation_history=[
                    *conversation_history,
                    {"role": "user", "content": message},
                    {"role": "assistant", "content": error_message},
                ],
            )

    def _apply_function_call(
        self, config: dict[str, Any], function_call: types.FunctionCall
    ) -> dict[str, Any]:
        """Apply a function call to update the configuration."""
        func_name = function_call.name
        args = dict(function_call.args) if function_call.args else {}

        if func_name == "set_channels":
            config["channel_names"] = args.get("channel_names", [])

        elif func_name == "set_keywords":
            config["keywords"] = args.get("keywords", [])

        elif func_name == "set_duration_filter":
            config.setdefault("filters", {})
            min_min = args.get("min_minutes")
            max_min = args.get("max_minutes")
            config["filters"]["duration"] = {
                "min_seconds": int(min_min * 60) if min_min else None,
                "max_seconds": int(max_min * 60) if max_min else None,
            }

        elif func_name == "set_views_filter":
            config.setdefault("filters", {})
            config["filters"]["views"] = {"min_views": args.get("min_views")}

        elif func_name == "set_quality_filter":
            config.setdefault("filters", {})
            config["filters"]["ai_filter"] = {
                "enabled": True,
                "min_quality_score": args.get("min_quality_score", 5),
                "filter_clickbait": args.get("filter_clickbait", True),
            }

        elif func_name == "set_name":
            config["name"] = args.get("name")

        elif func_name == "set_poll_interval":
            config["poll_interval"] = args.get("interval", "daily")

        elif func_name == "confirm_subscription":
            config["confirmed"] = args.get("ready", False)

        return config

    def _is_ready(self, config: dict[str, Any]) -> bool:
        """Check if enough information is present to create subscription."""
        has_source = config.get("channel_names") or config.get("keywords")
        has_name = bool(config.get("name"))
        return has_source and has_name

    def _generate_summary(self, config: dict[str, Any]) -> str:
        """Generate a summary of the current configuration."""
        parts = ["Ich habe die Konfiguration aktualisiert:"]

        if name := config.get("name"):
            parts.append(f"- Name: {name}")

        if channels := config.get("channel_names"):
            parts.append(f"- Kanäle: {', '.join(channels)}")

        if keywords := config.get("keywords"):
            parts.append(f"- Keywords: {', '.join(keywords)}")

        if filters := config.get("filters"):
            if duration := filters.get("duration"):
                if duration.get("min_seconds"):
                    parts.append(
                        f"- Mindestdauer: {duration['min_seconds'] // 60} Minuten"
                    )
                if duration.get("max_seconds"):
                    parts.append(
                        f"- Maximaldauer: {duration['max_seconds'] // 60} Minuten"
                    )

            if views := filters.get("views"):
                if views.get("min_views"):
                    parts.append(f"- Mindest-Views: {views['min_views']:,}")

        if self._is_ready(config):
            parts.append("\nDas Abo ist bereit zur Erstellung!")
        else:
            missing = []
            if not config.get("name"):
                missing.append("Name")
            if not config.get("channel_names") and not config.get("keywords"):
                missing.append("Kanäle oder Keywords")
            parts.append(f"\nFehlt noch: {', '.join(missing)}")

        return "\n".join(parts)
