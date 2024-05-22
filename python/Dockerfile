FROM python:slim

WORKDIR /opt/app
COPY . .

# Install necessary system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libffi-dev libssl-dev

# Upgrade pip, setuptools, and wheel
RUN pip3 install --upgrade pip setuptools wheel

# Set working directory for Python code
WORKDIR /opt/app/python

# Install other dependencies from requirements.txt
RUN pip3 install -r requirements.txt

ENV FLASK_APP=/opt/app/python/server.py
EXPOSE 8000
ENTRYPOINT ["gunicorn"]
CMD ["-b", "0.0.0.0:10000", "server:app"]
