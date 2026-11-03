
"""Chuyển bản ghi sang đúng dạng dữ liệu fe_sam đang dùng (tên trường camelCase, ngày giờ '2026-10-24T09:30')."""
from core.clock import day, stamp
from core.security import decrypt_code


def file_name(f):
    return f.original_name if f else None


def asset(a) -> dict:
    return {
        "id": a.id,
        "code": a.code,
        "name": a.name,
        "groupCode": a.group_code,
        "inUseDate": day(a.in_use_date),
        "location": a.location or "",
        "unit": a.unit,
        "originalCost": a.original_cost or 0,
        "depreciationMonths": a.depreciation_months,
        "accumulatedDepreciation": a.accumulated_depreciation or 0,
        "residualValue": a.residual_value or 0,
        "fundingSource": a.funding_source or "",
        "status": a.status,
        "lastInteractionDate": day(a.last_interaction_date),
        "totalLossConfirmedAt": day(a.total_loss_confirmed_at),
        "disposedAt": day(a.disposed_at),
        "disposalClearedAt": day(a.disposal_cleared_at),
        "recallLight": a.recall_light,
        "recalledAt": day(a.recalled_at),
    }


def report(r) -> dict:
    return {
        "id": r.id,
        "code": r.code,
        "batchCode": r.batch_code,
        "reporterId": r.reporter_id,
        "reporterName": r.reporter_name,
        "reporterUnit": r.reporter_unit,
        "accountId": r.account_id,
        "phone": r.phone,
        "createdAt": stamp(r.created_at),
        "source": r.source,
        "assetId": r.asset_id,
        "assetName": r.asset_name,
        "location": r.location,
        "content": r.content,
        "situation": r.situation,
        "urgent": bool(r.urgent),
        "status": r.status,
        "technicianId": r.technician_id,
        "hasTempEquipment": bool(r.has_temp_equipment),
        "completedAt": stamp(r.completed_at),
        "mergedIntoId": r.merged_into_id,
        "mergedBy": r.merged_by,
        "mergedAt": stamp(r.merged_at),
    }


def inspection(i) -> dict:
    return {
        "id": i.id,
        "code": i.code,
        "reportId": i.report_id,
        "assetId": i.asset_id,
        "inspectedAt": stamp(i.inspected_at),
        "technicianId": i.technician_id,
        "findings": i.findings,
        "target": i.target,
        "proposal": i.proposal,
        "proposalNote": i.proposal_note or "",
        "tempSolution": i.temp_solution or "",
        "note": i.note or "",
        "totalLossStatus": i.total_loss_status,
        "totalLossBy": i.total_loss_by,
        "totalLossAt": stamp(i.total_loss_at),
        "totalLossReturnReason": i.total_loss_return_reason,
        "scanFile": file_name(i.scan_file),
        "scanFileId": i.scan_file_id,
    }


def temp_transfer(t) -> dict:
    return {
        "id": t.id,
        "code": t.code,
        "reportId": t.report_id,
        "originalAssetId": t.original_asset_id,
        "replacementAssetId": t.replacement_asset_id,
        "source": t.source,
        "useLocation": t.use_location,
        "expectedReturn": t.expected_return,
        "receiverName": t.receiver_name,
        "receiverUnit": t.receiver_unit,
        "createdBy": t.created_by,
        "issuedAt": stamp(t.issued_at),
        "returnedAt": stamp(t.returned_at),
    }


def no_spare(n) -> dict:
    return {
        "id": n.id,
        "reportId": n.report_id,
        "assetId": n.asset_id,
        "groupCode": n.group_code,
        "need": n.need,
        "reason": n.reason,
        "situation": n.situation,
        "recordedBy": n.recorded_by,
        "recordedAt": stamp(n.recorded_at),
    }


def estimate_line(l) -> dict:
    return {
        "id": l.id,
        "jobId": l.job_id,
        "content": l.content,
        "costGroup": l.cost_group,
        "estimate": l.estimate,
        "actual": l.actual,
    }


def estimate(e) -> dict:
    return {
        "id": e.id,
        "code": e.code,
        "createdAt": day(e.created_at),
        "assetId": e.asset_id,
        "inspectionId": e.inspection_id,
        "reportId": e.report_id,
        "createdBy": e.created_by,
        "lines": [estimate_line(l) for l in e.lines],
        "status": e.status,
        "locked": bool(e.locked),
        "lightBefore": e.light_before,
        "lightAfter": e.light_after,
        "confirmedBy": e.confirmed_by,
        "confirmedAt": stamp(e.confirmed_at),
        "returnReason": e.return_reason,
        "signedScan": file_name(e.signed_scan),
        "signedScanId": e.signed_scan_id,
        "voucherNo": e.voucher_no,
        "voucherDate": day(e.voucher_date),
        "voucherTotal": e.voucher_total,
        "actualEnteredAt": stamp(e.actual_entered_at),
        "history": [
            {"at": stamp(h.at), "by": h.by, "action": h.action, **({"note": h.note} if h.note else {})} for h in e.history
        ],
    }


def exception(x) -> dict:
    return {
        "id": x.id,
        "code": x.code,
        "estimateId": x.estimate_id,
        "assetId": x.asset_id,
        "reason": x.reason,
        "extraTime": x.extra_time,
        "tempEquipment": x.temp_equipment,
        "status": x.status,
        "createdBy": x.created_by,
        "createdAt": stamp(x.created_at),
        "docNo": x.doc_no,
        "docDate": day(x.doc_date),
        "conclusion": x.conclusion,
        "decidedBy": x.decided_by,
        "decidedAt": stamp(x.decided_at),
        "scanFile": file_name(x.scan_file),
        "scanFileId": x.scan_file_id,
    }


