#!/usr/bin/env bash
# Deploy the DB Service web UI next to a running DB Service stack.
#
#   ./deploy-ui.sh            build from source if this folder has the Dockerfile, otherwise pull the image
#   ./deploy-ui.sh --build    always build from source (kx-db-ui:local)
#   ./deploy-ui.sh --pull     always pull the published image
#   ./deploy-ui.sh --stop     remove the UI container
#
# This replaces any existing container with the same name
# Settings (environment variables, the first two match docker-compose.ui.yaml):
#   DS_PORT_UI=3000        port on localhost
#   DS_UI_TAG=0.1.0        published image version used by --pull
#   DS_UI_NETWORK=kx-db    Docker network of the DB Service stack
#   DS_UI_NAME=kx-db-ui    container name
set -euo pipefail

PORT="${DS_PORT_UI:-3000}"
TAG="${DS_UI_TAG:-0.1.0}"
NETWORK="${DS_UI_NETWORK:-kx-db}"
NAME="${DS_UI_NAME:-kx-db-ui}"
REMOTE_IMAGE="ghcr.io/ajdair/kdbx-db-service-ui:${TAG}"
LOCAL_IMAGE="kx-db-ui:local"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

die() { echo "error: $*" >&2; exit 1; }

mode=auto
case "${1:-}" in
  "") ;;
  --build|-b) mode=build ;;
  --pull|-p) mode=pull ;;
  --stop|--down) mode=stop ;;
  -h|--help) sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) die "unknown option '$1' (try --help)" ;;
esac

command -v docker >/dev/null 2>&1 || die "docker is not installed or not on PATH"
docker info >/dev/null 2>&1 || die "cannot talk to the Docker daemon (is it running, and are you in the docker group?)"

if [ "$mode" = stop ]; then
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  echo "Removed $NAME"
  exit 0
fi

docker network inspect "$NETWORK" >/dev/null 2>&1 \
  || die "Docker network '$NETWORK' not found. Start the DB Service first (docker compose up -d), or set DS_UI_NETWORK."

if [ "$mode" = auto ]; then
  if [ -f "$DIR/Dockerfile" ]; then mode=build; else mode=pull; fi
fi

if [ "$mode" = build ]; then
  [ -f "$DIR/Dockerfile" ] || die "no Dockerfile in $DIR, so --build is not possible. Use --pull instead."
  echo "Building $LOCAL_IMAGE from $DIR"
  docker build -t "$LOCAL_IMAGE" "$DIR"
  image="$LOCAL_IMAGE"
else
  echo "Pulling $REMOTE_IMAGE"
  docker pull "$REMOTE_IMAGE" || die "could not pull $REMOTE_IMAGE. It may not be published yet, or you may be offline. From a checkout, use --build."
  image="$REMOTE_IMAGE"
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
# Note: localhost only, the API is unauthenticated and /query/q runs arbitrary q.
docker run -d --name "$NAME" --network "$NETWORK" -p "127.0.0.1:${PORT}:80" "$image" >/dev/null

echo "UI running at http://127.0.0.1:${PORT}"
echo "Stop it with: $0 --stop"
