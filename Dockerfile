FROM python:3.11-slim

WORKDIR /app

ENV FLASK_APP=app.py

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["sh", "-c", "flask db upgrade && gunicorn app:app --bind 0.0.0.0:8080 --workers 1"]