"""Entry point for a Hugging Face Gradio Space: serves the FastAPI app on port 7860."""
import gradio as gr
import uvicorn

from app.main import app
from app.model import get_model

get_model()  # download and load the weights before the first request

with gr.Blocks(title="RESOLVE backend") as demo:
    gr.Markdown("RESOLVE backend (SEN2SR-Lite RGBN x4). The API is under `/api`, for example `/api/health`.")

app = gr.mount_gradio_app(app, demo, path="/")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
