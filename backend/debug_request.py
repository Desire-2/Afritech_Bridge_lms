#!/usr/bin/env python3
"""
Debug script to capture exact request from frontend
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app, origins=["http://192.168.133.116:3002"], supports_credentials=True)

@app.route('/api/v1/student/dashboard/', methods=['GET', 'POST', 'OPTIONS'])
def debug_dashboard():
    print("\n" + "="*50)
    print("DEBUG: Frontend Request Captured")
    print("="*50)
    print(f"Method: {request.method}")
    print(f"Headers:")
    for header, value in request.headers.items():
        print(f"  {header}: {value}")
    print(f"Args: {dict(request.args)}")
    print(f"JSON: {request.get_json()}")
    print(f"Data: {request.get_data()}")
    print("="*50)
    
    # Return a mock response
    return jsonify({
        "debug": "Request captured successfully",
        "method": request.method,
        "headers": dict(request.headers),
        "has_auth": "Authorization" in request.headers
    })

if __name__ == '__main__':
    print("Starting debug server on port 5002...")
    app.run(host='0.0.0.0', port=5002, debug=True)