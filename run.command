#!/bin/bash
cd "$(dirname "$0")" || exit 1
python3 server.py &
pid=$!
sleep 1
open 'http://127.0.0.1:8765' 2>/dev/null || true
wait "$pid"
