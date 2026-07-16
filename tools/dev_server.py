#!/usr/bin/env python3
"""
開發用靜態伺服器（不快取版）

用途：與 `python -m http.server` 相同，但每個回應都帶上「不要快取」標頭。

為什麼需要：本專案是原生 ES modules，瀏覽器會依「模組 URL」各自快取。
更新 .js 後若只重整，可能出現「新模組 + 舊模組」混用的版本不一致
（典型症狀：xxx is not a function），得手動硬重整（Ctrl+Shift+R）。
在進入點加 ?v= 版本參數並不能解決，因為它不會傳遞到 import 進來的模組。
讓伺服器回 no-store 才能一勞永逸。

用法：
    python tools/dev_server.py                # http://127.0.0.1:8123
    python tools/dev_server.py --port 8080
"""

import argparse
import functools
import http.server
import socketserver


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 安靜一點：只在出錯時輸出
        if not args or str(args[1] if len(args) > 1 else "").startswith(("2", "3")):
            return
        super().log_message(fmt, *args)


class ThreadingServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    ap = argparse.ArgumentParser(description="開發用靜態伺服器（不快取）")
    ap.add_argument("--port", type=int, default=8123)
    ap.add_argument("--bind", default="127.0.0.1")
    ap.add_argument("--dir", default=None, help="服務的根目錄（預設：目前工作目錄）")
    args = ap.parse_args()

    handler = (functools.partial(NoCacheHandler, directory=args.dir)
               if args.dir else NoCacheHandler)
    with ThreadingServer((args.bind, args.port), handler) as httpd:
        print(f"開發伺服器（不快取）啟動：http://{args.bind}:{args.port}/")
        print("  遊戲：/index.html?story=demo_story    編輯器：/editor.html")
        print("  改完 .js 直接重整即可，不需要硬重整。Ctrl+C 結束。")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止。")


if __name__ == "__main__":
    main()
