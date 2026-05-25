#!/usr/bin/env python3
import argparse
import os
import socket
import sys
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def _resolve_dist_dir() -> Path:
    # PyInstaller one-dir/one-file: bundled data is extracted under _MEIPASS.
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        return Path(meipass) / "docs-dist"

    # Dev fallback: serve docs build output from repo.
    return Path(__file__).resolve().parents[1] / ".vitepress" / "dist"


def _pick_host_port(host: str, port: int) -> tuple[str, int]:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
            return host, port
        except OSError:
            sock.bind((host, 0))
            return host, sock.getsockname()[1]


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve PiliNote docs static site")
    parser.add_argument("--host", default=os.getenv("PILINOTE_DOCS_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PILINOTE_DOCS_PORT", "5174")))
    parser.add_argument("--no-open", action="store_true", help="do not open browser automatically")
    args = parser.parse_args()

    dist_dir = _resolve_dist_dir()
    if not dist_dir.exists():
        print(f"[docs-server] dist directory not found: {dist_dir}", file=sys.stderr)
        print("[docs-server] run `pnpm --dir apps/docs build` first.", file=sys.stderr)
        return 1

    host, port = _pick_host_port(args.host, args.port)
    handler = partial(SimpleHTTPRequestHandler, directory=str(dist_dir))
    server = ThreadingHTTPServer((host, port), handler)
    url = f"http://{host}:{port}/"
    print(f"[docs-server] serving {dist_dir}")
    print(f"[docs-server] {url}")

    if not args.no_open:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
