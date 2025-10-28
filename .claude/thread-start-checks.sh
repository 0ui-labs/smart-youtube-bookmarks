#!/bin/bash
# Thread Start Checks for Smart YouTube Bookmarks
# Run this at the beginning of EVERY new thread to verify tool setup

echo "=========================================="
echo "🔍 Thread Start Checks"
echo "=========================================="
echo ""

# 1. Git Status
echo "📊 Git Status:"
echo "----------------------------------------"
git status -sb
echo ""
echo "Recent commits:"
git log --oneline -5
echo ""

# 2. Semgrep Authentication
echo "🔍 Semgrep Status:"
echo "----------------------------------------"
if semgrep login 2>&1 | grep -q "already exists"; then
    echo "✅ Semgrep authenticated (Pro Rules available)"
    echo "   Version: $(semgrep --version)"
    echo "   Pro Rules: FastAPI, React, Django, Flask, Express"
else
    echo "⚠️  Semgrep NOT authenticated"
    echo "   Run: semgrep login"
    echo "   Impact: Missing 637 FastAPI/React Pro Rules!"
fi
echo ""

# 3. CodeRabbit Authentication
echo "🤖 CodeRabbit Status:"
echo "----------------------------------------"
if command -v coderabbit &> /dev/null; then
    if coderabbit auth status 2>&1 | grep -q "authenticated"; then
        echo "✅ CodeRabbit authenticated"
        CODERABBIT_VERSION=$(coderabbit --version 2>&1 | head -1 || echo "Unknown")
        echo "   Version: $CODERABBIT_VERSION"
    else
        echo "⚠️  CodeRabbit NOT authenticated"
        echo "   Run: coderabbit auth login"
    fi
else
    echo "⚠️  CodeRabbit CLI not installed"
    echo "   Install: curl -fsSL https://cli.coderabbit.ai/install.sh | sh"
fi
echo ""

# 4. Python Environment
echo "🐍 Python Environment:"
echo "----------------------------------------"
echo "Python: $(python3 --version)"
echo "Pip: $(pip3 --version | cut -d' ' -f1-2)"
echo ""

# 5. Node Environment
echo "📦 Node Environment:"
echo "----------------------------------------"
if command -v node &> /dev/null; then
    echo "Node: $(node --version)"
    echo "npm: $(npm --version)"
else
    echo "⚠️  Node not found"
fi
echo ""

# 6. Docker Services
echo "🐳 Docker Services:"
echo "----------------------------------------"
if command -v docker-compose &> /dev/null; then
    if docker-compose ps 2>/dev/null | grep -q "Up"; then
        echo "✅ Docker services running:"
        docker-compose ps | grep "Up" | awk '{print "   -", $1, "(" $4 ")"}'
    else
        echo "⚠️  Docker services not running"
        echo "   Start: docker-compose up -d postgres redis"
    fi
else
    echo "⚠️  docker-compose not found"
fi
echo ""

# 7. Summary
echo "=========================================="
echo "📋 Summary"
echo "=========================================="
echo ""

ISSUES=0

# Check semgrep
if ! semgrep login 2>&1 | grep -q "already exists"; then
    echo "⚠️  ACTION REQUIRED: semgrep login"
    ISSUES=$((ISSUES + 1))
fi

# Check CodeRabbit
if command -v coderabbit &> /dev/null; then
    if ! coderabbit auth status 2>&1 | grep -q "authenticated"; then
        echo "⚠️  ACTION REQUIRED: coderabbit auth login"
        ISSUES=$((ISSUES + 1))
    fi
else
    echo "⚠️  ACTION REQUIRED: Install CodeRabbit CLI"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ All tools ready! You can start working."
else
    echo ""
    echo "Found $ISSUES issue(s) that need attention."
    echo "Fix these before starting Phase 1 of the workflow."
fi

echo ""
echo "=========================================="
echo "Next Steps:"
echo "1. Read .claude/DEVELOPMENT_WORKFLOW.md"
echo "2. Read CLAUDE.md"
echo "3. Load Skill(superpowers:using-superpowers)"
echo "4. Continue with workflow Phase 1"
echo "=========================================="
