// Đề xuất xử lý tài sản (mục 5.6 đề tài): Phòng KHTC tiếp nhận đề xuất đã duyệt; kỹ thuật viên ghi ý kiến kỹ thuật khi
// được lãnh đạo giao; cán bộ đầu mối theo dõi đề xuất của đơn vị mình và tải bản Excel để lưu hồ sơ đơn vị.
// Lãnh đạo Phòng QTNL quyết định ở trang Chờ xác nhận (tab Đề xuất xử lý tài sản).
import React from 'react';
import { Download } from 'lucide-react';
import { exportLogApi, refs } from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { downloadXlsx } from '../utils/xlsx';
import { proposalsSheets } from '../utils/exportSheets';
import { TODAY } from '../config/app';
import { Button, Notice, PageHeader } from '../components/ui';
import { ProposalsBoard } from '../components/Proposals';

const DESC = {
  khtc: 'Đề xuất thanh lý, điều chuyển, thay thế đã được lãnh đạo Phòng QTNL duyệt chuyển đến. Tiếp nhận để tổng hợp trình Ban Giám hiệu; Ban Giám hiệu không đồng ý thì ghi Không duyệt kèm lý do.',
  ktv: 'Đề xuất lãnh đạo giao kiểm tra thực tế: ghi ý kiến kỹ thuật rồi trả về lãnh đạo quyết định. Lập đề xuất mới ở cột Đề xuất của danh sách Tài sản.',
  daumoi: 'Đề xuất xử lý tài sản của đơn vị và kết quả duyệt (kể cả lý do nếu không duyệt). Gửi danh sách đề xuất ở trang Tài sản toàn trường.',
};

const ProposalsPage = ({ params = {} }) => {
  const { user } = useAuth();
  const toast = useToast();

  const exportList = (rows) => (
    <Button
      size="sm"
      icon={<Download size={14} />}
      onClick={async () => {
        try {
          await downloadXlsx(`SAM_de-xuat-xu-ly-tai-san_${TODAY}`, proposalsSheets(rows, { nameOf: (id) => refs.userById(id)?.name || '' }));
          exportLogApi.log(user, 'xuat_excel', `Danh sách đề xuất xử lý tài sản (${rows.length} đề xuất)`);
        } catch (e) {
          toast('error', `Không tạo được file Excel: ${e.message}`);
        }
      }}
    >
      Tải Excel danh sách đang xem
    </Button>
  );

  return (
    <div>
      <PageHeader title={user.role === 'daumoi' ? 'Đề xuất của đơn vị' : 'Đề xuất xử lý tài sản'} description={DESC[user.role]} />
      <ProposalsBoard initialTab={params.section} openId={params.proposalId} onExport={exportList} />
      <Notice className="mt-4" title="Đề xuất không làm đổi màu đèn">
        Mỗi tài sản chỉ có một đề xuất đang xử lý. Không duyệt thì lý do hiện ngay ở cột Đề xuất; có căn cứ mới thì lập đề
        xuất khác. Quyết định thanh lý vẫn theo quy định hiện hành.
      </Notice>
    </div>
  );
};

export default ProposalsPage;
