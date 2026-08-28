# 🚀 WA Bulk / WA Boss - Automated WhatsApp Marketing Tool

Open-source, free, unlimited WhatsApp marketing automation with Shopee Affiliate integration, Facebook Developer support, and built-in anti-spam safety features.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Endpoints](#-api-endpoints)
- [Safety & Anti-Spam](#-safety--anti-spam)
- [Platform Recommendations](#-platform-recommendations)
- [Facebook Developer Integration](#-facebook-developer-integration)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### Core Features
- ✅ **Bulk WhatsApp Messaging** - Send messages to multiple contacts safely
- ✅ **Campaign Scheduler** - Schedule campaigns for later execution
- ✅ **Message Templates** - Create and manage reusable message templates
- ✅ **Shopee Affiliate Integration** - Auto-generate affiliate links from product URLs
- ✅ **Contact Management** - Add, import, and manage contacts with tags
- ✅ **Opt-out Management** - Automatic opt-out handling (STOP keyword)
- ✅ **Rate Limiting** - Built-in safety limits to prevent spam
- ✅ **Warm-up Mode** - Gradual warm-up for new WhatsApp numbers
- ✅ **Message Logging** - Track all sent/failed messages

### Platform Integrations
- 📱 **WhatsApp (Baileys)** - Open-source, free, self-hosted
- 📘 **Facebook Graph API** - Meta Business WhatsApp Cloud API
- 🛒 **Shopee Affiliate API** - Auto-generate affiliate links

### Safety Features
- 🔒 Daily/hourly rate limits
- 🔒 Minimum delay between messages
- 🔒 Opt-out keyword detection (STOP, BERHENTI, etc.)
- 🔒 Warm-up mode for new numbers
- 🔒 Message content validation
- 🔒 Compliance reporting

---

## 🛠️ Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Runtime** | Node.js | Fast, scalable, huge ecosystem |
| **Language** | TypeScript | Type safety, better DX |
| **WhatsApp Library** | Baileys | Open-source, free, MIT license |
| **Database** | SQLite (better-sqlite3) | Zero-config, fast, serverless |
| **API Server** | Express.js | Lightweight, battle-tested |
| **Job Queue** | BullMQ + Redis | Reliable scheduled campaigns |
| **Scheduler** | node-cron | Cron-based scheduling |
| **HTTP Client** | Axios | Reliable API calls |
| **Logging** | Winston + Pino | Structured logging with rotation |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Express Dashboard API                  │
│  (Port 3000 - REST API for all operations)               │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌────────┐     ┌──────────┐   ┌──────────┐
   │WhatsApp│     │Facebook  │   │ Shopee   │
   │Service │     │Graph API │   │ Affiliate│
   │Baileys │     │(Optional)│   │   API    │
   └────┬───┘     └──────────┘   └────┬─────┘
        │                             │
        ▼                             ▼
   ┌────────────┐              ┌──────────────┐
   │   SQLite   │              │  Affiliate   │
   │  Database  │              │   Products   │
   └────────────┘              └──────────────┘

┌─────────────────────────────────────────────────────────┐
│              Safety & Rate Limiting Layer                │
│  • Opt-out detection    • Warm-up mode                  │
│  • Daily/hourly limits  • Delay enforcement             │
│  • Content validation   • Compliance reporting          │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Installation

### Prerequisites
- Node.js 18+ (recommended 20+)
- npm or yarn
- Git

### Steps

1. **Clone the repository**
   ```bash
   cd D:\WABulk_Fadil_Labs
   git clone <your-repo-url> .
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment**
   ```bash
   copy .env.example .env
   ```
   
   Edit `.env` with your configuration (see [Configuration](#configuration) section)

4. **Initialize database**
   ```bash
   npm run db:migrate
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

6. **Scan QR Code**
   
   When you first run the app, a QR code will appear in the terminal:
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices → Link a Device
   - Scan the QR code from the terminal

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_PATH=./data/wabulk.db

# Redis (optional - for BullMQ)
REDIS_URL=redis://localhost:6379

# Shopee Affiliate (optional)
SHOPEE_APP_ID=your_app_id
SHOPEE_AFFILIATE_SECRET=your_secret
SHOPEE_REGION=id

# Facebook Developer (optional)
FACEBOOK_APP_ID=your_fb_app_id
FACEBOOK_APP_SECRET=your_fb_app_secret
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
FACEBOOK_WHATSAPP_BUSINESS_ID=your_wa_business_id
FACEBOOK_GRAPH_API_VERSION=v18.0

# Safety Limits
MAX_MESSAGES_PER_DAY=50
MAX_MESSAGES_PER_HOUR=10
MIN_DELAY_BETWEEN_MESSAGES_MS=5000
MAX_DELAY_BETWEEN_MESSAGES_MS=30000

# Warm-up Mode (for new numbers)
WARMUP_START_DAY=1
WARMUP_END_DAY=14
WARMUP_START_LIMIT=5
WARMUP_END_LIMIT=50

# Security
JWT_SECRET=your_jwt_secret_change_this_in_production
ENCRYPTION_KEY=your_32_character_encryption_key_here
```

---

## 🎯 Usage

### Starting the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build
npm start

# Start dashboard only
npm run dashboard
```

### API Endpoints

All endpoints are prefixed with `/api`. Use the API key `Authorization: Bearer <JWT_SECRET>` for authentication.

#### WhatsApp
- `POST /api/whatsapp/connect` - Connect to WhatsApp
- `GET /api/whatsapp/status` - Check connection status
- `POST /api/whatsapp/send` - Send single message
- `POST /api/whatsapp/send-bulk` - Send bulk messages (max 100)

#### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Add contact

#### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `POST /api/campaigns/:id/stop` - Stop campaign

#### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template

#### Messages
- `GET /api/messages/logs` - Get message logs

#### Shopee Affiliate
- `GET /api/shopee/products?keyword=sepatu` - Search products
- `POST /api/shopee/generate-link` - Generate affiliate link

#### Facebook Integration
- `POST /api/facebook/send` - Send via Facebook WhatsApp API
- `GET /api/facebook/webhook` - Webhook verification
- `POST /api/facebook/webhook` - Webhook handler

#### Safety
- `GET /api/safety/metrics` - Get safety metrics
- `GET /api/safety/compliance` - Get compliance report

---

## 🛡️ Safety & Anti-Spam

### Rate Limits
- **Daily limit**: 50 messages/day (configurable)
- **Hourly limit**: 10 messages/hour (configurable)
- **Minimum delay**: 5-30 seconds between messages (randomized)
- **Warm-up mode**: Gradual increase from 5 to 50 messages over 14 days

### Opt-out Management
- Automatic opt-out on keywords: `STOP`, `BERHENTI`, `UNSUBSCRIBE`, `KELUAR`, `STOP MARKETING`, `OPT OUT`
- Manual opt-out via API
- Opt-out list maintained in database
- All opt-outs are logged

### Content Validation
- Maximum 4096 characters per message
- Spam pattern detection
- Compliance reporting

### Warm-up Mode (Recommended for New Numbers)
- Day 1-3: 5 messages/day
- Day 4-7: 10 messages/day
- Day 8-14: 25 messages/day
- Day 15+: 50 messages/day

**⚠️ Important**: Always warm up new WhatsApp numbers for at least 14 days before sending bulk messages. This prevents your number from being banned.

---

## 🏆 Platform Recommendations

### Best Platforms for Fast Sales (No Setup Fees)

| Platform | Setup Time | Fees | Best For | Why |
|----------|-----------|------|----------|-----|
| **TikTok Shop** | 2-4 hours | 0-2% | Fast viral sales | Native shopping, 4.7% conversion rate, creator ecosystem |
| **Shopee** | 1-2 hours | 0-3% | General ecommerce | Built-in affiliate program, massive SE Asia traffic |
| **Payhip** | 15 mins | 5% | Digital products | Free forever plan, unlimited products, built-in audience |
| **Square Online** | 30 mins | 0% | Local/pop-up sales | Free POS, no monthly fee, fast activation |
| **WooCommerce** | 1-2 hours | 0% | Full control | WordPress ecosystem, unlimited customization |
| **Stripe + Link** | 5 mins | 2.9% + $0.30 | Quick payments | Instant payment links, no store needed |

### Recommended Strategy for Fastest Sales

1. **TikTok Shop** (Primary) - Highest conversion rate (4.7%), native shopping experience
2. **Shopee Affiliate** (Secondary) - Massive traffic, built-in affiliate system
3. **Payhip** (Tertiary) - For digital products, zero setup cost

### How to Get Sales Fast:

1. **TikTok Shop** - Post 3 short videos/day showing your product
2. **Shopee Affiliate** - Share affiliate links in WA groups
3. **Facebook/Instagram** - Use your Facebook Developer account for ads
4. **Cross-promotion** - Link all platforms together

---

## 📘 Facebook Developer Integration

You mentioned you're already registered as a Facebook Developer. Here's how to leverage it:

### Setup Steps

1. **Create Meta App**
   - Go to [Meta for Developers](https://developers.facebook.com/apps/)
   - Create new app → Select "Business" type
   - Add "WhatsApp" product

2. **Configure WhatsApp Business API**
   - Get your WhatsApp Business Account ID
   - Generate permanent access token
   - Set webhook URL: `https://your-domain.com/api/facebook/webhook`
   - Verify webhook token

3. **Environment Variables**
   ```env
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
   FACEBOOK_WHATSAPP_BUSINESS_ID=your_wa_business_id
   FACEBOOK_GRAPH_API_VERSION=v18.0
   ```

4. **Benefits**
   - ✅ Official WhatsApp API (no ban risk)
   - ✅ 1,000 free conversations/month
   - ✅ Green tick verification path
   - ✅ Template message support
   - ✅ Webhook for incoming messages

### When to Use Facebook API vs Baileys

| Feature | Baileys (Free) | Facebook API (Official) |
|---------|---------------|------------------------|
| Cost | Free | Free tier + per-msg fees |
| Ban Risk | Higher | None (official) |
| Setup Complexity | Easy | Medium |
| Volume | Small-medium | Large-scale |
| Features | Basic | Advanced (templates, etc.) |

**Recommendation**: Use Baileys for development/testing, switch to Facebook API for production bulk sending.

---

## 🚀 Deployment

### Option 1: Local Machine (Recommended for Testing)
```bash
npm run dev
```

### Option 2: VPS (Production)
```bash
# Using PM2
npm install -g pm2
npm run build
pm2 start dist/index.js --name wabulk
pm2 save
pm2 startup
```

### Option 3: Docker
```bash
docker-compose up -d
```

### Recommended VPS Providers
- **DigitalOcean** - $4/month droplet
- **Vultr** - $2.50/month
- **Hetzner** - €3/month
- **AWS Lightsail** - $3.50/month

---

## 📊 Example Workflows

### Workflow 1: Shopee Affiliate Marketing
```
1. Search products: GET /api/shopee/products?keyword=sepatu
2. Generate affiliate link: POST /api/shopee/generate-link
3. Create template: POST /api/templates (with affiliate link)
4. Add contacts: POST /api/contacts
5. Create campaign: POST /api/campaigns
6. Start campaign: POST /api/campaigns/:id/start
```

### Workflow 2: Bulk Messaging
```
1. Import contacts via API
2. Create message template with variables: {{name}}, {{phone}}
3. Create campaign with template
4. Schedule or start campaign
5. Monitor via GET /api/messages/logs
```

### Workflow 3: Multi-Platform Sales
```
1. Post products to TikTok Shop
2. Generate Shopee affiliate links
3. Share links in WhatsApp groups (using this tool)
4. Track conversions via Shopee API
5. Optimize based on best-performing products
```

---

## ⚠️ Important Notes

### WhatsApp Spam Prevention
- **Always warm up new numbers** for 14 days before bulk sending
- **Keep daily limits low** (50 messages/day recommended)
- **Respect opt-outs** immediately
- **Personalize messages** - avoid generic spam
- **Use official API** for large volumes

### Legal Compliance
- Only send to contacts who have opted in
- Include opt-out instructions in first message
- Follow local regulations (GDPR, UU ITE, etc.)
- Keep records of consent

### Best Practices
1. Start with small batches (10-20 messages/day)
2. Gradually increase volume over 2-4 weeks
3. Monitor opt-out rates (< 2% is acceptable)
4. A/B test message templates
5. Track conversion rates per template

---

## 🐛 Troubleshooting

### QR Code not appearing
- Make sure you're running in development mode
- Check terminal output for QR code
- Try restarting the application

### Messages not sending
- Check WhatsApp connection status: `GET /api/whatsapp/status`
- Verify rate limits haven't been exceeded
- Check message logs for errors: `GET /api/messages/logs`

### Number getting banned
- You're sending too fast - reduce limits
- Messages are spammy - improve content
- Contacts didn't opt in - fix opt-in flow
- Switch to official Facebook WhatsApp API

### Database errors
- Delete `data/wabulk.db` and restart
- Check file permissions
- Ensure disk space is available

---

## 📚 Resources

- [Baileys Documentation](https://baileys.wiki)
- [Shopee Affiliate API](https://open.shopee.com/developer-guide/702)
- [Facebook WhatsApp Business API](https://developers.facebook.com/documentation/business-messaging/whatsapp/)
- [WhatsApp Business Platform](https://business.whatsapp.com/)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

---

## 👨‍💻 Author

**Fadil Labs** - Built with ❤️ for the community

---

## 🙏 Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Shopee Open Platform](https://open.shopee.com/) - Affiliate API
- [Meta for Developers](https://developers.facebook.com/) - WhatsApp Business API

---

**⚠️ Disclaimer**: Use this tool responsibly. Spamming is illegal in many jurisdictions and violates WhatsApp's Terms of Service. Always obtain proper consent before sending marketing messages. The author is not responsible for misuse of this software.
