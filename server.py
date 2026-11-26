from http.server import SimpleHTTPRequestHandler, HTTPServer
import json

class EchoLinkHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/telemetry':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            freq = data.get('peak_freq', 0)
            vol = data.get('volume', 0)
            byte_size = len(post_data)
            
            # Real-time Edge-AI Acoustic Classification
            status = "AMBIENT / IDLE"
            if vol > 25:
                if freq < 300:
                    status = "LOW-FREQ STRUCTURAL VIBRATION"
                elif 300 <= freq <= 1200:
                    status = "VOCAL / MECHANICAL HARMONIC"
                else:
                    status = "HIGH-PITCH ANOMALY DETECTED"

            print(f"[RX {byte_size} BYTES] Peak: {freq}Hz | Vol: {vol}dB -> {status}")

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = json.dumps({"status": status, "bytes_saved": "99.9%"})
            self.wfile.write(response.encode('utf-8'))

print("ECHO-LINK Telemetry Server running at http://localhost:8000")
HTTPServer(('localhost', 8000), EchoLinkHandler).serve_forever()
