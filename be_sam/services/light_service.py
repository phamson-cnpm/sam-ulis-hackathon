
"""Tính màu đèn cảnh báo vòng đời cho một tài sản (SAM Alert Matrix, mục 5.3 đề tài).

Chuyển nguyên logic từ fe_sam/src/utils/lights.js; tests/test_lights_parity.py so khớp kết quả với bản JavaScript.
Hàm thuần, làm việc trên dict dạng camelCase (cùng dạng dữ liệu trả cho giao diện).

Tài sản chờ thanh lý (Đỏ 1.1, Đỏ 1.2) giữ đèn đỏ khi sang năm tài chính mới cho đến khi Phòng KHTC quyết định thanh lý
(trạng thái "Đã thanh lý") hoặc loại khỏi danh sách (ngày disposalClearedAt): đèn năm nay giữ đỏ nếu đèn tính đến hết ngày
31/12 năm trước là đỏ.
"""
from datetime import date
from typing import Iterable, Optional

# Phiếu "Không đồng ý" không tính vào số lần sửa và chi phí.
COUNTED_STATUSES = ("cho_lanh_dao", "can_kiem_tra_lai", "da_xac_nhan", "da_ky_du")
RED = ("do_1_1", "do_1_2")
# Thứ tự ưu tiên đèn (số nhỏ là nặng hơn), dùng khi giữ màu đèn của tài sản đã thu hồi về kho
RANK = {"do_1_1": 0, "do_1_2": 1, "cam": 2, "vang_3_1": 3, "vang_3_2": 4, "vang_3_3": 5, "xanh_la": 6, "xanh_duong": 7}
LOCKING = ("do_1_1", "cam")
LIGHT_ORDER = ("do_1_1", "do_1_2", "cam", "vang_3_1", "vang_3_2", "vang_3_3", "xanh_la", "xanh_duong")


def months_between(frm: str, to: str) -> int:
    a = date.fromisoformat(frm[:10])
    b = date.fromisoformat(to[:10])
    m = (b.year - a.year) * 12 + (b.month - a.month)
    if b.day < a.day:
        m -= 1
    return max(m, 0)


def counted_cost(lines: Iterable[dict]) -> dict:
    """Chi phí một phiếu được tính vào đèn: chỉ dòng nhóm "sửa chữa, thay linh kiện"."""
    cost = 0
    provisional = False
    has_repair = False
    for l in lines:
        if l.get("costGroup") != "tinh":
            continue
        has_repair = True
        if l.get("actual") is None:
            provisional = True
            cost += l.get("estimate") or 0
        else:
            cost += l["actual"]
    return {"cost": cost, "provisional": provisional, "hasRepair": has_repair}


def _has_history(asset: dict, estimates: Iterable[dict], end: str, exclude_estimate_id: Optional[str]) -> bool:
    """Tài sản có dữ liệu làm đèn đỏ trước ngày end (phiếu dự toán được tính, hư hỏng toàn phần, thu hồi về kho)."""
    for e in estimates:
        if (
            e["assetId"] == asset["id"]
            and e["id"] != exclude_estimate_id
            and e["status"] in COUNTED_STATUSES
            and e["createdAt"][:10] <= end
        ):
            return True
    for k in ("totalLossConfirmedAt", "recalledAt"):
        if asset.get(k) and asset[k][:10] <= end:
            return True
    return False


