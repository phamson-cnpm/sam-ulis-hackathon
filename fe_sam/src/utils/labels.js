
export const ROLE_LABEL = {
  canbo: 'Cán bộ, giảng viên',
  ktv: 'Kỹ thuật viên Phòng QTNL',
  lanhdao_qtnl: 'Lãnh đạo Phòng QTNL',
  khtc: 'Phòng KHTC (quản trị)',
  daumoi: 'Cán bộ đầu mối đơn vị',
};

// Vai trò trên tài khoản cá nhân (Phòng KHTC thiết lập ở dữ liệu cán bộ). Mọi tài khoản có quyền của cán bộ, giảng
// viên; "lãnh đạo đơn vị" không phải vai trò của phần mềm (chức vụ chỉ lưu để in trên biểu mẫu).
// Cán bộ đầu mối được thiết lập ở mục Mã cán bộ đầu mối (mỗi đơn vị một người).
export const STAFF_GROUP = {
  canbo: 'Cán bộ, giảng viên',
  daumoi: 'Cán bộ đầu mối',
  ktv: 'Kỹ thuật viên Phòng QTNL',
  lanhdao_qtnl: 'Lãnh đạo Phòng QTNL',
  khtc: 'Quản trị (Phòng KHTC)',
};
export const SETTABLE_GROUPS = ['canbo', 'ktv', 'lanhdao_qtnl', 'khtc'];

// Đề xuất xử lý tài sản (cột Đề xuất, mục 5.6 đề tài)
export const PROPOSAL_KIND = { thanh_ly: 'Thanh lý', dieu_chuyen: 'Điều chuyển', thay_the: 'Thay thế' };
export const PROPOSAL_KIND_HINT = {
  thanh_ly: 'Vào danh sách đề xuất thanh lý của Phòng KHTC',
  dieu_chuyen: 'Sang đơn vị khác hoặc về kho; Phòng KHTC lập điều chuyển chính thức',
  thay_the: 'Đưa vào kế hoạch mua sắm năm sau',
};
export const PROPOSAL_STATUS = {
  cho_lanh_dao: 'Chờ lãnh đạo duyệt',
  cho_ky_thuat: 'Chờ kỹ thuật xem xét',
  da_duyet: 'Đã duyệt',
  khong_duyet: 'Không duyệt',
  khtc_tiep_nhan: 'KHTC đã tiếp nhận',
};
export const PROPOSAL_TONE = {
  cho_lanh_dao: 'amber',
  cho_ky_thuat: 'blue',
  da_duyet: 'green',
  khong_duyet: 'red',
  khtc_tiep_nhan: 'accent',
};
export const PROPOSAL_OPEN = ['cho_lanh_dao', 'cho_ky_thuat', 'da_duyet'];
export const TECH_OPINION = { dong_y: 'Đồng ý', khong_dong_y: 'Không đồng ý', de_xuat_khac: 'Đề xuất khác' };
export const PROPOSAL_REASONS = ['Theo màu đèn', 'Hư hỏng không sửa được', 'Không còn nhu cầu sử dụng', 'Lạc hậu'];
export const REJECT_REASONS = [
  'Tài sản còn sử dụng tốt',
  'Nên sửa chữa thay vì thanh lý',
  'Chưa đủ căn cứ, bổ sung hồ sơ',
  'Đã có đề xuất khác',
];

export const REPORT_STATUS = {
  da_gui: 'Đã gửi',
  dang_xu_ly: 'Đang xử lý',
  hoan_thanh: 'Hoàn thành',
};

export const ESTIMATE_STATUS = {
  cho_lanh_dao: 'Chờ lãnh đạo phòng',
  can_kiem_tra_lai: 'Cần kiểm tra lại',
  da_xac_nhan: 'Đã xác nhận, chờ in và ký',
  da_ky_du: 'Đã ký đủ',
  khong_dong_y: 'Không đồng ý',
};

export const EXCEPTION_STATUS = {
  cho_mo_khoa: 'Chờ mở khóa',
  da_mo_khoa: 'Đã mở khóa',
  khong_dong_y: 'Không đồng ý',
};

export const PROPOSAL = {
  tai_cho: 'Xử lý tại chỗ',
  sua_chua: 'Sửa chữa, thay thế linh kiện',
  hong_toan_phan: 'Hư hỏng toàn phần, không sửa được',
};

export const TARGET = {
  tai_san: 'Chính tài sản (linh kiện của tài sản)',
  phu_kien: 'Vật tư, phụ kiện đi kèm (không thuộc tài sản)',
};

export const TOTAL_LOSS = {
  cho_xac_minh: 'Chờ xác minh',
  da_xac_nhan: 'Đã xác nhận',
  tra_lai: 'Bị trả lại',
};

export const COST_GROUP = {
  tinh: 'Sửa chữa, thay linh kiện',
  khong_tinh: 'Bảo dưỡng, vật tư, phụ kiện',
};

export const TEMP_SOURCE = {
  kho_qtnl: 'Kho QTNL',
  don_vi_khac: 'Điều chuyển từ đơn vị khác',
  doi_phong: 'Đổi phòng học',
};

export const FOCAL_ACTION = {
  dang_nhap: 'Nhập mã (bản cũ)',
  xem: 'Xem danh sách',
  xuat_excel: 'Tải Excel (.xlsx)',
  tai_pdf: 'Tải PDF',
  in: 'In',
  tai_word: 'Tải Word',
};

export const FOCAL_STATUS = {
  dang_dung: 'Đang dùng',
  da_thu_hoi: 'Đã thu hồi mã',
  chua_cap: 'Chưa cấp mã',
};

export const ASSET_STATUS = {
  dang_su_dung: 'Đang sử dụng',
  thu_hoi_kho: 'Hỏng, đã thu hồi về kho, chờ phương án xử lý',
  da_thanh_ly: 'Đã thanh lý',
};

export const RECALL_STATUS = {
  cho_khtc: 'Chờ Phòng KHTC xác nhận',
  da_xac_nhan: 'Đã xác nhận, chờ biên bản giao nhận',
  da_giao_nhan: 'Đã giao nhận, chờ nhập điều chuyển',
  hoan_thanh: 'Đã thu hồi tài sản hỏng về kho',
  khong_dong_y: 'Không đồng ý',
};

export const RECALL_BASIS = {
  hong_toan_phan: 'Hư hỏng toàn phần, không sửa chữa được',
  khong_duyet: 'Không được duyệt chi phí sửa chữa',
};

export const RECALL_PLAN = {
  cho_thanh_ly: 'Chờ thanh lý',
  tan_dung: 'Tận dụng linh kiện',
  sua_sau: 'Sửa tiếp khi có kinh phí',
};

export const HANDOVER_KIND = {
  cap_phat: 'Cấp phát',
  dieu_chuyen: 'Điều chuyển chính thức',
  thu_hoi: 'Thu hồi tài sản hỏng về kho',
};

// Quyết định của Phòng KHTC với tài sản chờ thanh lý (mục 5.3 đề tài)
export const DISPOSAL_DECISION = {
  thanh_ly: 'Đã thanh lý',
  loai_khoi_danh_sach: 'Loại khỏi danh sách chờ thanh lý',
};
