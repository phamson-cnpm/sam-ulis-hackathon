
"""Hàm tính đèn bản Python phải cho kết quả giống hệt bản JavaScript fe_sam/src/utils/lights.js.
Bộ ca (tests/fixtures/light_cases.json) sinh bằng chính lights.js: 98 tài sản × nhiều ngưỡng, ngày tính, dự toán đang soạn,
loại trừ phiếu, thu hồi giữ màu, đã thanh lý, hư hỏng toàn phần, nằm kho, đèn đỏ năm trước giữ sang năm sau (nhiều năm)
và Phòng KHTC loại khỏi danh sách chờ thanh lý."""
import json
import os

from services.light_service import compute_light

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "light_cases.json")


def test_khop_hoan_toan_voi_ban_javascript():
    data = json.load(open(FIXTURE, encoding="utf-8"))
    mismatches = []
    for i, c in enumerate(data["cases"]):
        got = compute_light(
            c["asset"],
            c["estimates"],
            c["th"],
            c["asOf"],
            exclude_estimate_id=c["excludeEstimateId"],
            draft_lines=c["draftLines"],
            pending_total_loss=c["pendingTotalLoss"],
        )
        if got != c["expected"]:
            mismatches.append((i, c["asset"]["code"], got, c["expected"]))
    assert data["count"] > 4000
    assert not mismatches, f"{len(mismatches)} ca lệch, ví dụ: {mismatches[:2]}"


def test_du_cac_mau_den():
    data = json.load(open(FIXTURE, encoding="utf-8"))
    codes = {c["expected"]["code"] for c in data["cases"]}
    assert {"do_1_1", "do_1_2", "cam", "vang_3_1", "vang_3_2", "vang_3_3", "xanh_la", "xanh_duong", "da_thanh_ly"} <= codes


def test_giu_do_tu_nam_truoc():
    data = json.load(open(FIXTURE, encoding="utf-8"))
    kept = [c for c in data["cases"] if c["expected"]["keptFrom"]]
    assert len(kept) > 100 and {c["expected"]["keptFrom"] for c in kept} >= {2024, 2025}
