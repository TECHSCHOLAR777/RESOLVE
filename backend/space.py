"""Entry point for a Hugging Face Gradio Space: serves the FastAPI app on port 7860."""
try:
    import spaces  # must be imported before torch on ZeroGPU hardware
except ImportError:  # local runs
    spaces = None

import gradio as gr
import uvicorn

from app.main import app
from app.model import get_model

get_model()  # download and load the weights before the first request

if spaces is not None:
    # ZeroGPU refuses to start without one GPU function. The model is small and runs on CPU.
    @spaces.GPU
    def _gpu_placeholder():
        return None

    # ZeroGPU normally reports the GPU function from a hook inside gr.Blocks.launch().
    # This app is served by uvicorn instead, so run that startup report directly.
    import spaces.zero

    if hasattr(spaces.zero, "startup"):
        spaces.zero.startup()

with gr.Blocks(title="RESOLVE backend") as demo:
    gr.Markdown("RESOLVE backend (SEN2SR-Lite RGBN x4). The API is under `/api`, for example `/api/health`.")

# SSR off: with it on (HF sets GRADIO_SSR_MODE), Gradio starts a Node server on 7860
# that renders pages for every path, so the /api routes become unreachable.
app = gr.mount_gradio_app(app, demo, path="/", ssr_mode=False)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)  # the Space's app_port
