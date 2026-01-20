#!/bin/bash

# Bond Discovery - GitHub Push Script
# Usage: bash push-to-github.sh <your-username>

USERNAME=${1:-nlesko-bond}
REPO_NAME="bond-discovery"

echo "🚀 Bond Discovery - GitHub Push Script"
echo "======================================"
echo "User: $USERNAME"
echo "Repo: $REPO_NAME"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Not a git repository. Initializing..."
    git init
fi

# Add all files
echo "📝 Adding files..."
git add .

# Commit
echo "💾 Committing..."
git commit -m "Initial commit: Bond Sports Program Discovery Platform" || echo "Already committed"

# Set main branch
echo "🔀 Setting main branch..."
git branch -M main

# Add remote
echo "🔗 Adding remote origin..."
git remote remove origin 2>/dev/null
git remote add origin https://github.com/$USERNAME/$REPO_NAME.git

# Push
echo "🚀 Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Done!"
echo "📍 Repository: https://github.com/$USERNAME/$REPO_NAME"
echo ""
echo "Next steps:"
echo "1. Go to GitHub and verify files are there"
echo "2. Deploy to Vercel: https://vercel.com"
echo "3. Share your live link!"
