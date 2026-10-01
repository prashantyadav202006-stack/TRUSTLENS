import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import pandas as pd
from google import genai
from io import StringIO

# Load environment variables from api.env
load_dotenv('api.env')

app = Flask(__name__)
CORS(app)

# Initialize Gemini client
client = None
try:
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        client = genai.Client(api_key=api_key)
except Exception as e:
    print(f"Failed to init Gemini client: {e}")

last_csv_content = ""

@app.route('/upload', methods=['POST'])
def upload_file():
    global last_csv_content
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        try:
            content = file.read()
            last_csv_content = content.decode('utf-8', errors='ignore')
            
            df = pd.read_csv(StringIO(last_csv_content))
            total_rows = len(df)
            columns = len(df.columns)
            
            # Duplicates
            duplicates = int(df.duplicated().sum())
            
            # Invalid records
            invalid_records = int(df.isnull().any(axis=1).sum())
            
            # Completeness
            total_cells = total_rows * columns
            missing_cells = int(df.isnull().sum().sum())
            completeness = 100.0 if total_cells == 0 else max(0.0, 100.0 - (missing_cells / total_cells * 100.0))
            
            # Uniqueness
            uniqueness = 100.0 if total_rows == 0 else max(0.0, 100.0 - (duplicates / total_rows * 100.0))
            
            # Validity
            validity = 100.0 if total_rows == 0 else max(0.0, 100.0 - (invalid_records / total_rows * 100.0))
            
            # Accuracy
            accuracy = (validity + completeness) / 2.0
            
            # Consistency
            consistency = (uniqueness + completeness) / 2.0
            
            # Timeliness
            timeliness = completeness
            
            # Overall Score
            score = (completeness + accuracy + consistency + validity + uniqueness + timeliness) / 6.0
            
            return jsonify({
                'filename': file.filename,
                'total_rows': total_rows,
                'columns': columns,
                'duplicates': duplicates,
                'invalid_records': invalid_records,
                'score': int(score),
                'completeness': int(completeness),
                'accuracy': int(accuracy),
                'consistency': int(consistency),
                'validity': int(validity),
                'uniqueness': int(uniqueness),
                'timeliness': int(timeliness)
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_prompt = data.get('message', '')

    if not user_prompt:
        return jsonify({'reply': 'Message is required'}), 400

    if not client:
        return jsonify({'reply': 'Gemini API key is not set.'}), 500

    try:
        lines = last_csv_content.split('\n')
        snippet = '\n'.join(lines[:50])
        
        full_prompt = f"You are a helpful Data Analyst. Here is a snippet of the user's data:\n{snippet}\n\nUser question: {user_prompt}"
        
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=full_prompt
        )
        return jsonify({'reply': response.text.replace('\n', '<br>')})

    except Exception as e:
        return jsonify({'reply': f'Error: {str(e)}'}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    user_prompt = data.get('prompt', '')

    if not user_prompt:
        return jsonify({'error': 'Prompt is required'}), 400

    if not client:
         return jsonify({'error': 'Gemini API key is not set.'}), 500

    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=user_prompt
        )
        return jsonify({'result': response.text})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
