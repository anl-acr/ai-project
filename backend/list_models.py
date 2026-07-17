import asyncio
from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})

for model in client.models.list():
    if "flash" in model.name:
        print(model.name)
