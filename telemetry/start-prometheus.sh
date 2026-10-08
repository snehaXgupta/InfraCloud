#!/usr/bin/env bash
# Dev launcher for the bundled Windows Prometheus binary (run from Git Bash).
cd "$(dirname "$0")"
exec ./prometheus-2.51.0.windows-amd64/prometheus.exe \
  --config.file=prometheus/prometheus.yml \
  --storage.tsdb.path=prometheus/data \
  --storage.tsdb.retention.time=30d \
  --web.enable-remote-write-receiver \
  --web.listen-address=127.0.0.1:9090
