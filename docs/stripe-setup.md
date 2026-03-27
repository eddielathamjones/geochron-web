# Stripe Setup — geochron-web $5/mo Embed

## Product

- **Name:** geochron-web hosted embed
- **Price:** $5/mo recurring
- **What it unlocks:** Remove attribution badge (`?badge=false`), custom vibe, priority support

## Setup Steps

### 1. Create the Stripe product

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Create product: "geochron-web embed"
3. Add price: $5.00/month recurring
4. Copy the Payment Link URL

### 2. Add the payment link to the badge

In `src/frontend/css/embed.css`, the `#geochron-badge` links to GitHub.
After Stripe is set up, update `src/frontend/js/app.js`:

```javascript
// In buildAttributionBadge()
badge.href = 'https://buy.stripe.com/YOUR_PAYMENT_LINK';
badge.title = 'Remove badge — $5/mo';
```

### 3. Key validation (MVP approach)

For the MVP, use a simple approach: honor `?badge=false` only when a valid key is present.

Add to Flask `app.py`:

```python
import os

PAID_KEYS = set(os.environ.get('PAID_KEYS', '').split(','))

@app.route('/api/validate-key')
def validate_key():
    key = request.args.get('key', '')
    return jsonify({'valid': key in PAID_KEYS and key != ''})
```

Set env var `PAID_KEYS=key1,key2,key3` on Render.

After Stripe payment, webhook creates a key and emails it to the customer. Start manually: email the key directly.

### 4. Stripe webhook (post-MVP)

When automating key delivery:
1. Create a webhook for `checkout.session.completed`
2. Generate a random key, store in DB (or just in env for small scale)
3. Email key to customer via SendGrid or similar

### 5. Pricing page

Simple HTML page at `/pricing`:

```
Free tier:  iframe embed, ?badge=true required
$5/mo:      badge-free, custom styling, email support
```

Link from README and badge tooltip.

## Revenue Projection

| Customers | Monthly | Annual |
|-----------|---------|--------|
| 10        | $50     | $600   |
| 50        | $250    | $3,000 |
| 100       | $500    | $6,000 |

Niche + working + cheap = sticky. Target: logistics dashboards, weather hobbyists, GIS devs.