def compute_light(
    asset: dict,
    estimates: Iterable[dict],
    th: dict,
    as_of: str,
    exclude_estimate_id: Optional[str] = None,
    draft_lines: Optional[list] = None,
    pending_total_loss: bool = False,
) -> dict:
    as_of = as_of[:10]
    year = as_of[:4]
    fully = (asset.get("residualValue") or 0) <= 0

    year_count = 0
    year_cost = 0
    cumulative_cost = 0
    provisional = False

    items = []
    for e in estimates:
        if (
            e["assetId"] == asset["id"]
            and e["id"] != exclude_estimate_id
            and e["status"] in COUNTED_STATUSES
            and e["createdAt"][:10] <= as_of
        ):
            items.append({"date": e["createdAt"][:10], **counted_cost(e["lines"])})
    if draft_lines:
        items.append({"date": as_of, **counted_cost(draft_lines)})
    for it in items:
        if not it["hasRepair"]:
            continue
        cumulative_cost += it["cost"]
        if it["date"][:4] == year:
            year_count += 1
            year_cost += it["cost"]
            if it["provisional"]:
                provisional = True

    base = asset["originalCost"] if (asset.get("originalCost") or 0) > 0 else 0
    year_ratio = year_cost / base if base else 0
    cumulative_ratio = cumulative_cost / base if base else 0
    # Tài sản đã thu hồi về kho chờ phương án xử lý: không tính Vàng 3.1 (nằm kho), giữ màu đèn lúc thu hồi.
    recalled_at = (asset.get("recalledAt") or "")[:10]
    recalled = asset.get("status") == "thu_hoi_kho" and (not recalled_at or recalled_at <= as_of)
    in_warehouse = not recalled and (asset.get("location") or "").upper().startswith("KHO")
    last = asset.get("lastInteractionDate")
    wh_months = months_between(last, as_of) if in_warehouse and last else None
    cleared = (asset.get("disposalClearedAt") or "")[:10]

    def cleared_since(d: str) -> bool:
        """Phòng KHTC đã loại tài sản khỏi danh sách chờ thanh lý sau ngày d (ngày bắt đầu giữ đèn đỏ)."""
        return bool(cleared) and d <= cleared <= as_of

    tl = (asset.get("totalLossConfirmedAt") or "")[:10]
    total_loss = bool(tl) and tl <= as_of and not cleared_since(tl)

    def result(code: str, labels: list) -> dict:
        return {
            "code": code,
            "labels": labels,
            "locked": code in LOCKING,
            "provisional": provisional,
            "fullyDepreciated": fully,
            "yearCount": year_count,
            "yearCost": year_cost,
            "yearRatio": year_ratio,
            "cumulativeCost": cumulative_cost,
            "cumulativeRatio": cumulative_ratio,
            "warehouseMonths": wh_months,
            "pendingTotalLoss": bool(pending_total_loss),
            "keptFrom": kept_from,
        }

    kept_red = None
    kept_from = None
    if asset.get("status") == "da_thanh_ly":
        return result("da_thanh_ly", ["Đã thanh lý"])

    # Đèn đỏ năm trước giữ sang năm nay, trừ khi Phòng KHTC đã loại khỏi danh sách chờ thanh lý trong năm nay
    prev_end = f"{int(year) - 1}-12-31"
    if not cleared_since(f"{year}-01-01") and _has_history(asset, estimates, prev_end, exclude_estimate_id):
        prev = compute_light(asset, estimates, th, prev_end, exclude_estimate_id=exclude_estimate_id)
        if prev["code"] in RED:
            kept_red = prev["code"]
            kept_from = prev["keptFrom"] or int(year) - 1

    is_warehouse_idle = wh_months is not None and wh_months >= th["warehouseMonths"]
    is_long_repair = cumulative_ratio >= th["cumulativePct"] / 100

    if total_loss:
        code = "do_1_1" if fully else "do_1_2"
        labels = ["Hư hỏng toàn phần", "Chờ thanh lý"]
    elif kept_red:
        code = kept_red
        labels = ["Chờ thanh lý", f"Giữ từ năm {kept_from}"]
    elif fully and year_count > 0 and year_ratio >= th["redPct"] / 100:
        code = "do_1_1"
        labels = ["Khóa phiếu dự toán", "Chờ thanh lý"]
    elif not fully and (year_count >= th["orangeCount"] or year_ratio > th["orangePct"] / 100):
        code = "cam"
        labels = ["Tạm dừng sửa chữa", "Kiểm tra kỹ thuật"]
    elif is_warehouse_idle:
        code = "vang_3_1"
        labels = [f"Tồn kho {wh_months} tháng"]
    elif fully and year_count > 0:
        code = "vang_3_2"
        labels = ["Theo dõi sát"]
    elif is_long_repair:
        code = "vang_3_3"
        labels = ["Sửa chữa kéo dài"]
    elif fully:
        code = "xanh_la"
        labels = ["Tài sản vượt vòng đời"]
    else:
        code = "xanh_duong"
        labels = ["Vận hành bình thường"]

    if recalled:
        kept = asset.get("recallLight")
        if kept in RED and cleared_since(recalled_at):
            kept = None
        if kept and kept in RANK and RANK[kept] < RANK[code]:
            code = kept
            labels = ["Chờ thanh lý"] if kept in RED else []
        labels = ["Hỏng, đã thu hồi về kho, chờ phương án xử lý", *labels]

    # Nhãn phụ
    if year_count >= th["repeatCount"] and code not in RED and code != "cam":
        labels.append("Sửa chữa lặp lại")
    if is_long_repair and code != "vang_3_3":
        labels.append("Sửa chữa kéo dài")
    if is_warehouse_idle and code != "vang_3_1":
        labels.append(f"Tồn kho {wh_months} tháng")
    if pending_total_loss:
        labels.append("Chờ xác minh")
    if provisional:
        labels.append("Tạm tính")

    return result(code, labels)
