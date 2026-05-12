#!/usr/bin/env bash

set -eEuo pipefail
shopt -s inherit_errexit
trap 'echo "Error on line $LINENO: $BASH_COMMAND (exit $?)" >&2' ERR

apt-get update
apt-get install --yes autoconf=2.71-3

# Align the ubuntu user with the mounted workdir's owner so files we create
# are owned by the host user, and so ubuntu can write to /src regardless of
# the host user's UID. Without this the script fails on hosts whose user is
# not UID 1000 (e.g. GitHub Actions' runner is UID 1001).
HOST_UID=$(stat --format='%u' /src)
HOST_GID=$(stat --format='%g' /src)
if [ "$HOST_UID" -ne 0 ] && [ "$HOST_UID" -ne "$(id -u ubuntu)" ]; then
  groupmod --non-unique --gid "$HOST_GID" ubuntu
  usermod --non-unique --uid "$HOST_UID" --gid "$HOST_GID" ubuntu
  chown --recursive "$HOST_UID:$HOST_GID" /home/ubuntu
fi

exec runuser -u ubuntu -- sh scripts/build-wasm.sh
