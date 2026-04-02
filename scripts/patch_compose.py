import sys
with open(sys.argv[1]) as f:
    content = f.read()

old = '      API_KEY: "${API_KEY:-}"'
new = '''      API_KEY: "${API_KEY:-}"
      JWT_SECRET: "${JWT_SECRET:-}"
      STRIPE_SECRET_KEY: "${STRIPE_SECRET_KEY:-}"
      STRIPE_WEBHOOK_SECRET: "${STRIPE_WEBHOOK_SECRET:-}"
      STRIPE_PRO_PRICE_ID: "${STRIPE_PRO_PRICE_ID:-}"
      STRIPE_ENTERPRISE_PRICE_ID: "${STRIPE_ENTERPRISE_PRICE_ID:-}"
      RESEND_API_KEY: "${RESEND_API_KEY:-}"
      FROM_EMAIL: "${FROM_EMAIL:-noreply@aeneassoft.com}"
      SUPPORT_EMAIL: "${SUPPORT_EMAIL:-leonhard.hampe@aeneassoft.com}"
      SALES_EMAIL: "${SALES_EMAIL:-leonhard.hampe@aeneassoft.com}"
      CORS_ORIGINS: "https://aeneassoft.com,https://www.aeneassoft.com"'''

if old in content:
    content = content.replace(old, new)
    with open(sys.argv[1], 'w') as f:
        f.write(content)
    print("PATCHED")
else:
    print("ALREADY PATCHED or NOT FOUND")
