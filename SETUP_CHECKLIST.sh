#!/usr/bin/env bash
# SwiftColis Features Checklist & Quick Start
# Date: 2026-03-24

set -e

PROJECT="SwiftColis"
FEATURES_COMPLETED=2

echo "🚀 $PROJECT - Setup Checklist for Features 1-2"
echo "================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Feature 1 Checklist
echo -e "${YELLOW}📦 Feature #1: Core Backend (QR + Relay + Matching + Security + CI/CD)${NC}"
echo "Status: ✅ PRODUCTION READY"
echo ""
echo "Checklist:"
echo "  [x] QR code generation implemented"
echo "  [x] 4 relay scan endpoints (depot, remise, arrivee, livraison)"
echo "  [x] Automatic matching service"
echo "  [x] Security middleware (edge + api)"
echo "  [x] Role-based access control"
echo "  [x] GitHub Actions CI/CD workflow"
echo "  [x] Smoke tests (21 phases passing)"
echo "  [ ] Deploy to staging"
echo "  [ ] Deploy to production"
echo ""

# Feature 2 Checklist
echo -e "${YELLOW}🚨 Feature #2: Blocked Parcels Alert System${NC}"
echo "Status: ✅ PRODUCTION READY"
echo ""
echo "Checklist:"
echo "  [x] Detection logic (colis status figé > X heures)"
echo "  [x] 4 API endpoints (list, stats, alert, cron)"
echo "  [x] Multi-recipient notifications (admin/client/transporter)"
echo "  [x] Dashboard UI component (React)"
echo "  [x] Cron job support"
echo "  [x] Security (role-based + secret cron)"
echo "  [x] Complete documentation"
echo "  [ ] Configure CRON_SECRET in .env"
echo "  [ ] Integrate component in admin dashboard"
echo "  [ ] Setup cron job (Vercel/EasyCron/Node.js)"
echo "  [ ] Deploy to production"
echo ""

# Quick Start
echo -e "${GREEN}⚡ QUICK START${NC}"
echo ""

read -p "Do you want to setup the project now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "1️⃣ Install dependencies..."
    npm install
    
    echo ""
    echo "2️⃣ Generate Prisma Client..."
    npx prisma generate
    
    echo ""
    echo "3️⃣ Check .env configuration..."
    if [ ! -f .env.local ]; then
        echo -e "${RED}⚠️  .env.local not found${NC}"
        echo "Create .env.local with:"
        echo "  DATABASE_URL=postgresql://..."
        echo "  NEXTAUTH_SECRET=<generated>"
        echo "  CRON_SECRET=<generated>"
    else
        echo -e "${GREEN}✅ .env.local exists${NC}"
    fi
    
    echo ""
    echo "4️⃣ Build the project..."
    npm run build
    
    echo ""
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Build successful!${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Review .github/ documentation files"
        echo "  2. Configure GitHub Secrets (if using GitHub Actions)"
        echo "  3. Configure CRON_SECRET for alert system"
        echo "  4. Run: npm run dev"
        echo "  5. Test endpoints manually"
    else
        echo -e "${RED}❌ Build failed${NC}"
        echo "Check the build output above for errors."
    fi
fi

echo ""
echo -e "${YELLOW}📚 Documentation Files${NC}"
echo "  .github/CI_CD_SETUP.md            — GitHub Actions + Secrets config"
echo "  .github/QUICK_SETUP.md            — 5-min GitHub setup"
echo "  .github/BLOCKED_PARCELS_ALERTS.md — Alert system API reference"
echo "  .github/SETUP_BLOCKED_ALERTS.md   — Alert system integration"
echo "  .github/PROJECT_STATUS.md          — Overall project status"
echo ""

echo -e "${YELLOW}🧪 Test the Features${NC}"
echo "  # Start server"
echo "  npm run dev"
echo ""
echo "  # In another terminal, test endpoints:"
echo "  bash test-blocked-alerts.sh"
echo ""
echo "  # Or run smoke tests:"
echo "  npm run smoke:ci"
echo ""

echo -e "${GREEN}✨ All set! Now integrate and deploy.${NC}"
