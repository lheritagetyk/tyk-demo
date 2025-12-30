#!/bin/bash
# Run the tyk-grpc-plugin container with JWS configuration

docker run -p 5555:5555 \
  -v "$(pwd)/private.pem:/app/private.pem:ro" \
  -e JWS_PRIVATE_KEY_PATH=/app/private.pem \
  -e JWS_KEY_ID=tyk-fapi-jws-key-1 \
  -e JWS_ISSUER=https://tyk-bank.example.com \
  tyk-grpc-plugin-fapi
