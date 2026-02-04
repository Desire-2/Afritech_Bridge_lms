#!/usr/bin/env python3
"""
MTN MoMo Sandbox Setup Script

This script creates an API User and generates an API Key for the MTN MoMo Sandbox.
Run this once to get the credentials needed for testing.

Usage:
    python setup_mtn_sandbox.py

Requirements:
    - MTN_SUBSCRIPTION_KEY must be set in .env (your Primary Key from momodeveloper.mtn.com)
"""

import os
import sys
import uuid

import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SANDBOX_BASE_URL = "https://sandbox.momodeveloper.mtn.com"


def create_api_user(subscription_key: str, callback_host: str = "https://webhook.site") -> str:
    """Create a new API User in the MTN MoMo Sandbox."""
    
    # Generate a new UUID for the API User
    api_user_id = str(uuid.uuid4())
    
    headers = {
        "X-Reference-Id": api_user_id,
        "Ocp-Apim-Subscription-Key": subscription_key,
        "Content-Type": "application/json",
    }
    
    payload = {
        "providerCallbackHost": callback_host
    }
    
    print(f"Creating API User with ID: {api_user_id}")
    
    response = requests.post(
        f"{SANDBOX_BASE_URL}/v1_0/apiuser",
        json=payload,
        headers=headers,
        timeout=30,
    )
    
    if response.status_code == 201:
        print("✓ API User created successfully!")
        return api_user_id
    elif response.status_code == 409:
        print(f"! API User already exists. Using: {api_user_id}")
        return api_user_id
    else:
        print(f"✗ Failed to create API User: {response.status_code}")
        print(f"  Response: {response.text}")
        sys.exit(1)


def get_api_key(subscription_key: str, api_user_id: str) -> str:
    """Generate an API Key for the API User."""
    
    headers = {
        "Ocp-Apim-Subscription-Key": subscription_key,
    }
    
    print(f"Generating API Key for user: {api_user_id}")
    
    response = requests.post(
        f"{SANDBOX_BASE_URL}/v1_0/apiuser/{api_user_id}/apikey",
        headers=headers,
        timeout=30,
    )
    
    if response.status_code == 201:
        api_key = response.json().get("apiKey")
        print("✓ API Key generated successfully!")
        return api_key
    else:
        print(f"✗ Failed to generate API Key: {response.status_code}")
        print(f"  Response: {response.text}")
        sys.exit(1)


def verify_api_user(subscription_key: str, api_user_id: str) -> bool:
    """Verify the API User exists and is valid."""
    
    headers = {
        "Ocp-Apim-Subscription-Key": subscription_key,
    }
    
    response = requests.get(
        f"{SANDBOX_BASE_URL}/v1_0/apiuser/{api_user_id}",
        headers=headers,
        timeout=30,
    )
    
    if response.ok:
        data = response.json()
        print(f"✓ API User verified: {data}")
        return True
    else:
        print(f"✗ API User verification failed: {response.status_code}")
        return False


def test_token(subscription_key: str, api_user_id: str, api_key: str) -> bool:
    """Test that we can obtain an access token."""
    import base64
    
    credentials = f"{api_user_id}:{api_key}"
    encoded = base64.b64encode(credentials.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {encoded}",
        "Ocp-Apim-Subscription-Key": subscription_key,
    }
    
    print("Testing token endpoint...")
    
    response = requests.post(
        f"{SANDBOX_BASE_URL}/collection/token/",
        headers=headers,
        timeout=30,
    )
    
    if response.ok:
        token_data = response.json()
        print(f"✓ Token obtained successfully!")
        print(f"  Token type: {token_data.get('token_type')}")
        print(f"  Expires in: {token_data.get('expires_in')} seconds")
        return True
    else:
        print(f"✗ Token request failed: {response.status_code}")
        print(f"  Response: {response.text}")
        return False


def main():
    """Main setup function."""
    
    print("=" * 60)
    print("MTN MoMo Sandbox Setup")
    print("=" * 60)
    print()
    
    # Get subscription key from environment
    subscription_key = os.getenv("MTN_SUBSCRIPTION_KEY") or os.getenv("MTN_CLIENT_ID")
    
    if not subscription_key:
        print("Error: MTN_SUBSCRIPTION_KEY not found in .env file")
        print("Please add your Primary Key from momodeveloper.mtn.com")
        sys.exit(1)
    
    print(f"Using Subscription Key: {subscription_key[:8]}...")
    print()
    
    # Check if we already have API User and Key configured
    existing_api_user = os.getenv("MTN_API_USER")
    existing_api_key = os.getenv("MTN_API_KEY")
    
    if existing_api_user and existing_api_key and existing_api_user != subscription_key:
        print("Existing credentials found. Testing...")
        if test_token(subscription_key, existing_api_user, existing_api_key):
            print()
            print("✓ Existing credentials are working!")
            return
        print()
        print("Existing credentials failed. Creating new ones...")
        print()
    
    # Create new API User
    callback_host = os.getenv("MTN_CALLBACK_URL", "https://webhook.site")
    api_user_id = create_api_user(subscription_key, callback_host)
    print()
    
    # Generate API Key
    api_key = get_api_key(subscription_key, api_user_id)
    print()
    
    # Verify the user
    verify_api_user(subscription_key, api_user_id)
    print()
    
    # Test token endpoint
    test_token(subscription_key, api_user_id, api_key)
    print()
    
    # Print the configuration
    print("=" * 60)
    print("Configuration for .env file:")
    print("=" * 60)
    print()
    print(f"MTN_SUBSCRIPTION_KEY={subscription_key}")
    print(f"MTN_API_USER={api_user_id}")
    print(f"MTN_API_KEY={api_key}")
    print()
    print("=" * 60)
    print("Please update your .env file with these values!")
    print("=" * 60)


if __name__ == "__main__":
    main()
