FROM emscripten/emsdk:4.0.10

RUN printf '%s\n' \
  'emscripten ALL=(ALL) NOPASSWD:ALL' \
  'Defaults:emscripten !secure_path' \
  'Defaults:emscripten env_keep += "PATH"' \
  > /etc/sudoers.d/emscripten && \
  chmod 0440 /etc/sudoers.d/emscripten

RUN apt-get update && apt-get install --yes autoconf
