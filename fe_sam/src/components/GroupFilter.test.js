
// Bộ lọc nhóm thiết bị trên danh sách tài sản: tìm nhóm (gõ không dấu), chọn nhiều nhóm, bỏ từng nhóm.
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { fold, groupMatches, GroupChips, GroupFilter } from './GroupFilter';

const groups = [
  { code: '0401', name: 'Máy tính bàn, máy chủ' },
  { code: '0404', name: 'Máy chiếu' },
  { code: '0414', name: 'Tủ lạnh, tủ làm mát' },
  { code: '0416', name: 'Điều hòa' },
];
const totals = { '0401': 9, '0404': 12, '0416': 10 }; // 0414 chưa có tài sản
const counts = { '0401': 9, '0404': 3, '0416': 0 };

const Harness = ({ onChange = () => {} }) => {
  const [value, setValue] = useState([]);
  const set = (v) => {
    setValue(v);
    onChange(v);
  };
  return (
    <>
      <GroupFilter groups={groups} totals={totals} counts={counts} value={value} onChange={set} />
      <GroupChips groups={groups} value={value} onChange={set} />
    </>
  );
};

describe('Bộ lọc nhóm thiết bị', () => {
  it('tìm theo mã hoặc tên, gõ không dấu cũng ra', () => {
    expect(fold('Điều hòa')).toBe('dieu hoa');
    expect(groupMatches(groups[3], 'dieu hoa')).toBe(true);
    expect(groupMatches(groups[1], '0404')).toBe(true);
    expect(groupMatches(groups[1], 'điều')).toBe(false);
  });

  it('chỉ liệt kê nhóm đang có tài sản, kèm số tài sản khớp các điều kiện lọc khác', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả nhóm thiết bị' }));
    expect(screen.queryByText('Tủ lạnh, tủ làm mát')).toBeNull();
    expect(screen.getByText('1 nhóm chưa có tài sản nào trong danh sách nên không hiện.')).toBeTruthy();
    expect(screen.getByText('Máy chiếu').closest('label').textContent).toContain('3');
  });

  it('chọn nhiều nhóm, bỏ từng nhóm bằng nhãn', () => {
    const changes = [];
    render(<Harness onChange={(v) => changes.push(v)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả nhóm thiết bị' }));
    fireEvent.change(screen.getByLabelText('Tìm nhóm thiết bị'), { target: { value: 'may' } });
    expect(screen.queryByText('Điều hòa')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Chọn các nhóm đang hiện' }));
    expect(changes.pop()).toEqual(['0401', '0404']);
    expect(screen.getByRole('button', { name: /2 nhóm thiết bị/ })).toBeTruthy();
    fireEvent.click(screen.getByTitle('Bỏ lọc 0401 Máy tính bàn, máy chủ'));
    expect(changes.pop()).toEqual(['0404']);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ lọc nhóm' }));
    expect(changes.pop()).toEqual([]);
  });
});
