import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import httpx
from vertex_client import VertexAuth, create_vertex_client

class VertexTests(unittest.IsolatedAsyncioTestCase):
    async def test_refresh_and_reuse(self):
        class Credentials:
            valid = False
            token = None
            count = 0
            def refresh(self, request):
                self.count += 1
                self.token = 'test-token'
                self.valid = True
        creds = Credentials()
        auth = VertexAuth()
        async def respond(request):
            self.assertEqual(request.headers['Authorization'], 'Bearer test-token')
            return httpx.Response(200, json={})
        with patch('vertex_client.google.auth.default', return_value=(creds, 'test-project')):
            async with httpx.AsyncClient(auth=auth, transport=httpx.MockTransport(respond)) as client:
                await client.get('https://example.test')
                await client.get('https://example.test')
                self.assertEqual(creds.count, 1)
                creds.valid = False
                await client.get('https://example.test')
                self.assertEqual(creds.count, 2)

    async def test_autogen_uses_vertex_auth(self):
        settings = SimpleNamespace(GOOGLE_CLOUD_PROJECT='test-project', GOOGLE_CLOUD_LOCATION='global', GOOGLE_MODEL='gemini-3.8-flash')
        client = create_vertex_client(settings)
        self.assertIsInstance(client._client._client.auth, VertexAuth)
        self.assertIn('/projects/test-project/locations/global/endpoints/openapi', str(client._client.base_url))
        await client.close()

if __name__ == '__main__':
    unittest.main()
