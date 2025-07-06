from flask import Flask, request, send_from_directory
import os

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def home():
    files = [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith('.jpg')]
    files.sort(reverse=True)
    if not files:
        return "<h2>Chưa có ảnh nào.</h2>"
    latest = files[0]
    return f'''
    <html>
      <head><meta http-equiv="refresh" content="10"></head>
      <body>
        <h2>Ảnh mới nhất:</h2>
        <img src="/uploads/{latest}" style="max-width:90%; border:2px solid black"><br>
        <p>{latest}</p>
      </body>
    </html>
    '''

@app.route('/upload', methods=['POST'])
def upload():
    f = request.files.get('photo')
    if not f:
        return 'Không có file', 400
    name = f.filename
    f.save(os.path.join(UPLOAD_FOLDER, name))
    return 'OK', 200

@app.route('/uploads/<filename>')
def serve_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    app.run()
