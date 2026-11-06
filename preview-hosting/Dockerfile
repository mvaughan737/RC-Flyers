FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MEMBERSHIP_EMAIL_ENABLED=false
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY scripts ./scripts
COPY templates ./templates
COPY data ./data
COPY documents ./documents
COPY public ./public
COPY remote_preview.py remote_mail.py ./
COPY smoke.py ./
COPY gunicorn.conf.py ./
COPY entrypoint.sh ./
RUN useradd --uid 10001 --create-home preview && mkdir -p /var/data/membership && chown -R preview:preview /var/data
EXPOSE 10000
ENTRYPOINT ["sh", "entrypoint.sh"]
