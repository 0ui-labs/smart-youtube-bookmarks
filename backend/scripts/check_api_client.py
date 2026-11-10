"""Generate from a real, isolated local backend and fail on client drift.

Run from backend with TEST_DATABASE_URL/REDIS_URL configured. Default is read-only
for tracked client files; --write replaces generated output for review/commit.
"""

import argparse
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import settings
from app.core.test_database import validated_test_database_url


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    database = validated_test_database_url(
        os.environ.get("TEST_DATABASE_URL"), settings.database_url
    )
    backend = Path(__file__).resolve().parents[1]
    frontend = backend.parent / "frontend"
    with socket.socket() as socket_:
        socket_.bind(("127.0.0.1", 0))
        port = socket_.getsockname()[1]
    env = {**os.environ, "DATABASE_URL": database}
    with tempfile.TemporaryDirectory(
        prefix=".api-check-", dir=frontend / "src/api"
    ) as temporary:
        output = Path(temporary)
        # Avoid inherited auth/provider secrets appearing in process output.
        with tempfile.TemporaryFile() as log:
            server = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "app.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(port),
                    "--lifespan",
                    "off",
                    "--no-access-log",
                ],
                cwd=backend,
                env=env,
                stdout=log,
                stderr=log,
            )
            try:
                url = f"http://127.0.0.1:{port}/openapi.json"
                for _ in range(100):
                    try:
                        with urllib.request.urlopen(url, timeout=1) as response:
                            if response.status == 200:
                                break
                    except OSError:
                        if server.poll() is not None:
                            raise RuntimeError(
                                "Isolated OpenAPI server exited"
                            ) from None
                        time.sleep(0.1)
                else:
                    raise RuntimeError(
                        "Isolated OpenAPI server did not become available"
                    )
                generator_env = {
                    **env,
                    "OPENAPI_URL": url,
                    "API_OUTPUT_DIR": str(output),
                }
                subprocess.run(
                    ["npm", "exec", "--", "orval"],
                    cwd=frontend,
                    env=generator_env,
                    check=True,
                )
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
        tracked = frontend / "src/api/generated"
        actual = {
            str(p.relative_to(output)): p.read_bytes()
            for p in output.rglob("*")
            if p.is_file()
        }
        expected = {
            str(p.relative_to(tracked)): p.read_bytes()
            for p in tracked.rglob("*")
            if p.is_file()
        }
        changed = sorted(
            key
            for key in actual.keys() | expected.keys()
            if actual.get(key) != expected.get(key)
        )
        if args.write:
            shutil.rmtree(tracked)
            shutil.copytree(output, tracked)
            print(f"Generated {len(actual)} client files from running test backend")
        elif changed:
            print("API client drift:\n" + "\n".join(changed), file=sys.stderr)
            raise SystemExit(1)
        else:
            print(f"API client matches running backend ({len(actual)} files)")


if __name__ == "__main__":
    main()