def recall(r) -> dict:
    return {
        "id": r.id,
        "code": r.code,
        "assetId": r.asset_id,
        "reportId": r.report_id,
        "basis": r.basis,
        "basisNote": r.basis_note,
        "plan": r.plan,
        "note": r.note or "",
        "toLocation": r.to_location,
        "status": r.status,
        "proposedBy": r.proposed_by,
        "proposedAt": stamp(r.proposed_at),
        "decidedBy": r.decided_by,
        "decidedAt": stamp(r.decided_at),
        "rejectReason": r.reject_reason,
        "handoverId": r.handover_id,
        "transferNo": r.transfer_no,
        "transferDate": day(r.transfer_date),
        "completedBy": r.completed_by,
        "completedAt": stamp(r.completed_at),
    }


def handover(h) -> dict:
    return {
        "id": h.id,
        "code": h.code,
        "kind": h.kind,
        "date": day(h.date),
        "createdBy": h.created_by,
        "createdAt": stamp(h.created_at),
        "giverUnit": h.giver_unit,
        "givers": [{"name": p.name, "unit": p.unit} for p in h.people if p.side == "giver"],
        "receiverUnit": h.receiver_unit,
        "receivers": [{"name": p.name, "unit": p.unit} for p in h.people if p.side == "receiver"],
        "place": h.place,
        "items": [{"assetId": it.asset_id, "uom": it.uom, "qty": it.qty, "note": it.note or ""} for it in h.items],
        "scanFile": file_name(h.scan_file),
        "scanFileId": h.scan_file_id,
        "recallId": h.recall_id,
        "applied": bool(h.applied),
        "appliedAt": stamp(h.applied_at),
        "appliedBy": h.applied_by,
        "transferNo": h.transfer_no or "",
    }


def staff(s, with_code: bool = False) -> dict:
    out = {
        "id": s.id,
        "staffCode": s.staff_code or "",
        "name": s.name,
        "unit": s.unit,
        "position": s.position or "",
        "role": s.group if s.group in ("ktv", "lanhdao_qtnl", "khtc", "daumoi") else "canbo",
        "phone": s.phone or "",
        "email": s.email or "",
        "group": s.group,
    }
    if with_code:
        # Thông tin tài khoản cá nhân, mã xác nhận: chỉ trả cho Phòng KHTC
        out["code"] = decrypt_code(s.code_enc) if s.code_enc else None
        out["createdBy"] = s.created_by
        out["createdAt"] = stamp(s.created_at)
        out["username"] = s.username
        out["hasAccount"] = bool(s.password_hash)
        out["active"] = bool(s.active)
        out["mustChangePassword"] = bool(s.must_change_password)
        out["lastLoginAt"] = stamp(s.last_login_at)
    return out


def focal(f) -> dict:
    return {
        "id": f.id,
        "unit": f.unit,
        "abbr": f.abbr,
        "name": f.name,
        "position": f.position or "",
        "phone": f.phone or "",
        "code": decrypt_code(f.code_enc),
        "issuedAt": stamp(f.issued_at),
        "issuedBy": f.issued_by,
        "status": f.status,
        "revokedAt": stamp(f.revoked_at),
        "revokedBy": f.revoked_by,
        "revokeReason": f.revoke_reason,
        "staffId": f.staff_id,
    }


def focal_log(l, code=None) -> dict:
    return {
        "id": l.id,
        "at": stamp(l.at),
        "focalId": l.focal_id,
        "code": code,
        "unit": l.unit,
        "name": l.name,
        "action": l.action,
        "detail": l.detail or "",
    }


def notification(n) -> dict:
    return {"id": n.id, "userId": n.user_id, "at": stamp(n.at), "text": n.text, "read": bool(n.read), "link": n.link}


def export_log(l) -> dict:
    return {
        "id": l.id,
        "at": stamp(l.at),
        "userId": l.user_id,
        "name": l.name,
        "role": l.role,
        "unit": l.unit,
        "action": l.action,
        "detail": l.detail or "",
    }


def thresholds(t) -> dict:
    return {
        "redPct": t.red_pct,
        "orangePct": t.orange_pct,
        "orangeCount": t.orange_count,
        "repeatCount": t.repeat_count,
        "warehouseMonths": t.warehouse_months,
        "cumulativePct": t.cumulative_pct,
    }


THRESHOLD_FIELDS = {
    "redPct": "red_pct",
    "orangePct": "orange_pct",
    "orangeCount": "orange_count",
    "repeatCount": "repeat_count",
    "warehouseMonths": "warehouse_months",
    "cumulativePct": "cumulative_pct",
}


def threshold_log(l) -> dict:
    return {"id": l.id, "at": stamp(l.at), "by": l.by, "field": l.field, "oldValue": l.old_value, "newValue": l.new_value}


def repair_job(j) -> dict:
    return {
        "id": j.id,
        "code": j.code,
        "name": j.name,
        "groupCodes": sorted(g.group_code for g in j.groups),
        "costGroup": j.cost_group,
        "active": bool(j.active),
    }


def disposal_decision(d) -> dict:
    return {
        "id": d.id,
        "assetId": d.asset_id,
        "decision": d.decision,
        "basis": d.basis,
        "note": d.note,
        "lightBefore": d.light_before,
        "by": d.by,
        "at": stamp(d.at),
    }
