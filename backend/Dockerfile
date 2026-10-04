# Hugging Face Docker Space (CPU). Space metadata (sdk: docker, app_port: 7860) goes in the Space README.
FROM python:3.11-slim
WORKDIR /app
RUN useradd -m -u 1000 user
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=user app ./app
COPY --chown=user samples ./samples
USER user
# Download the model weights at build time so the first request is fast.
RUN python -c "from app.model import get_model; get_model()"
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
