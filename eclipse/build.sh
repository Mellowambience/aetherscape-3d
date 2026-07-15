#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SRC=eclipse/src
OUT=eclipse/out/classes
JAR=eclipse/out/aetherscape-eclipse-glue.jar

command -v javac >/dev/null || { echo "ERROR: javac not on PATH"; exit 1; }

rm -rf eclipse/out
mkdir -p "$OUT"
find "$SRC" -name '*.java' > eclipse/out/sources.txt
javac -encoding UTF-8 --release 8 -d "$OUT" @eclipse/out/sources.txt
jar cf "$JAR" -C "$OUT" .
java -cp "$OUT" com.aetherhaven.eclipse.test.FakeBrowserHarness
echo
echo "Built: $JAR"
echo OK
