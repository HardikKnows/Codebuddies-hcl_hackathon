"""CSV product/stock imports (preview -> apply) and CSV exports."""

import csv
import io

from app.services.csv_files import safe_cell
from app.services.exports import INVENTORY_COLUMNS
from tests.conftest import audit_rows, scalar
from tests.test_commerce import stock, store_id

ADMIN, PRIYA, ROHAN, AARAV = "admin@novamart.demo", "priya@novamart.demo", "rohan@novamart.demo", "aarav@novamart.demo"
COLUMNS = ["sku", "name", "brand", "category", "description", "price", "image_url", "specifications"]
HEADER = ",".join(COLUMNS) + "\n"
STOCK_HEADER = "sku,store_code,quantity,reorder_level\n"


def upload(client, headers, path, content, filename="products.csv", update_existing=False):
    data = content.encode("utf-8") if isinstance(content, str) else content
    return client.post(f"/api/ops/imports/{path}", headers=headers, files={"file": (filename, data, "text/csv")},
                       data={"updateExisting": "true" if update_existing else "false"})


def rows_of(response) -> list[dict]:
    return list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))


def test_product_preview_reports_row_errors_and_writes_nothing(client, auth):
    content = HEADER + "\n".join([
        "T901,Nimbus Tab 11,Nimbus,Mobiles,A new tablet,29999,https://example.com/t901.jpg,ram_gb=8;storage_gb=128",
        "T902,,Aerion,Laptops,,45000,,",                              # missing name
        "T903,Bad Price,Aerion,laptops,,abc,,",                       # not a number
        "T904,Negative,Aerion,laptops,,-5,,",                         # negative price
        "T901,Duplicate,Aerion,laptops,,100,,",                       # duplicate SKU in the file
        "T905,Unknown Category,Aerion,Toasters,,100,,",               # category doesn't exist
        "T906,Bad Image,Aerion,laptops,,100,javascript:alert(1),",    # unsafe image URL
        "T907,Bad Specs,Aerion,laptops,,100,,ram_gb",                 # malformed specifications
        "T908,Too Many,Aerion,laptops,,100,,,extra",                  # more values than columns
        "P101,Aerion Swift 14,Aerion,Laptops,,74990,,",               # existing product, no update option
    ])
    before = scalar("SELECT count(*) FROM products")
    response = upload(client, auth(ADMIN), "products/preview", content)
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["applied"], body["totalRows"], body["inserted"], body["skipped"], body["rejected"]) == (False, 10, 1, 1, 8)
    row = {r["row"]: r for r in body["rows"]}
    assert row[2]["action"] == "insert" and any("New brand 'Nimbus'" in n for n in row[2]["notes"])
    assert "Product name is required." in row[3]["errors"]
    assert any("Invalid price" in e for e in row[4]["errors"] + row[5]["errors"])
    assert any("Duplicate SKU" in e for e in row[6]["errors"])
    assert any("Unknown category" in e for e in row[7]["errors"])
    assert any("Image URL" in e for e in row[8]["errors"])
    assert any("key=value" in e for e in row[9]["errors"])
    assert any("header has 8 columns" in e for e in row[10]["errors"])
    assert row[11]["action"] == "skip"
    assert scalar("SELECT count(*) FROM products") == before


def test_unusable_files_are_rejected_whole_and_audited(client, auth):
    cases = [
        (HEADER.replace("specifications", "stock") + "T1,X,Y,laptops,,1,,5\n", "products.csv", "UNEXPECTED_COLUMNS"),
        ("sku,name,brand\nT1,X,Y\n", "products.csv", "MISSING_COLUMNS"),
        (HEADER, "products.csv", "NO_ROWS"),
        ("", "products.csv", "EMPTY_FILE"),
        (HEADER + 'T1,"unterminated,Y,laptops,,1,,\n', "products.csv", "MALFORMED_CSV"),
        (b"\xff\xfe\x00not-utf8", "products.csv", "INVALID_ENCODING"),
        (HEADER + "T1,X,Y,laptops,,1,,\n", "products.xlsx", "NOT_CSV"),
        (HEADER + "".join(f"T{i},Item {i},Y,laptops,,1,,\n" for i in range(501)), "products.csv", "TOO_MANY_ROWS"),
    ]
    for content, filename, code in cases:
        response = upload(client, auth(ADMIN), "products/preview", content, filename=filename)
        assert response.status_code == 400 and response.json()["error"]["code"] == code, (code, response.text)
    assert upload(client, auth(ADMIN), "products/preview", HEADER + "x" * 1_000_001).status_code == 413

    assert upload(client, auth(ADMIN), "products", cases[0][0]).status_code == 400  # applying is refused too...
    assert audit_rows("catalog.import", "FAILED")[-1]["details"]["code"] == "UNEXPECTED_COLUMNS"  # ...and audited


