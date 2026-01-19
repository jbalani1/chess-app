#!/bin/bash
# Setup script for Raspberry Pi
# Installs Python dependencies in a virtual environment

set -e

echo "🔧 Setting up chess-worker on Raspberry Pi..."
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install it first:"
    echo "   sudo apt-get update && sudo apt-get install python3 python3-pip python3-venv"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo ""
echo "🔌 Activating virtual environment..."
source .venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo ""
echo "📥 Installing dependencies from requirements.txt..."
pip install -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "To use the worker, always activate the virtual environment first:"
echo "   source .venv/bin/activate"
echo ""
echo "Then you can run scripts like:"
echo "   python3 test_performance.py yourusername 2024 1 -n 5"

