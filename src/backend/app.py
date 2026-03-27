import os

from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='')

try:
    from .tiles import tiles_bp
except ImportError:
    from tiles import tiles_bp  # type: ignore[no-redef]  # direct invocation
app.register_blueprint(tiles_bp)


@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/embed')
def embed():
    """Iframe-embeddable endpoint.
    URL params: center (lon,lat), zoom, style, interval (s), controls, clock, info, subsolar,
                terminator, night, attribution (set false to remove badge — paid tier).
    """
    return send_from_directory(app.static_folder, 'embed.html')


@app.route('/landing')
def landing():
    """Marketing/landing page for the hosted service."""
    return send_from_directory(app.static_folder, 'landing.html')


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/api/embed-snippet')
def embed_snippet():
    """Return a ready-to-paste iframe snippet based on query params."""
    base = request.host_url.rstrip('/')
    params = {k: v for k, v in request.args.items()}
    params.setdefault('controls', 'false')
    params.setdefault('badge', 'true')

    qs = '&'.join(f'{k}={v}' for k, v in params.items())
    src = f'{base}/embed?{qs}' if qs else f'{base}/embed'

    snippet = (
        f'<iframe\n'
        f'  src="{src}"\n'
        f'  width="100%" height="400"\n'
        f'  frameborder="0"\n'
        f'  style="border-radius:8px;"\n'
        f'  title="Live day/night map — geochron-web"\n'
        f'  loading="lazy"\n'
        f'></iframe>'
    )
    return jsonify({'snippet': snippet, 'src': src})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    app.run(debug=True, host='0.0.0.0', port=port)