def test_import_inserts_new_products_without_inventing_stock(client, auth):
    content = HEADER + "\n".join([
        "T911,Nimbus Tab 11,Nimbus,Mobiles,Slim tablet,29999,https://example.com/t911.jpg,ram_gb=8;storage_gb=128",
        "T912,Nimbus Pen,Nimbus,Mobiles,,2499,,",
        "P101,Aerion Swift 14,Aerion,Laptops,,1,,",  # exists: skipped, price untouched
        "T913,Broken,Nimbus,Mobiles,,free,,",
    ])
    body = upload(client, auth(ADMIN), "products", content).json()
    assert (body["applied"], body["inserted"], body["updated"], body["skipped"], body["rejected"]) == (True, 2, 0, 1, 1)
    assert scalar("SELECT price FROM products WHERE sku = 'P101'") == 74990

    listed = client.get("/api/products", params={"q": "Nimbus Tab"}).json()["items"]
    assert [p["productId"] for p in listed] == ["T911"]
    assert listed[0]["imageUrl"] == "https://example.com/t911.jpg" and listed[0]["availability"] == "OUT_OF_STOCK"
    assert scalar("SELECT count(*) FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.sku IN ('T911', 'T912')") == 0

    entry = audit_rows("catalog.import", "SUCCESS")[-1]["details"]
    assert entry["insertedSkus"] == ["T911", "T912"] and entry["rejected"] == 1 and entry["skipped"] == 1


def test_updating_existing_products_needs_the_explicit_option(client, auth):
    content = HEADER + "P102,Aerion Swift 14 (Core i5),Aerion,Laptops,,52990,,\n"
    image = scalar("SELECT image_url FROM products WHERE sku = 'P102'")
    assert upload(client, auth(ADMIN), "products", content).json()["skipped"] == 1
    assert scalar("SELECT price FROM products WHERE sku = 'P102'") == 54990

    preview = upload(client, auth(ADMIN), "products/preview", content, update_existing=True).json()
    assert preview["rows"][0]["changes"] == {"price": [54990.0, 52990.0]}
    assert upload(client, auth(ADMIN), "products", content, update_existing=True).json()["updated"] == 1
    assert scalar("SELECT price FROM products WHERE sku = 'P102'") == 52990
    assert image and scalar("SELECT image_url FROM products WHERE sku = 'P102'") == image  # blank cell keeps the photo


def test_only_admins_can_import_products(client, auth):
    content = HEADER + "T921,Blocked,Nimbus,laptops,,10,,\n"
    for who in (PRIYA, ROHAN, AARAV):
        assert upload(client, auth(who), "products", content).status_code == 403
        assert upload(client, auth(who), "products/preview", content).status_code == 403
    assert client.post("/api/ops/imports/products", files={"file": ("p.csv", content.encode(), "text/csv")}).status_code == 401
    assert scalar("SELECT count(*) FROM products WHERE sku = 'T921'") == 0


def test_stock_import_is_store_scoped_validated_and_audited(client, auth):
    upload(client, auth(ADMIN), "products", HEADER + "T931,Nimbus Dock,Nimbus,Mobiles,,1999,,\n")
    own, other = stock("P101", "BLR-KOR"), stock("P101", "MUM-AND")
    content = STOCK_HEADER + "\n".join([
        f"P101,BLR-KOR,{own + 10},",   # update at own store
        "T931,blr-kor,12,4",            # new product stocked at own store
        "P101,MUM-AND,5,",              # another store: refused
        "P102,BLR-KOR,-3,",             # negative quantity
        "P999,BLR-KOR,3,",              # unknown SKU
        "P103,XXX-999,3,",              # unknown store
        f"P101,BLR-KOR,{own + 20},",    # duplicate product and store
    ])
    preview = upload(client, auth(PRIYA), "inventory/preview", content, filename="stock.csv").json()
    assert (preview["updated"], preview["inserted"], preview["rejected"]) == (1, 1, 5)
    assert any("own store" in e for e in preview["rows"][2]["errors"])
    assert stock("P101", "BLR-KOR") == own  # preview changes nothing

    result = upload(client, auth(PRIYA), "inventory", content, filename="stock.csv").json()
    assert result["applied"] and (result["updated"], result["inserted"], result["rejected"]) == (1, 1, 5)
    assert (stock("P101", "BLR-KOR"), stock("T931", "BLR-KOR"), stock("P101", "MUM-AND")) == (own + 10, 12, other)

    changes = audit_rows("inventory.import", "SUCCESS")[-1]["details"]["changes"]
    assert {"sku": "P101", "store": "BLR-KOR", "previousQuantity": own, "newQuantity": own + 10, "reorderLevel": None} in changes
    assert {"sku": "T931", "store": "BLR-KOR", "previousQuantity": None, "newQuantity": 12} in changes
    assert upload(client, auth(ROHAN), "inventory", content, filename="stock.csv").status_code == 403  # store staff


