import os
import re
import sys
import httpx

BASE = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
CUSTOMER_EMAIL = "customer.regression@example.com"
CUSTOMER_PASSWORD = "CustomerPass123!"
MERCHANT_EMAIL = os.getenv("DEMO_MERCHANT_EMAIL", "merchant.regression@example.com")
MERCHANT_PASSWORD = os.getenv("DEMO_MERCHANT_PASSWORD", "MerchantPass123!")

client = httpx.Client(base_url=BASE, timeout=30.0)
results = []
failures = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {detail}")
    if not ok:
        failures.append((name, detail))


def call(name, method, path, *, expected, token=None, json=None, data=None, params=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        r = client.request(method, path, headers=headers, json=json, data=data, params=params)
        allowed = {expected} if isinstance(expected, int) else set(expected)
        ok = r.status_code in allowed
        body = r.text[:500].replace("\n", " ")
        record(name, ok, f"HTTP {r.status_code}; {body}")
        return r
    except Exception as exc:
        record(name, False, f"request exception: {exc}")
        return None


# Basic service / schema
call("root", "GET", "/", expected=200)
call("health", "GET", "/health", expected=200)
openapi = call("openapi", "GET", "/openapi.json", expected=200)
schema = openapi.json() if openapi is not None and openapi.status_code == 200 else {"paths": {}}
record("openapi route count", len(schema.get("paths", {})) >= 20, f"{len(schema.get('paths', {}))} paths")

# Public catalog + marketplace variants
products = call("products list", "GET", "/products", expected=200)
product_data = products.json() if products is not None and products.status_code == 200 else {}
all_products = product_data.get("products", [])
record("products non-empty", len(all_products) > 0, f"{len(all_products)} products")

cafe_products = call("products merchant filter", "GET", "/products", expected=200, params={"merchant_id": "cafe-verde"})
cafe_list = cafe_products.json().get("products", []) if cafe_products is not None and cafe_products.status_code == 200 else []
record("cafe-verde catalog available", len(cafe_list) > 0, f"{len(cafe_list)} products")
first = cafe_list[0] if cafe_list else {}
combined_product_id = first.get("id", "cafe-verde_missing")
raw_product_id = combined_product_id.split("_", 1)[1] if "_" in combined_product_id else "missing"
call("products search", "GET", "/products", expected=200, params={"search": first.get("name", "coffee")})
call("product detail", "GET", f"/products/{combined_product_id}", expected=200 if first else 404)
call("product malformed id", "GET", "/products/not-a-combined-id", expected=400)
call("merchant products", "GET", "/products/merchant/cafe-verde", expected=200)
call("unknown merchant products", "GET", "/products/merchant/no-such-merchant", expected=404)
call("marketplace merchants", "GET", "/marketplace/merchants", expected=200)
call("marketplace categories", "GET", "/marketplace/categories", expected=200)
call("marketplace merchant detail", "GET", "/marketplace/merchants/cafe-verde", expected=200)
call("marketplace missing merchant", "GET", "/marketplace/merchants/no-such-merchant", expected=404)
call("marketplace discover", "POST", "/marketplace/discover", expected=200, json={"query": "coffee breakfast", "max_distance": 10})
call("marketplace discover validation", "POST", "/marketplace/discover", expected=422, json={})
call("marketplace order intentionally disabled", "POST", "/marketplace/order", expected=503, json={"merchant_id": "cafe-verde", "items": [], "customer_id": "test"})
call("marketplace customer profile intentionally disabled", "GET", "/marketplace/customer/test", expected=503)

# Auth negative + customer happy path
call("signup invalid email", "POST", "/auth/signup", expected=422, json={"name": "Bad", "email": "not-an-email", "password": "Password123!"})
signup = call("customer signup", "POST", "/auth/signup", expected=200, json={"name": "Regression Customer", "email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD})
customer_token = signup.json().get("access_token") if signup is not None and signup.status_code == 200 else None
record("signup returns bearer token", bool(customer_token), "token present" if customer_token else "missing token")
call("duplicate signup", "POST", "/auth/signup", expected=400, json={"name": "Duplicate", "email": CUSTOMER_EMAIL.upper(), "password": CUSTOMER_PASSWORD})
call("login json wrong password", "POST", "/auth/login/json", expected=401, json={"email": CUSTOMER_EMAIL, "password": "wrong-password"})
login_json = call("login json valid", "POST", "/auth/login/json", expected=200, json={"email": CUSTOMER_EMAIL.upper(), "password": CUSTOMER_PASSWORD})
if login_json is not None and login_json.status_code == 200:
    customer_token = login_json.json().get("access_token", customer_token)
call("login form valid", "POST", "/auth/login", expected=200, data={"username": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD})
call("auth me missing token", "GET", "/auth/me", expected=401)
call("auth me bad token", "GET", "/auth/me", expected=401, token="definitely.invalid.token")
me = call("auth me customer", "GET", "/auth/me", expected=200, token=customer_token)
if me is not None and me.status_code == 200:
    record("customer role resolved", me.json().get("role") == "customer" and me.json().get("merchant_id") is None, str(me.json()))
call("update customer profile", "PUT", "/auth/me", expected=200, token=customer_token, json={"name": "Regression Customer Updated", "notification_sms": True})
me2 = call("verify profile update", "GET", "/auth/me", expected=200, token=customer_token)
if me2 is not None and me2.status_code == 200:
    record("profile name persisted", me2.json().get("name") == "Regression Customer Updated", str(me2.json()))

# Protected customer domain without auth should be rejected
for method, path in [
    ("GET", "/cart"), ("GET", "/orders"), ("GET", "/rules"),
    ("GET", "/wallet/cards"), ("GET", "/approvals"), ("GET", "/dashboard/overview"),
    ("GET", "/agent/tasks"), ("POST", "/payments/checkout")
]:
    kwargs = {"json": {}} if method == "POST" else {}
    call(f"unauthorized {method} {path}", method, path, expected=(401, 422), **kwargs)

# Dashboard / rules / agent state
for path in ["/dashboard/stats", "/dashboard/recent-orders", "/dashboard/pending-approvals", "/dashboard/feed", "/dashboard/overview"]:
    call(f"customer {path}", "GET", path, expected=200, token=customer_token)
call("rules get", "GET", "/rules", expected=200, token=customer_token)
call("rules update", "PUT", "/rules", expected=200, token=customer_token, json={"monthly_budget": 1234.5, "merchant_whitelist": ["cafe-verde"]})
call("rules toggle category", "POST", "/rules/categories/Groceries/toggle", expected=200, token=customer_token)
call("rules category limit", "PUT", "/rules/categories/Groceries/limit", expected=200, token=customer_token, params={"limit": 321.0})
call("agent tasks", "GET", "/agent/tasks", expected=200, token=customer_token)
call("agent feed", "GET", "/agent/feed", expected=200, token=customer_token)
call("agent pause", "PUT", "/agent/pause", expected=200, token=customer_token)
paused = call("profile reflects paused agent", "GET", "/auth/me", expected=200, token=customer_token)
if paused is not None and paused.status_code == 200:
    record("agent_paused persisted", paused.json().get("agent_paused") is True, str(paused.json()))
call("agent resume", "PUT", "/agent/resume", expected=200, token=customer_token)
call("agent checkout intentionally disabled", "POST", "/agent/task", expected=503, token=customer_token, json={"task": "buy a coffee", "priority": "normal"})

# Wallet / approvals intentional safety behavior
call("wallet cards", "GET", "/wallet/cards", expected=200, token=customer_token)
call("wallet transactions", "GET", "/wallet/transactions", expected=200, token=customer_token)
call("wallet balance", "GET", "/wallet/balance", expected=200, token=customer_token)
call("wallet card creation intentionally disabled", "POST", "/wallet/cards", expected=503, token=customer_token, json={"label": "Test", "type": "single-use", "limit": 100})
call("wallet missing card pause", "PUT", "/wallet/cards/missing/pause", expected=404, token=customer_token)
call("wallet missing card resume", "PUT", "/wallet/cards/missing/resume", expected=404, token=customer_token)
call("wallet missing card destroy", "DELETE", "/wallet/cards/missing", expected=404, token=customer_token)
call("approvals list", "GET", "/approvals", expected=200, token=customer_token)
call("approvals count", "GET", "/approvals/count", expected=200, token=customer_token)
call("approve missing approval", "POST", "/approvals/missing/approve", expected=404, token=customer_token)
call("decline missing approval", "POST", "/approvals/missing/decline", expected=404, token=customer_token)

# Cart full lifecycle
call("cart starts readable", "GET", "/cart", expected=200, token=customer_token)
call("cart invalid merchant", "POST", "/cart/add", expected=404, token=customer_token, json={"merchant_id": "missing", "product_id": raw_product_id, "quantity": 1})
call("cart invalid product", "POST", "/cart/add", expected=404, token=customer_token, json={"merchant_id": "cafe-verde", "product_id": "missing", "quantity": 1})
if first:
    call("cart add valid", "POST", "/cart/add", expected=200, token=customer_token, json={"merchant_id": "cafe-verde", "product_id": raw_product_id, "quantity": 2})
    cart = call("cart contains added item", "GET", "/cart", expected=200, token=customer_token)
    if cart is not None and cart.status_code == 200:
        record("cart count is 2", cart.json().get("count") == 2, str(cart.json()))
    call("cart update quantity", "PUT", "/cart/update", expected=200, token=customer_token, json={"merchant_id": "cafe-verde", "product_id": raw_product_id, "quantity": 1})
    call("cart remove valid", "DELETE", "/cart/remove", expected=200, token=customer_token, params={"merchant_id": "cafe-verde", "product_id": raw_product_id})
    call("cart remove missing", "DELETE", "/cart/remove", expected=404, token=customer_token, params={"merchant_id": "cafe-verde", "product_id": raw_product_id})
call("cart clear", "DELETE", "/cart/clear", expected=200, token=customer_token)

# Checkout -> persistent customer order -> review lifecycle
order_id = None
if first:
    checkout_payload = {
        "merchantId": "cafe-verde",
        "items": [{"productId": raw_product_id, "quantity": 2}],
        "paymentMethod": "cod",
        "deliveryAddress": "Regression Test Address",
        "cookingInstructions": "No sugar",
    }
    call("checkout bad product", "POST", "/payments/checkout", expected=422, token=customer_token, json={**checkout_payload, "items": [{"productId": "missing", "quantity": 1}]})
    checkout = call("checkout valid", "POST", "/payments/checkout", expected=200, token=customer_token, json=checkout_payload)
    if checkout is not None and checkout.status_code == 200:
        order_id = checkout.json().get("order", {}).get("orderId")
        record("checkout creates order id", bool(order_id), str(checkout.json())[:500])
call("orders list", "GET", "/orders", expected=200, token=customer_token)
call("order stats", "GET", "/orders/stats", expected=200, token=customer_token)
call("missing order", "GET", "/orders/missing-order", expected=404, token=customer_token)
if order_id:
    call("created order detail", "GET", f"/orders/{order_id}", expected=200, token=customer_token)
    call("review created order", "POST", "/payments/reviews", expected=201, token=customer_token, json={"orderId": order_id, "rating": 4, "review": "Regression test review"})
    call("duplicate review blocked", "POST", "/payments/reviews", expected=409, token=customer_token, json={"orderId": order_id, "rating": 5, "review": "duplicate"})
call("review unknown order", "POST", "/payments/reviews", expected=404, token=customer_token, json={"orderId": "missing", "rating": 3, "review": "none"})

# Merchant role/login + authorization boundary
merchant_login = call("merchant login", "POST", "/auth/login/json", expected=200, json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD})
merchant_token = merchant_login.json().get("access_token") if merchant_login is not None and merchant_login.status_code == 200 else None
record("merchant token present", bool(merchant_token), "token present" if merchant_token else "missing")
merchant_me = call("merchant profile", "GET", "/auth/me", expected=200, token=merchant_token)
if merchant_me is not None and merchant_me.status_code == 200:
    record("merchant role resolved", merchant_me.json().get("role") == "merchant" and merchant_me.json().get("merchant_id") == "cafe-verde", str(merchant_me.json()))
call("customer blocked from merchant dashboard", "GET", "/merchant/dashboard", expected=403, token=customer_token)
call("bad token merchant dashboard", "GET", "/merchant/dashboard", expected=401, token="bad.token")
merchant_dashboard = call("merchant dashboard", "GET", "/merchant/dashboard", expected=200, token=merchant_token)
if merchant_dashboard is not None and merchant_dashboard.status_code == 200:
    data = merchant_dashboard.json()
    record("merchant KPI data seeded", data.get("kpis", {}).get("totalOrders", 0) >= 780, str(data.get("kpis")))
    record("merchant review data seeded", data.get("reviews", {}).get("count", 0) >= 260, str(data.get("reviews", {}).get("count")))
call("merchant review insights fallback", "POST", "/merchant/reviews/insights", expected=200, token=merchant_token)
forecast = call("merchant forecast", "POST", "/merchant/forecast/today", expected=200, token=merchant_token, params={"timezone": "Asia/Kolkata"})
if forecast is not None and forecast.status_code == 200:
    record("forecast has analysis source", forecast.json().get("analysisSource") in {"gemini", "evidence_fallback", "historical"}, str(forecast.json().get("analysisSource")))
call("merchant invalid timezone", "POST", "/merchant/forecast/today", expected=400, token=merchant_token, params={"timezone": "Not/A_Timezone"})
if first:
    call("merchant cannot customer-checkout", "POST", "/payments/checkout", expected=403, token=merchant_token, json={
        "merchantId": "cafe-verde", "items": [{"productId": raw_product_id, "quantity": 1}],
        "paymentMethod": "cod", "deliveryAddress": "test", "cookingInstructions": ""
    })

# Every OpenAPI operation gets at least one request; any unhandled HTTP 500 is a regression.
allowed_5xx = {
    ("POST", "/agent/task"): 503,
    ("POST", "/wallet/cards"): 503,
    ("POST", "/marketplace/order"): 503,
    ("GET", "/marketplace/customer/{customer_id}"): 503,
}
for path, ops in schema.get("paths", {}).items():
    for method in [m for m in ops.keys() if m.lower() in {"get", "post", "put", "delete", "patch"}]:
        method_u = method.upper()
        actual = path
        for param in re.findall(r"\{([^}]+)\}", path):
            value = {
                "merchant_id": "cafe-verde", "product_id": combined_product_id,
                "order_id": "missing-order", "task_id": "missing-task",
                "approval_id": "missing", "card_id": "missing", "customer_id": "test",
                "category": "Groceries",
            }.get(param, "test")
            actual = actual.replace("{" + param + "}", str(value))
        token = merchant_token if path.startswith("/merchant/") else customer_token
        body = {} if method_u in {"POST", "PUT", "PATCH"} else None
        try:
            r = client.request(method_u, actual, headers={"Authorization": f"Bearer {token}"} if token else {}, json=body)
            expected_special = allowed_5xx.get((method_u, path))
            ok = r.status_code < 500 or (expected_special is not None and r.status_code == expected_special)
            record(f"route sweep {method_u} {path}", ok, f"HTTP {r.status_code}")
        except Exception as exc:
            record(f"route sweep {method_u} {path}", False, f"exception: {exc}")

print("\n=== BACKEND REGRESSION SUMMARY ===")
print(f"Checks: {len(results)}  Passed: {sum(1 for _, ok, _ in results if ok)}  Failed: {len(failures)}")
if failures:
    for name, detail in failures:
        print(f"FAILED: {name}: {detail}")
    sys.exit(1)
