"""Vertex AI OpenAI compatibility with refreshable ADC authentication."""
import asyncio
import google.auth
from google.auth.transport.requests import Request
import httpx
from autogen_ext.models.openai import OpenAIChatCompletionClient


class VertexAuth(httpx.Auth):
    def __init__(self):
        self.credentials = None
        self.lock = asyncio.Lock()

    async def async_auth_flow(self, request):
        async with self.lock:
            if self.credentials is None:
                self.credentials, _ = await asyncio.to_thread(
                    google.auth.default,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"],
                )
            if not self.credentials.valid:
                await asyncio.to_thread(self.credentials.refresh, Request())
            request.headers["Authorization"] = f"Bearer {self.credentials.token}"
        yield request


def create_vertex_client(settings):
    project = settings.GOOGLE_CLOUD_PROJECT
    location = settings.GOOGLE_CLOUD_LOCATION
    if not project:
        raise RuntimeError("Vertex AI requires GOOGLE_CLOUD_PROJECT.")
    host = "aiplatform.googleapis.com" if location == "global" else f"{location}-aiplatform.googleapis.com"
    return OpenAIChatCompletionClient(
        model="google/" + settings.GOOGLE_MODEL.removeprefix("google/"),
        api_key="adc-placeholder",
        base_url=f"https://{host}/v1beta1/projects/{project}/locations/{location}/endpoints/openapi",
        http_client=httpx.AsyncClient(auth=VertexAuth()),
        model_info={"vision": False, "function_calling": True,
                    "json_output": True, "structured_output": True, "family": "unknown"},
    )
