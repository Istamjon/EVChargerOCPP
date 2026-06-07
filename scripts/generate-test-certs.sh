#!/bin/bash
# Generates self-signed test certificates for OCPP TLS and SP3 mTLS.
# Output: packages/css/test-certs/{ca,server,client}.{pem,key.pem}
#
# Safe to run multiple times. Skips generation if certs already exist.

CERT_DIR="${1:-packages/css/test-certs}"

if [ -f "$CERT_DIR/ca.pem" ] && [ -f "$CERT_DIR/server.pem" ] && [ -f "$CERT_DIR/client.pem" ]; then
  echo "Test certs already exist in $CERT_DIR, skipping."
  exit 0
fi

mkdir -p "$CERT_DIR"

echo "Generating test CA..."
openssl ecparam -genkey -name prime256v1 -noout -out "$CERT_DIR/ca-key.pem" 2>/dev/null
openssl req -new -x509 -key "$CERT_DIR/ca-key.pem" -out "$CERT_DIR/ca.pem" \
  -days 3650 -subj "/CN=EVtivity Test CA" 2>/dev/null

echo "Generating test server certificate..."
openssl ecparam -genkey -name prime256v1 -noout -out "$CERT_DIR/server-key.pem" 2>/dev/null
# Using a path inside the cert dir instead of /tmp
SERVER_CSR="$CERT_DIR/server.csr"
openssl req -new -key "$CERT_DIR/server-key.pem" -out "$SERVER_CSR" \
  -subj "/CN=localhost" 2>/dev/null
# Using printf instead of echo for extfile
openssl x509 -req -in "$SERVER_CSR" -CA "$CERT_DIR/ca.pem" -CAkey "$CERT_DIR/ca-key.pem" \
  -CAcreateserial -out "$CERT_DIR/server.pem" -days 3650 \
  -extfile <(printf "subjectAltName=DNS:localhost,DNS:ocpp,IP:127.0.0.1") 2>/dev/null
rm -f "$SERVER_CSR"

echo "Generating test client certificate..."
openssl ecparam -genkey -name prime256v1 -noout -out "$CERT_DIR/client-key.pem" 2>/dev/null
# Using a path inside the cert dir instead of /tmp
CLIENT_CSR="$CERT_DIR/client.csr"
openssl req -new -key "$CERT_DIR/client-key.pem" -out "$CLIENT_CSR" \
  -subj "/CN=EVtivity Test Client" 2>/dev/null
openssl x509 -req -in "$CLIENT_CSR" -CA "$CERT_DIR/ca.pem" -CAkey "$CERT_DIR/ca-key.pem" \
  -CAcreateserial -out "$CERT_DIR/client.pem" -days 3650 2>/dev/null
rm -f "$CLIENT_CSR" "$CERT_DIR/ca.srl"

echo "Test certs generated in $CERT_DIR"