def test_formula_injection_is_neutralised():
    for dangerous in ("=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tx", "\rx"):
        assert safe_cell(dangerous) == "'" + dangerous
    assert safe_cell("Aerion Swift 14") == "Aerion Swift 14" and safe_cell(42) == 42


def test_catalog_export_is_safe_and_round_trips(client, auth):
    payload = '=HYPERLINK("http://evil.example","click")'
    buffer = io.StringIO()
    csv.writer(buffer).writerows([COLUMNS, ["T941", payload, "Nimbus", "Mobiles", "+SUM(A1:A9)", "999", "", "note=@cmd"]])
    assert upload(client, auth(ADMIN), "products", buffer.getvalue()).json()["inserted"] == 1

    response = client.get("/api/ops/exports/catalog.csv", headers=auth(ROHAN))
    assert response.status_code == 200 and response.headers["content-type"].startswith("text/csv")
    assert 'attachment; filename="retailpulse-catalog-' in response.headers["content-disposition"]
    assert response.content.startswith(b"\xef\xbb\xbf")  # UTF-8 BOM for Excel
    rows = rows_of(response)
    assert list(rows[0]) == COLUMNS
    by_sku = {r["sku"]: r for r in rows}
    assert by_sku["T941"]["name"] == "'" + payload and by_sku["T941"]["description"] == "'+SUM(A1:A9)"
    assert by_sku["P101"]["price"] == "74990.00" and by_sku["P101"]["image_url"].startswith("https://images.unsplash.com/")
    assert audit_rows("export.catalog", "SUCCESS")

    # An untouched export is a valid import file that changes nothing.
    again = upload(client, auth(ADMIN), "products/preview", response.content, filename="catalog.csv", update_existing=True).json()
    assert (again["rejected"], again["inserted"], again["updated"]) == (0, 0, 0), [r for r in again["rows"] if r["action"] != "skip"][:3]


def test_inventory_export_respects_store_scope_and_filters(client, auth):
    own = rows_of(client.get("/api/ops/exports/inventory.csv", headers=auth(PRIYA)))
    assert own and {r["store_code"] for r in own} == {"BLR-KOR"} and list(own[0]) == INVENTORY_COLUMNS
    assert own[0]["image_url"].startswith("https://") and own[0]["price"].endswith(".00")

    denied = client.get("/api/ops/exports/inventory.csv", params={"storeId": store_id("MUM-AND")}, headers=auth(PRIYA))
    assert denied.status_code == 403
    assert audit_rows("export.inventory", "DENIED")[-1]["details"]["requestedStoreId"] == store_id("MUM-AND")

    assert {r["store_code"] for r in rows_of(client.get("/api/ops/exports/inventory.csv", headers=auth(ROHAN)))} == {"MUM-AND"}
    everything = rows_of(client.get("/api/ops/exports/inventory.csv", headers=auth(ADMIN)))
    assert {"BLR-KOR", "MUM-AND", "IN-WH1"} <= {r["store_code"] for r in everything}

    low = client.get("/api/ops/exports/inventory.csv", headers=auth(ADMIN),
                     params={"storeId": store_id("MUM-AND"), "status": "LOW_STOCK"})
    assert "retailpulse-inventory-MUM-AND-low-stock-" in low.headers["content-disposition"]
    low_rows = rows_of(low)
    assert low_rows and all(r["status"] == "LOW_STOCK" and r["store_code"] == "MUM-AND" for r in low_rows)
    assert client.get("/api/ops/exports/inventory.csv", headers=auth(AARAV)).status_code == 403
