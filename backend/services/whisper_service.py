import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import UploadFile
from openai import OpenAI


_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        load_dotenv()
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _client = OpenAI(api_key=api_key)
    return _client


async def transcribe_audio(upload: UploadFile) -> str:
    client = get_client()

    # Use a project-local temp directory to avoid Windows TEMP permission/locking issues.
    suffix = os.path.splitext(upload.filename or "")[1] or ".webm"
    temp_dir = Path(__file__).resolve().parents[1] / "tmp_uploads"
    temp_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = temp_dir / f"{uuid4().hex}{suffix}"

    try:
        content = await upload.read()
        with open(tmp_path, "wb") as tmp_file:
            tmp_file.write(content)

        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
            )

        return transcript.strip()
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass

