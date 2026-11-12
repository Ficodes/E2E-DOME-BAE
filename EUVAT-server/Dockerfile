FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY server.py VatRetrievalService.wsdl vat-rates.json ./
EXPOSE 4202
CMD ["python", "server.py"]
